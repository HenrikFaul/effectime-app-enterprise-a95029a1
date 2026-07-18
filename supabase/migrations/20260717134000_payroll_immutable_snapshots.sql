-- v3.51.3 — immutable, hash-verified payroll calculations and atomic state transitions
-- Rollout order is DB first, followed immediately by the payroll-export Edge
-- function. Break-glass reopen is available only through an attributed,
-- reason-bound and audited service-role RPC; direct service-role updates remain
-- forbidden. Snapshotless new locks remain rejected so a rolled-back Edge must
-- not lock until the matching code ships.

CREATE SCHEMA IF NOT EXISTS extensions;
DO $extensions_schema_contract$
DECLARE
  v_schema_oid oid;
  v_schema_owner_oid oid;
  v_schema_acl aclitem[];
  v_executor_oid oid := to_regrole(current_user)::oid;
  v_untrusted_creators text;
BEGIN
  SELECT namespace.oid, namespace.nspowner, namespace.nspacl
  INTO v_schema_oid, v_schema_owner_oid, v_schema_acl
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'extensions';

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS owner_role
    WHERE owner_role.oid = v_schema_owner_oid
      AND (
        owner_role.oid = v_executor_oid
        OR owner_role.rolsuper
      )
  ) THEN
    RAISE EXCEPTION 'extensions schema owner is not trusted by the migration executor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        v_schema_acl,
        pg_catalog.acldefault('n', v_schema_owner_oid)
      )
    ) AS acl
    WHERE acl.grantee = 0
      AND acl.privilege_type = 'CREATE'
  ) THEN
    RAISE EXCEPTION 'extensions schema must not grant CREATE to PUBLIC';
  END IF;

  SELECT pg_catalog.string_agg(
    pg_catalog.quote_ident(candidate.rolname),
    ', ' ORDER BY candidate.rolname
  )
  INTO v_untrusted_creators
  FROM pg_catalog.pg_roles AS candidate
  WHERE pg_catalog.has_schema_privilege(candidate.oid, v_schema_oid, 'CREATE')
    AND candidate.oid <> v_schema_owner_oid
    AND candidate.oid <> v_executor_oid
    AND NOT candidate.rolsuper
    AND NOT pg_catalog.pg_has_role(candidate.oid, v_schema_owner_oid, 'MEMBER')
    AND NOT pg_catalog.pg_has_role(candidate.oid, v_executor_oid, 'MEMBER');

  IF v_untrusted_creators IS NOT NULL THEN
    RAISE EXCEPTION 'extensions schema grants CREATE to untrusted role(s): %',
      v_untrusted_creators;
  END IF;

  IF NOT pg_catalog.has_schema_privilege(v_executor_oid, v_schema_oid, 'USAGE') THEN
    RAISE EXCEPTION 'migration executor cannot use the trusted extensions schema';
  END IF;
END;
$extensions_schema_contract$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $pgcrypto_contract$
DECLARE
  v_extension_oid oid;
  v_schema_oid oid;
  v_executor_oid oid := to_regrole(current_user)::oid;
  v_digest_oid oid := to_regprocedure('extensions.digest(bytea,text)')::oid;
