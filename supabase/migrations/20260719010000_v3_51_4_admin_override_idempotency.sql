-- v3.51.4 — idempotent, tenant-safe admin leave overrides
--
-- The ten-argument create_admin_leave_override RPC is an already shipped
-- web/mobile contract. Keep it byte-for-byte untouched and add a distinct v2
-- endpoint so old Capacitor binaries remain compatible while new clients gain
-- exactly-once retry semantics.

CREATE SCHEMA IF NOT EXISTS effectime_private;
REVOKE ALL ON SCHEMA effectime_private
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA effectime_private TO authenticated;

CREATE TABLE IF NOT EXISTS effectime_private.admin_leave_override_idempotency (
  workspace_id uuid NOT NULL
    REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  request_fingerprint bytea NOT NULL,
  leave_request_id uuid UNIQUE
    REFERENCES public.leave_requests(id) ON DELETE RESTRICT,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT admin_leave_override_idempotency_pkey
    PRIMARY KEY (workspace_id, actor_id, idempotency_key),
  CONSTRAINT admin_leave_override_fingerprint_sha256_check
    CHECK (octet_length(request_fingerprint) = 32),
  CONSTRAINT admin_leave_override_completion_check CHECK ((
    (
      leave_request_id IS NULL
      AND response IS NULL
      AND completed_at IS NULL
    )
    OR (
      leave_request_id IS NOT NULL
      AND response IS NOT NULL
      AND completed_at IS NOT NULL
      AND jsonb_typeof(response) = 'object'
      AND response->'ok' = 'true'::jsonb
      AND response->>'request_id' = leave_request_id::text
      AND response->>'status' IN ('pending', 'approved')
    )
  ) IS TRUE)
);

ALTER TABLE effectime_private.admin_leave_override_idempotency
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE effectime_private.admin_leave_override_idempotency
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE TRUNCATE ON TABLE
  effectime_private.admin_leave_override_idempotency,
  public.enterprise_audit_events
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE effectime_private.admin_leave_override_idempotency IS
  'Private exactly-once ledger for create_admin_leave_override_v2; stores hashes, never raw comments or justification.';

-- The historical generic audit INSERT policy allows workspace members to
-- supply arbitrary action and actor values. Reserve this security-sensitive
-- action for the SECURITY DEFINER workflow, matching the payroll transition
-- guard without changing unrelated audit producers.
CREATE OR REPLACE FUNCTION public.guard_admin_leave_override_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') AND (
    (TG_OP = 'INSERT' AND NEW.action = 'leave_request.admin_override')
    OR (TG_OP = 'UPDATE' AND (
      OLD.action = 'leave_request.admin_override'
      OR NEW.action = 'leave_request.admin_override'
    ))
    OR (TG_OP = 'DELETE' AND OLD.action = 'leave_request.admin_override')
  ) THEN
    RAISE EXCEPTION 'Admin leave override audit events can only be written by the atomic override workflow'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_admin_leave_override_audit_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS guard_admin_leave_override_audit_mutation
  ON public.enterprise_audit_events;
CREATE TRIGGER guard_admin_leave_override_audit_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_leave_override_audit_mutation();

CREATE OR REPLACE FUNCTION public.create_admin_leave_override_v2(
  _workspace_id uuid,
  _user_id uuid,
  _leave_type text,
  _start_date date,
  _end_date date,
  _justification text,
  _idempotency_key uuid,
  _auto_approve boolean DEFAULT true,
  _is_half_day boolean DEFAULT false,
  _half_day_period text DEFAULT NULL,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role public.enterprise_role;
  v_actor_status public.enterprise_membership_status;
  v_target_status public.enterprise_membership_status;
  v_justification text := NULLIF(btrim(_justification), '');
  v_comment text := NULLIF(btrim(_comment), '');
  v_fingerprint bytea;
  v_existing effectime_private.admin_leave_override_idempotency%ROWTYPE;
  v_response jsonb;
  v_request_id uuid;
  v_rows integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotency key is required' USING ERRCODE = '22023';
  END IF;

  -- Resolve an already committed exact replay before consulting mutable
  -- membership, permission, target-status or feature state. A response can be
  -- lost after commit and those controls can change before the client retries;
  -- re-authorizing first would misclassify the committed operation as a fresh
  -- rejection and allow the client to discard its only deduplication key.
  -- The lookup remains bound to auth.uid(), workspace and the unguessable UUID.
  -- jsonb::text is canonical for key ordering. Normalize text exactly as v1
  -- does and keep only the SHA-256 digest in the private ledger.
  v_fingerprint := extensions.digest(
    convert_to(
      jsonb_build_object(
        'workspace_id', _workspace_id,
        'actor_id', v_actor,
        'user_id', _user_id,
        'leave_type', _leave_type,
        'start_date', _start_date,
        'end_date', _end_date,
        'justification', v_justification,
        'auto_approve', _auto_approve,
        'is_half_day', _is_half_day,
        'half_day_period', _half_day_period,
        'comment', v_comment
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  SELECT ledger.*
  INTO v_existing
  FROM effectime_private.admin_leave_override_idempotency AS ledger
  WHERE ledger.workspace_id = _workspace_id
    AND ledger.actor_id = v_actor
    AND ledger.idempotency_key = _idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different admin override payload'
        USING ERRCODE = '22023';
    END IF;
    IF v_existing.response IS NULL
       OR v_existing.leave_request_id IS NULL
       OR v_existing.completed_at IS NULL THEN
      RAISE EXCEPTION 'Admin override idempotency ledger contains an incomplete committed entry'
        USING ERRCODE = '55000';
    END IF;
    RETURN v_existing.response;
  END IF;

  -- Lock actor and target membership rows in one deterministic order. A
  -- concurrent demotion/deactivation therefore linearizes either before this
  -- authorization check (and is rejected) or after the complete transaction.
  PERFORM membership.user_id
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = _workspace_id
    AND membership.user_id IN (v_actor, _user_id)
  ORDER BY membership.user_id
  FOR UPDATE;

  SELECT membership.role, membership.status
  INTO v_actor_role, v_actor_status
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = _workspace_id
    AND membership.user_id = v_actor;

  IF v_actor_role IS NULL
     OR v_actor_status IS DISTINCT FROM 'active'::public.enterprise_membership_status THEN
    RAISE EXCEPTION 'Admin override edit permission required' USING ERRCODE = '42501';
  END IF;

  -- Owners have implicit edit access. For every other role, lock the exact
  -- permission row so a concurrent revoke cannot pass between check and write.
  IF v_actor_role IS DISTINCT FROM 'owner'::public.enterprise_role THEN
    PERFORM permission.id
    FROM public.enterprise_role_permissions AS permission
    WHERE permission.workspace_id = _workspace_id
      AND permission.role_key = v_actor_role::text
      AND permission.feature_key = 'admin_override'
    FOR SHARE;
  END IF;

  IF NOT public.has_workspace_permission(
    _workspace_id,
    v_actor,
    'admin_override',
    'edit'
  ) THEN
    RAISE EXCEPTION 'Admin override edit permission required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.workspace_has_any_feature(_workspace_id, ARRAY['admin_override']) THEN
    RAISE EXCEPTION 'Admin override feature is not enabled for this workspace'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.status
  INTO v_target_status
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = _workspace_id
    AND membership.user_id = _user_id;

  IF v_target_status IS DISTINCT FROM 'active'::public.enterprise_membership_status THEN
    RAISE EXCEPTION 'Target user is not an active workspace member' USING ERRCODE = '22023';
  END IF;

  INSERT INTO effectime_private.admin_leave_override_idempotency (
    workspace_id,
    actor_id,
    idempotency_key,
    request_fingerprint
  ) VALUES (
    _workspace_id,
    v_actor,
    _idempotency_key,
    v_fingerprint
  )
  ON CONFLICT (workspace_id, actor_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  SELECT ledger.*
  INTO v_existing
  FROM effectime_private.admin_leave_override_idempotency AS ledger
  WHERE ledger.workspace_id = _workspace_id
    AND ledger.actor_id = v_actor
    AND ledger.idempotency_key = _idempotency_key
  FOR UPDATE;

  IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'Idempotency key was already used for a different admin override payload'
      USING ERRCODE = '22023';
  END IF;

  IF v_rows = 0 THEN
    IF v_existing.response IS NULL
       OR v_existing.leave_request_id IS NULL
       OR v_existing.completed_at IS NULL THEN
      RAISE EXCEPTION 'Admin override idempotency ledger contains an incomplete committed entry'
        USING ERRCODE = '55000';
    END IF;
    RETURN v_existing.response;
  END IF;

  -- Reuse the shipped atomic business implementation. Any request, quota,
  -- decision or audit error aborts this transaction and the idempotency claim.
  v_response := public.create_admin_leave_override(
    _workspace_id => _workspace_id,
    _user_id => _user_id,
    _leave_type => _leave_type,
    _start_date => _start_date,
    _end_date => _end_date,
    _justification => _justification,
    _auto_approve => _auto_approve,
    _is_half_day => _is_half_day,
    _half_day_period => _half_day_period,
    _comment => _comment
  );

  IF jsonb_typeof(v_response) IS DISTINCT FROM 'object'
     OR v_response->'ok' IS DISTINCT FROM 'true'::jsonb
     OR v_response->>'request_id' IS NULL
     OR v_response->>'status' IS NULL
     OR v_response->>'status' NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Admin override v1 returned an invalid response contract'
      USING ERRCODE = '55000';
  END IF;

  BEGIN
    v_request_id := (v_response->>'request_id')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Admin override v1 returned an invalid request identifier'
        USING ERRCODE = '55000';
  END;

  UPDATE effectime_private.admin_leave_override_idempotency AS ledger
  SET leave_request_id = v_request_id,
      response = v_response,
      completed_at = clock_timestamp()
  WHERE ledger.workspace_id = _workspace_id
    AND ledger.actor_id = v_actor
    AND ledger.idempotency_key = _idempotency_key
    AND ledger.response IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Admin override idempotency result could not be committed'
      USING ERRCODE = '55000';
  END IF;

  RETURN v_response;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_admin_leave_override_v2(
  uuid, uuid, text, date, date, text, uuid, boolean, boolean, text, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_leave_override_v2(
  uuid, uuid, text, date, date, text, uuid, boolean, boolean, text, text
) TO authenticated;

-- A SECURITY DEFINER function executes nested calls as its owner. Fail the
-- migration instead of shipping a v2 endpoint that cannot invoke the legacy
-- v1 boundary after an ownership or migration-executor drift.
DO $nested_definer_contract$
DECLARE
  v_v1_oid oid := pg_catalog.to_regprocedure(
    'public.create_admin_leave_override(uuid,uuid,text,date,date,text,boolean,boolean,text,text)'
  )::oid;
  v_v2_oid oid := pg_catalog.to_regprocedure(
    'public.create_admin_leave_override_v2(uuid,uuid,text,date,date,text,uuid,boolean,boolean,text,text)'
  )::oid;
  v_v1_owner oid;
  v_v2_owner oid;
BEGIN
  IF v_v1_oid IS NULL OR v_v2_oid IS NULL THEN
    RAISE EXCEPTION 'Admin override v1/v2 function contract is missing';
  END IF;

  SELECT procedure.proowner
  INTO v_v1_owner
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_v1_oid;

  SELECT procedure.proowner
  INTO v_v2_owner
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_v2_oid;

  IF pg_catalog.pg_get_userbyid(v_v1_owner) IN ('anon', 'authenticated', 'service_role')
     OR pg_catalog.pg_get_userbyid(v_v2_owner) IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Admin override SECURITY DEFINER functions require trusted owners';
  END IF;

  IF NOT pg_catalog.has_function_privilege(v_v2_owner, v_v1_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Admin override v2 owner cannot execute the legacy v1 function';
  END IF;
END;
$nested_definer_contract$;