BEGIN
  SELECT extension.oid, namespace.oid
  INTO v_extension_oid, v_schema_oid
  FROM pg_catalog.pg_extension AS extension
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = extension.extnamespace
  WHERE extension.extname = 'pgcrypto'
    AND namespace.nspname = 'extensions';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pgcrypto must be installed in the extensions schema';
  END IF;

  IF v_digest_oid IS NULL THEN
    RAISE EXCEPTION 'pgcrypto digest(bytea,text) must be installed in the extensions schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_depend AS dependency
    WHERE dependency.classid = 'pg_catalog.pg_proc'::regclass
      AND dependency.objid = v_digest_oid
      AND dependency.objsubid = 0
      AND dependency.refclassid = 'pg_catalog.pg_extension'::regclass
      AND dependency.refobjid = v_extension_oid
      AND dependency.deptype = 'e'
  ) THEN
    RAISE EXCEPTION 'extensions.digest(bytea,text) must be a pgcrypto extension member';
  END IF;

  IF NOT pg_catalog.has_schema_privilege(v_executor_oid, v_schema_oid, 'USAGE')
     OR NOT pg_catalog.has_function_privilege(v_executor_oid, v_digest_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'migration executor cannot safely execute extensions.digest(bytea,text)';
  END IF;
END;
$pgcrypto_contract$;

ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS calculation_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS calculation_hash text,
  ADD COLUMN IF NOT EXISTS calculation_version integer;

ALTER TABLE public.payroll_periods
  DROP CONSTRAINT IF EXISTS payroll_periods_snapshot_triplet_check;
ALTER TABLE public.payroll_periods
  ADD CONSTRAINT payroll_periods_snapshot_triplet_check CHECK (
    (
      calculation_snapshot IS NULL
      AND calculation_hash IS NULL
      AND calculation_version IS NULL
    ) OR (
      calculation_snapshot IS NOT NULL
      AND calculation_hash IS NOT NULL
      AND calculation_version IS NOT NULL
      AND jsonb_typeof(calculation_snapshot) = 'object'
      AND calculation_hash ~ '^[0-9a-f]{64}$'
      AND calculation_version = 1
      AND status IN ('locked', 'exported')
    )
  ) NOT VALID;

ALTER TABLE public.payroll_periods
  DROP CONSTRAINT IF EXISTS payroll_periods_open_has_no_snapshot_check;
ALTER TABLE public.payroll_periods
  ADD CONSTRAINT payroll_periods_open_has_no_snapshot_check CHECK (
    status <> 'open'
    OR (
      calculation_snapshot IS NULL
      AND calculation_hash IS NULL
      AND calculation_version IS NULL
      AND locked_by IS NULL
      AND locked_at IS NULL
      AND exported_at IS NULL
      AND exported_to IS NULL
    )
  ) NOT VALID;

-- Client roles can create and edit ordinary open-period metadata, but protected
-- state is only writable from the SECURITY DEFINER transitions below. A legacy
-- locked/exported row remains readable, yet cannot be changed or backfilled
-- silently; callers receive an explicit conflict until an audited remediation
-- is designed.
CREATE OR REPLACE FUNCTION public.guard_payroll_period_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_is_direct_role boolean := current_user IN ('anon', 'authenticated', 'service_role');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open'
       OR NEW.calculation_snapshot IS NOT NULL
       OR NEW.calculation_hash IS NOT NULL
       OR NEW.calculation_version IS NOT NULL
       OR NEW.locked_by IS NOT NULL
       OR NEW.locked_at IS NOT NULL
       OR NEW.exported_at IS NOT NULL
       OR NEW.exported_to IS NOT NULL THEN
      RAISE EXCEPTION 'New payroll periods must be created in open state without protected metadata'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_is_direct_role AND OLD.status IN ('locked', 'exported') THEN
      RAISE EXCEPTION 'Locked payroll periods are immutable' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- service_role is privileged enough to bypass RLS, so every direct update is
  -- rejected. Operational reopen must use the audited SECURITY DEFINER RPC.
  IF current_user = 'service_role' THEN
    RAISE EXCEPTION 'service_role payroll updates require an audited transition RPC'
      USING ERRCODE = '42501';
  END IF;

  IF v_is_direct_role AND OLD.status IN ('locked', 'exported') THEN
    RAISE EXCEPTION 'Locked payroll periods are immutable' USING ERRCODE = '42501';
  END IF;

  IF v_is_direct_role AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.calculation_snapshot IS DISTINCT FROM OLD.calculation_snapshot
    OR NEW.calculation_hash IS DISTINCT FROM OLD.calculation_hash
    OR NEW.calculation_version IS DISTINCT FROM OLD.calculation_version
    OR NEW.locked_by IS DISTINCT FROM OLD.locked_by
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
    OR NEW.exported_at IS DISTINCT FROM OLD.exported_at
    OR NEW.exported_to IS DISTINCT FROM OLD.exported_to
  ) THEN
    RAISE EXCEPTION 'Payroll protected state can only be changed by an atomic transition'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'open' AND (
    NEW.calculation_snapshot IS NOT NULL
    OR NEW.calculation_hash IS NOT NULL
    OR NEW.calculation_version IS NOT NULL
    OR NEW.locked_by IS NOT NULL
    OR NEW.locked_at IS NOT NULL
    OR NEW.exported_at IS NOT NULL
    OR NEW.exported_to IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Open payroll periods cannot contain protected state'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.calculation_snapshot IS NULL
     OR NEW.calculation_hash IS NULL
     OR NEW.calculation_version IS NULL THEN
    IF NEW.status IN ('locked', 'exported') THEN
      RAISE EXCEPTION 'New payroll locks require a complete calculation snapshot'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.status NOT IN ('locked', 'exported')
        OR NEW.calculation_hash !~ '^[0-9a-f]{64}$'
        OR NEW.calculation_version <> 1 THEN
    RAISE EXCEPTION 'Payroll calculation snapshot metadata is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_payroll_period_mutation ON public.payroll_periods;
CREATE TRIGGER guard_payroll_period_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_period_mutation();

-- Transition audit rows are part of the financial state machine. The historical
-- audit INSERT policy permits ordinary workspace members to supply arbitrary
-- actor/action/state values, and service_role bypasses RLS. Reserve the payroll
-- transition actions for the SECURITY DEFINER owners that commit state + audit.
CREATE OR REPLACE FUNCTION public.guard_payroll_transition_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_reserved_actions constant text[] := ARRAY[
    'payroll.period_locked',
    'payroll.period_exported',
    'payroll.period_reopened_break_glass'
  ];
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') AND (
    (TG_OP = 'INSERT' AND NEW.action = ANY (v_reserved_actions))
    OR (TG_OP = 'UPDATE' AND (
      OLD.action = ANY (v_reserved_actions)
      OR NEW.action = ANY (v_reserved_actions)
    ))
    OR (TG_OP = 'DELETE' AND OLD.action = ANY (v_reserved_actions))
  ) THEN
    RAISE EXCEPTION 'Payroll transition audit events can only be written by an atomic transition'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_payroll_transition_audit_mutation
  ON public.enterprise_audit_events;
CREATE TRIGGER guard_payroll_transition_audit_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_transition_audit_mutation();

-- Row triggers cannot observe TRUNCATE. Runtime roles never need destructive
-- bulk removal of financial state or its audit trail, so close that separate
-- table privilege explicitly (including grants inherited through PUBLIC).
REVOKE TRUNCATE ON TABLE public.payroll_periods, public.enterprise_audit_events
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lock_payroll_period_snapshot(
  _workspace_id uuid,
  _period_id uuid,
  _actor_id uuid,
  _snapshot jsonb,
  _snapshot_hash text,
  _snapshot_version integer,
  _canonical_payload text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_period public.payroll_periods%ROWTYPE;
  v_tenant_id uuid;
  v_now timestamptz := now();
  v_canonical_json jsonb;
  v_computed_hash text;
  v_total_hours numeric;
  v_total_overtime numeric;
  v_total_gross numeric;
  v_snapshot_member_ids uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = _workspace_id
      AND membership.user_id = _actor_id
      AND membership.status = 'active'::public.enterprise_membership_status
      AND membership.role IN (
        'owner'::public.enterprise_role,
        'resourceAssistant'::public.enterprise_role
      )
  ) THEN
    RAISE EXCEPTION 'Active payroll admin membership required' USING ERRCODE = '42501';
  END IF;

  v_tenant_id := public.tenant_id_for_workspace(_workspace_id);
  IF v_tenant_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.tenant_enabled_features(v_tenant_id) AS enabled
    WHERE enabled.feature_key = 'payroll_engine'
  ) THEN
    RAISE EXCEPTION 'Payroll engine feature is not enabled' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = _period_id AND workspace_id = _workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll period not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status <> 'open' THEN
    RAISE EXCEPTION 'Payroll period is no longer open' USING ERRCODE = '55000';
  END IF;

  IF _canonical_payload IS NULL OR octet_length(_canonical_payload) = 0 THEN
    RAISE EXCEPTION 'Canonical payroll payload is required' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_canonical_json := _canonical_payload::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Canonical payroll payload is not valid JSON' USING ERRCODE = '22023';
  END;

  IF _snapshot IS NULL
     OR jsonb_typeof(_snapshot) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_canonical_json) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid payroll calculation snapshot' USING ERRCODE = '22023';
  END IF;

  IF _snapshot_version IS NULL
     OR _snapshot_version <> 1
     OR _snapshot_hash IS NULL
     OR _snapshot_hash !~ '^[0-9a-f]{64}$'
     OR NOT (_snapshot ?& ARRAY['version', 'hash', 'period', 'members', 'totals'])
     OR (_snapshot - ARRAY['version', 'hash', 'period', 'members', 'totals']::text[]) <> '{}'::jsonb
     OR jsonb_typeof(_snapshot->'version') IS DISTINCT FROM 'number'
     OR _snapshot->>'version' IS DISTINCT FROM _snapshot_version::text
     OR jsonb_typeof(_snapshot->'hash') IS DISTINCT FROM 'string'
     OR _snapshot->>'hash' IS DISTINCT FROM _snapshot_hash
     OR jsonb_typeof(_snapshot->'period') IS DISTINCT FROM 'object'
     OR jsonb_typeof(_snapshot->'members') IS DISTINCT FROM 'array'
     OR jsonb_typeof(_snapshot->'totals') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid payroll calculation snapshot shape' USING ERRCODE = '22023';
  END IF;

  IF NOT ((_snapshot->'period') ?& ARRAY[
       'id', 'workspace_id', 'name', 'start_date', 'end_date', 'status'
     ])
     OR ((_snapshot->'period') - ARRAY[
       'id', 'workspace_id', 'name', 'start_date', 'end_date', 'status'
     ]::text[]) <> '{}'::jsonb
     OR _snapshot->'period'->>'id' IS DISTINCT FROM v_period.id::text
     OR _snapshot->'period'->>'workspace_id' IS DISTINCT FROM v_period.workspace_id::text
     OR _snapshot->'period'->>'name' IS DISTINCT FROM v_period.name
     OR _snapshot->'period'->>'start_date' IS DISTINCT FROM v_period.start_date::text
     OR _snapshot->'period'->>'end_date' IS DISTINCT FROM v_period.end_date::text
     OR _snapshot->'period'->>'status' IS DISTINCT FROM 'locked' THEN
    RAISE EXCEPTION 'Invalid payroll snapshot period metadata' USING ERRCODE = '22023';
  END IF;

  IF v_canonical_json IS DISTINCT FROM (_snapshot - 'hash') THEN
    RAISE EXCEPTION 'Canonical payroll payload does not match the snapshot'
      USING ERRCODE = '22023';
  END IF;

  v_computed_hash := encode(
    extensions.digest(convert_to(_canonical_payload, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_computed_hash IS DISTINCT FROM _snapshot_hash THEN
    RAISE EXCEPTION 'Payroll calculation snapshot hash mismatch' USING ERRCODE = '22023';
  END IF;

  -- Validate every member before performing casts in later checks. Exact keys
  -- reject JSON nulls and future fields that are not part of snapshot v1.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_snapshot->'members') AS item(member)
    WHERE jsonb_typeof(member) IS DISTINCT FROM 'object'
  ) THEN
    RAISE EXCEPTION 'Payroll snapshot members must be JSON objects'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_snapshot->'members') AS item(member)
    WHERE NOT (member ?& ARRAY[
         'membership_id', 'display_name', 'regular_hours', 'overtime_hours',
         'leave_days', 'gross_estimate', 'currency'
       ])
       OR (member - ARRAY[
         'membership_id', 'display_name', 'regular_hours', 'overtime_hours',
         'leave_days', 'gross_estimate', 'currency'
       ]::text[]) <> '{}'::jsonb
       OR jsonb_typeof(member->'membership_id') IS DISTINCT FROM 'string'
       OR (member->>'membership_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR jsonb_typeof(member->'display_name') IS DISTINCT FROM 'string'
       OR btrim(COALESCE(member->>'display_name', '')) = ''
       OR jsonb_typeof(member->'regular_hours') IS DISTINCT FROM 'number'
       OR jsonb_typeof(member->'overtime_hours') IS DISTINCT FROM 'number'
       OR jsonb_typeof(member->'leave_days') IS DISTINCT FROM 'number'
       OR jsonb_typeof(member->'gross_estimate') IS DISTINCT FROM 'number'
       OR jsonb_typeof(member->'currency') IS DISTINCT FROM 'string'
       OR (member->>'currency') !~ '^[A-Z]{3}$'
  ) THEN
    RAISE EXCEPTION 'Payroll snapshot contains an invalid member shape'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_snapshot->'members') AS item(member)
    WHERE (member->>'regular_hours')::numeric < 0
       OR (member->>'overtime_hours')::numeric < 0
       OR (member->>'leave_days')::numeric < 0
       OR (member->>'leave_days')::numeric <> trunc((member->>'leave_days')::numeric)
       OR (member->>'leave_days')::numeric > 9007199254740991
       OR (member->>'gross_estimate')::numeric < 0
  ) THEN
    RAISE EXCEPTION 'Payroll snapshot member metrics must be finite non-negative values'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        member->>'membership_id' AS membership_id,
        lag(member->>'membership_id') OVER (ORDER BY ordinal) AS previous_id
      FROM jsonb_array_elements(_snapshot->'members') WITH ORDINALITY
        AS item(member, ordinal)
    ) AS ordered_members
    WHERE previous_id IS NOT NULL
      AND (previous_id COLLATE "C") >= (membership_id COLLATE "C")
  ) THEN
    RAISE EXCEPTION 'Payroll snapshot membership ids must be unique and sorted'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    array_agg((member->>'membership_id')::uuid ORDER BY ordinal),
    ARRAY[]::uuid[]
  )
  INTO v_snapshot_member_ids
  FROM jsonb_array_elements(_snapshot->'members') WITH ORDINALITY
    AS item(member, ordinal);

  -- Recheck the complete active membership set in the lock transaction. This
  -- fails closed when membership changed after the Edge calculation queries.
  IF (
    SELECT count(*)
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = _workspace_id
      AND membership.status = 'active'::public.enterprise_membership_status
  ) <> cardinality(v_snapshot_member_ids)
  OR EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = _workspace_id
      AND membership.status = 'active'::public.enterprise_membership_status
      AND NOT (membership.id = ANY(v_snapshot_member_ids))
  )
  OR EXISTS (
    SELECT 1
    FROM unnest(v_snapshot_member_ids) AS snapshot_member(membership_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = snapshot_member.membership_id
        AND membership.workspace_id = _workspace_id
        AND membership.status = 'active'::public.enterprise_membership_status
    )
  ) THEN
    RAISE EXCEPTION 'Active workspace membership changed during payroll locking'
      USING ERRCODE = '55000';
  END IF;

  IF NOT ((_snapshot->'totals') ?& ARRAY[
       'total_hours', 'total_overtime', 'total_gross', 'member_count'
     ])
     OR ((_snapshot->'totals') - ARRAY[
       'total_hours', 'total_overtime', 'total_gross', 'member_count'
     ]::text[]) <> '{}'::jsonb
     OR jsonb_typeof(_snapshot->'totals'->'total_hours') IS DISTINCT FROM 'number'
     OR jsonb_typeof(_snapshot->'totals'->'total_overtime') IS DISTINCT FROM 'number'
     OR jsonb_typeof(_snapshot->'totals'->'total_gross') IS DISTINCT FROM 'number'
     OR jsonb_typeof(_snapshot->'totals'->'member_count') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Payroll snapshot totals have an invalid shape'
      USING ERRCODE = '22023';
  END IF;

  IF (_snapshot->'totals'->>'total_hours')::numeric < 0
     OR (_snapshot->'totals'->>'total_overtime')::numeric < 0
     OR (_snapshot->'totals'->>'total_gross')::numeric < 0
     OR (_snapshot->'totals'->>'member_count')::numeric < 0
     OR (_snapshot->'totals'->>'member_count')::numeric <>
       trunc((_snapshot->'totals'->>'member_count')::numeric)
     OR (_snapshot->'totals'->>'member_count')::numeric > 9007199254740991
     OR (_snapshot->'totals'->>'member_count')::numeric <>
       jsonb_array_length(_snapshot->'members')::numeric THEN
    RAISE EXCEPTION 'Payroll snapshot totals contain invalid values'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(round(sum(
      (member->>'regular_hours')::numeric +
      (member->>'overtime_hours')::numeric
    ), 2), 0),
    COALESCE(round(sum((member->>'overtime_hours')::numeric), 2), 0),
    COALESCE(round(sum((member->>'gross_estimate')::numeric), 2), 0)
  INTO v_total_hours, v_total_overtime, v_total_gross
  FROM jsonb_array_elements(_snapshot->'members') AS item(member);

  IF (_snapshot->'totals'->>'total_hours')::numeric <> v_total_hours
     OR (_snapshot->'totals'->>'total_overtime')::numeric <> v_total_overtime
     OR (_snapshot->'totals'->>'total_gross')::numeric <> v_total_gross THEN
    RAISE EXCEPTION 'Payroll snapshot totals do not match member calculations'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.payroll_periods
  SET status = 'locked',
      calculation_snapshot = _snapshot,
      calculation_hash = _snapshot_hash,
      calculation_version = _snapshot_version,
      locked_by = _actor_id,
      locked_at = v_now,
      exported_at = NULL,
      exported_to = NULL
  WHERE id = v_period.id;

  INSERT INTO public.enterprise_audit_events (
    workspace_id,
    actor_id,
    action,
    target_type,
    target_id,
    prev_state,
    new_state,
    metadata
  ) VALUES (
    _workspace_id,
    _actor_id,
    'payroll.period_locked',
    'payroll_period',
    v_period.id,
    jsonb_build_object('status', v_period.status),
    jsonb_build_object('status', 'locked'),
    jsonb_build_object(
      'period_name', v_period.name,
      'start_date', v_period.start_date,
      'end_date', v_period.end_date,
      'snapshot_hash', _snapshot_hash,
      'snapshot_version', _snapshot_version,
      'member_count', jsonb_array_length(_snapshot->'members')
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', v_period.id,
    'status', 'locked',
    'snapshot_hash', _snapshot_hash,
    'snapshot_version', _snapshot_version
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_payroll_period_snapshot(
  uuid, uuid, uuid, jsonb, text, integer, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lock_payroll_period_snapshot(
  uuid, uuid, uuid, jsonb, text, integer, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_payroll_period_exported(
  _workspace_id uuid,
  _period_id uuid,
  _actor_id uuid,
  _provider text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_period public.payroll_periods%ROWTYPE;
  v_tenant_id uuid;
  v_provider text := lower(btrim(_provider));
  v_now timestamptz := now();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = _workspace_id
      AND membership.user_id = _actor_id
      AND membership.status = 'active'::public.enterprise_membership_status
      AND membership.role IN (
        'owner'::public.enterprise_role,
        'resourceAssistant'::public.enterprise_role
      )
  ) THEN
    RAISE EXCEPTION 'Active payroll admin membership required' USING ERRCODE = '42501';
  END IF;

  v_tenant_id := public.tenant_id_for_workspace(_workspace_id);
  IF v_tenant_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.tenant_enabled_features(v_tenant_id) AS enabled
    WHERE enabled.feature_key = 'payroll_export'
  ) THEN
    RAISE EXCEPTION 'Payroll export feature is not enabled' USING ERRCODE = '42501';
  END IF;
  IF v_provider IS NULL OR v_provider NOT IN (
    'generic', 'datev', 'bamboohr', 'personio', 'sap', 'workday',
    'adp', 'sage', 'billingo', 'szamlazz', 'pohoda'
  ) THEN
    RAISE EXCEPTION 'Unsupported payroll export provider' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = _period_id AND workspace_id = _workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll period not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status NOT IN ('locked', 'exported') THEN
    RAISE EXCEPTION 'Payroll period is not locked' USING ERRCODE = '55000';
  END IF;
  IF v_period.calculation_snapshot IS NULL
     OR v_period.calculation_hash IS NULL
     OR v_period.calculation_version IS NULL THEN
    RAISE EXCEPTION 'Locked payroll period has no calculation snapshot'
      USING ERRCODE = '55000';
  END IF;
  IF v_period.calculation_snapshot->>'hash' IS DISTINCT FROM v_period.calculation_hash
     OR v_period.calculation_snapshot->>'version' IS DISTINCT FROM v_period.calculation_version::text THEN
    RAISE EXCEPTION 'Payroll calculation snapshot metadata is inconsistent'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.payroll_periods
  SET status = 'exported',
      exported_at = v_now,
      exported_to = v_provider
  WHERE id = v_period.id;

  INSERT INTO public.enterprise_audit_events (
    workspace_id,
    actor_id,
    action,
    target_type,
    target_id,
    prev_state,
    new_state,
    metadata
  ) VALUES (
    _workspace_id,
    _actor_id,
    'payroll.period_exported',
    'payroll_period',
    v_period.id,
    jsonb_build_object('status', v_period.status),
    jsonb_build_object('status', 'exported'),
    jsonb_build_object(
      'provider', v_provider,
      'snapshot_hash', v_period.calculation_hash,
      'snapshot_version', v_period.calculation_version
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', v_period.id,
    'status', 'exported',
    'provider', v_provider,
    'snapshot_hash', v_period.calculation_hash,
    'snapshot_version', v_period.calculation_version
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_payroll_period_exported(
  uuid, uuid, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_payroll_period_exported(
  uuid, uuid, uuid, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.reopen_payroll_period_break_glass(
  _workspace_id uuid,
  _period_id uuid,
  _actor_id uuid,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_period public.payroll_periods%ROWTYPE;
  v_reason text := regexp_replace(
    _reason,
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );
  v_audit_event_id uuid;
BEGIN
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 8 AND 1000 THEN
    RAISE EXCEPTION 'Break-glass payroll reopen reason must contain 8 to 1000 characters'
      USING ERRCODE = '22023';
  END IF;

  -- Lock the authorizing membership until the transition commits so a parallel
  -- suspension or role downgrade cannot race the attributed audit event.
  PERFORM 1
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = _workspace_id
    AND membership.user_id = _actor_id
    AND membership.status = 'active'::public.enterprise_membership_status
    AND membership.role IN (
      'owner'::public.enterprise_role,
      'resourceAssistant'::public.enterprise_role
    )
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active payroll admin membership required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_period
  FROM public.payroll_periods
  WHERE id = _period_id AND workspace_id = _workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll period not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status NOT IN ('locked', 'exported') THEN
    RAISE EXCEPTION 'Payroll period is not locked or exported' USING ERRCODE = '55000';
  END IF;

  UPDATE public.payroll_periods
  SET status = 'open',
      calculation_snapshot = NULL,
      calculation_hash = NULL,
      calculation_version = NULL,
      locked_by = NULL,
      locked_at = NULL,
      exported_at = NULL,
      exported_to = NULL
  WHERE id = v_period.id;

  INSERT INTO public.enterprise_audit_events (
    workspace_id,
    actor_id,
    action,
    target_type,
    target_id,
    prev_state,
    new_state,
    metadata
  ) VALUES (
    _workspace_id,
    _actor_id,
    'payroll.period_reopened_break_glass',
    'payroll_period',
    v_period.id,
    jsonb_build_object(
      'status', v_period.status,
      'calculation_snapshot', v_period.calculation_snapshot,
      'calculation_hash', v_period.calculation_hash,
      'calculation_version', v_period.calculation_version,
      'locked_by', v_period.locked_by,
      'locked_at', v_period.locked_at,
      'exported_at', v_period.exported_at,
      'exported_to', v_period.exported_to
    ),
    jsonb_build_object(
      'status', 'open',
      'calculation_snapshot', NULL,
      'calculation_hash', NULL,
      'calculation_version', NULL,
      'locked_by', NULL,
      'locked_at', NULL,
      'exported_at', NULL,
      'exported_to', NULL
    ),
    jsonb_build_object(
      'reason', v_reason,
      'break_glass', true
    )
  )
  RETURNING id INTO v_audit_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'period_id', v_period.id,
    'status', 'open',
    'previous_status', v_period.status,
    'previous_snapshot_hash', v_period.calculation_hash,
    'audit_event_id', v_audit_event_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_payroll_period_break_glass(
  uuid, uuid, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_payroll_period_break_glass(
  uuid, uuid, uuid, text
) TO service_role;
