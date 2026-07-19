\set ON_ERROR_STOP on
SET client_min_messages TO notice;

-- The same fixture drives deterministic two-session retry and authorization
-- races after the base contract has been installed. Session A exposes an
-- advisory barrier only after it holds the relevant uncommitted serialization
-- lock. The runner proves session B is waiting on A before releasing the
-- database gate.
\if :{?ADMIN_OVERRIDE_DUPLICATE_A}
SET application_name TO 'effectime-admin-override-duplicate-a';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);
WITH response AS (
  SELECT public.create_admin_leave_override_v2(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'vacation',
    DATE '2026-08-03',
    DATE '2026-08-03',
    'Concurrent exactly-once contract',
    '90000000-0000-4000-8000-000000000090',
    true,
    false,
    NULL,
    'session A'
  ) AS value
)
INSERT INTO contract.admin_override_concurrency_results(scenario, client, response, outcome)
SELECT 'duplicate', 'a', value, 'success' FROM response;
SELECT pg_advisory_xact_lock(734553, 1);
SELECT contract.wait_for_admin_override_release();
COMMIT;
\elif :{?ADMIN_OVERRIDE_DUPLICATE_B}
SET application_name TO 'effectime-admin-override-duplicate-b';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);
WITH response AS (
  SELECT public.create_admin_leave_override_v2(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'vacation',
    DATE '2026-08-03',
    DATE '2026-08-03',
    'Concurrent exactly-once contract',
    '90000000-0000-4000-8000-000000000090',
    true,
    false,
    NULL,
    'session A'
  ) AS value
)
INSERT INTO contract.admin_override_concurrency_results(scenario, client, response, outcome)
SELECT 'duplicate', 'b', value, 'success' FROM response;
COMMIT;
\elif :{?ADMIN_OVERRIDE_DUPLICATE_VERIFY}
SELECT contract.assert_true(
  (
    SELECT count(*) = 2 AND count(DISTINCT response) = 1
    FROM contract.admin_override_concurrency_results
    WHERE scenario = 'duplicate' AND outcome = 'success'
  ),
  'Concurrent duplicate clients did not receive the same response'
);
SELECT contract.assert_true(
  (
    SELECT count(*) = 1
    FROM effectime_private.admin_leave_override_idempotency
    WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
      AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      AND idempotency_key = '90000000-0000-4000-8000-000000000090'
  )
  AND (
    SELECT count(*) = 1
    FROM public.leave_requests
    WHERE id = (
      SELECT leave_request_id
      FROM effectime_private.admin_leave_override_idempotency
      WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
        AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
        AND idempotency_key = '90000000-0000-4000-8000-000000000090'
    )
  )
  AND (
    SELECT count(*) = 1
    FROM public.approval_decisions
    WHERE leave_request_id = (
      SELECT leave_request_id
      FROM effectime_private.admin_leave_override_idempotency
      WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
        AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
        AND idempotency_key = '90000000-0000-4000-8000-000000000090'
    )
  )
  AND (
    SELECT count(*) = 1
    FROM public.enterprise_quota_transactions
    WHERE leave_request_id = (
      SELECT leave_request_id
      FROM effectime_private.admin_leave_override_idempotency
      WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
        AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
        AND idempotency_key = '90000000-0000-4000-8000-000000000090'
    )
      AND transaction_type = 'consume'
  )
  AND (
    SELECT count(*) = 1
    FROM public.enterprise_audit_events
    WHERE target_id = (
      SELECT leave_request_id
      FROM effectime_private.admin_leave_override_idempotency
      WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
        AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
        AND idempotency_key = '90000000-0000-4000-8000-000000000090'
    )
      AND action = 'leave_request.admin_override'
  ),
  'Concurrent duplicate retry produced more than one logical side-effect set'
);
SELECT 'admin_override_duplicate_concurrency_contract_passed' AS assertion;
\elif :{?ADMIN_OVERRIDE_DEMOTION_A}
SET application_name TO 'effectime-admin-override-demotion-a';
BEGIN;
WITH demoted AS (
  UPDATE public.enterprise_memberships
  SET status = 'suspended'::public.enterprise_membership_status
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
    AND status = 'active'::public.enterprise_membership_status
  RETURNING 1
)
SELECT contract.assert_true(
  (SELECT count(*) = 1 FROM demoted),
  'Concurrent demotion actor was not active'
);
SELECT pg_advisory_xact_lock(734553, 2);
SELECT contract.wait_for_admin_override_release();
COMMIT;
\elif :{?ADMIN_OVERRIDE_DEMOTION_B}
SET application_name TO 'effectime-admin-override-demotion-b';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
  true
);
DO $demoted_admin_override$
BEGIN
  BEGIN
    PERFORM public.create_admin_leave_override_v2(
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'vacation',
      DATE '2026-08-04',
      DATE '2026-08-04',
      'Concurrent demotion must win',
      '90000000-0000-4000-8000-000000000091',
      true,
      false,
      NULL,
      NULL
    );
    INSERT INTO contract.admin_override_concurrency_results(scenario, client, outcome)
    VALUES ('demotion', 'b', 'unexpected-success');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO contract.admin_override_concurrency_results(scenario, client, outcome)
    VALUES ('demotion', 'b', 'denied-after-serialization');
  END;
END;
$demoted_admin_override$;
COMMIT;
\elif :{?ADMIN_OVERRIDE_DEMOTION_VERIFY}
SELECT contract.assert_true(
  (
    SELECT status = 'suspended'::public.enterprise_membership_status
    FROM public.enterprise_memberships
    WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
      AND user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
  )
  AND (
    SELECT count(*) = 1
    FROM contract.admin_override_concurrency_results
    WHERE scenario = 'demotion' AND outcome = 'denied-after-serialization'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM effectime_private.admin_leave_override_idempotency
    WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
      AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
      AND idempotency_key = '90000000-0000-4000-8000-000000000091'
  ),
  'Concurrent demotion did not fail closed before the override side effects'
);
SELECT 'admin_override_demotion_concurrency_contract_passed' AS assertion;
\else

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE SCHEMA contract;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
GRANT USAGE ON SCHEMA contract TO authenticated;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

CREATE TYPE public.enterprise_role AS ENUM ('owner', 'resourceAssistant', 'member');
CREATE TYPE public.enterprise_membership_status AS ENUM ('active', 'invited', 'suspended', 'removed');
CREATE TYPE public.leave_type AS ENUM ('vacation', 'sick_leave', 'unpaid_leave', 'other');
CREATE TYPE public.leave_request_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.quota_transaction_type AS ENUM ('consume', 'refund', 'adjustment', 'carryover');

CREATE TABLE public.enterprise_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.enterprise_memberships (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.enterprise_role NOT NULL,
  status public.enterprise_membership_status NOT NULL,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.enterprise_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  feature_key text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('none', 'readonly', 'edit')),
  UNIQUE (workspace_id, role_key, feature_key)
);

CREATE TABLE public.fixture_workspace_features (
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (workspace_id, feature_key)
);

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  leave_type public.leave_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.leave_request_status NOT NULL DEFAULT 'draft',
  comment text,
  is_half_day boolean NOT NULL DEFAULT false,
  half_day_period text,
  reviewer_id uuid,
  reviewed_at timestamptz,
  review_comment text
);

CREATE TABLE public.approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  decided_by uuid NOT NULL,
  decision public.leave_request_status NOT NULL,
  comment text
);

CREATE TABLE public.enterprise_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  affected_user_id uuid,
  prev_state jsonb,
  new_state jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.enterprise_leave_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  year integer NOT NULL,
  initial_days numeric NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, membership_id, leave_type, year)
);

CREATE TABLE public.enterprise_quota_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  quota_id uuid NOT NULL REFERENCES public.enterprise_leave_quotas(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  leave_request_id uuid REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  transaction_type public.quota_transaction_type NOT NULL,
  amount_days numeric NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_audit_all
  ON public.enterprise_audit_events
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON public.enterprise_audit_events TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_enterprise_member(
  _workspace_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = _workspace_id
      AND membership.user_id = _user_id
      AND membership.status = 'active'::public.enterprise_membership_status
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_workspace_permission(
  _workspace_id uuid,
  _user_id uuid,
  _feature_key text,
  _minimum_access text DEFAULT 'readonly'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT COALESCE(
    _user_id = auth.uid()
    AND _minimum_access IN ('readonly', 'edit')
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.workspace_id = _workspace_id
        AND membership.user_id = _user_id
        AND membership.status = 'active'::public.enterprise_membership_status
        AND (
          membership.role = 'owner'::public.enterprise_role
          OR EXISTS (
            SELECT 1
            FROM public.enterprise_role_permissions AS permission
            WHERE permission.workspace_id = membership.workspace_id
              AND permission.role_key = membership.role::text
              AND permission.feature_key = _feature_key
              AND CASE permission.access_level
                    WHEN 'edit' THEN 2
                    WHEN 'readonly' THEN 1
                    ELSE 0
                  END >= CASE _minimum_access WHEN 'edit' THEN 2 ELSE 1 END
          )
        )
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.workspace_has_any_feature(
  _workspace_id uuid,
  _feature_keys text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT public.is_enterprise_member(_workspace_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.fixture_workspace_features AS feature
      WHERE feature.workspace_id = _workspace_id
        AND feature.feature_key = ANY(COALESCE(_feature_keys, ARRAY[]::text[]))
        AND feature.enabled
    );
$function$;

CREATE OR REPLACE FUNCTION public.calc_leave_days(
  _start_date date,
  _end_date date,
  _is_half_day boolean
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _is_half_day THEN 0.5::numeric
    ELSE (_end_date - _start_date + 1)::numeric
  END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_leave_quota_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_membership_id uuid;
  v_quota_id uuid;
  v_days numeric;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR OLD.status = 'approved'::public.leave_request_status
     OR NEW.status <> 'approved'::public.leave_request_status THEN
    RETURN NEW;
  END IF;

  SELECT membership.id
  INTO v_membership_id
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = NEW.workspace_id
    AND membership.user_id = NEW.user_id;

  v_days := public.calc_leave_days(NEW.start_date, NEW.end_date, NEW.is_half_day);
  INSERT INTO public.enterprise_leave_quotas (
    workspace_id, membership_id, leave_type, year, initial_days
  ) VALUES (
    NEW.workspace_id,
    v_membership_id,
    NEW.leave_type,
    EXTRACT(YEAR FROM NEW.start_date)::integer,
    0
  )
  ON CONFLICT (workspace_id, membership_id, leave_type, year)
  DO NOTHING;

  SELECT quota.id
  INTO STRICT v_quota_id
  FROM public.enterprise_leave_quotas AS quota
  WHERE quota.workspace_id = NEW.workspace_id
    AND quota.membership_id = v_membership_id
    AND quota.leave_type = NEW.leave_type
    AND quota.year = EXTRACT(YEAR FROM NEW.start_date)::integer
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.enterprise_quota_transactions AS transaction
    WHERE transaction.leave_request_id = NEW.id
      AND transaction.transaction_type = 'consume'::public.quota_transaction_type
  ) THEN
    INSERT INTO public.enterprise_quota_transactions (
      workspace_id, quota_id, membership_id, leave_request_id,
      transaction_type, amount_days, reason, created_by
    ) VALUES (
      NEW.workspace_id, v_quota_id, v_membership_id, NEW.id,
      'consume'::public.quota_transaction_type, -v_days,
      'Auto-consume on approval', COALESCE(NEW.reviewer_id, NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_leave_quota_change
  AFTER UPDATE OF status ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_leave_quota_change();

-- Faithful pre-I-26 business boundary. The target migration must call this
-- shipped function rather than reimplementing or replacing it.
CREATE OR REPLACE FUNCTION public.create_admin_leave_override(
  _workspace_id uuid,
  _user_id uuid,
  _leave_type text,
  _start_date date,
  _end_date date,
  _justification text,
  _auto_approve boolean DEFAULT true,
  _is_half_day boolean DEFAULT false,
  _half_day_period text DEFAULT NULL,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_request_id uuid;
  v_status public.leave_request_status := CASE WHEN _auto_approve
    THEN 'approved'::public.leave_request_status
    ELSE 'pending'::public.leave_request_status
  END;
  v_justification text := NULLIF(btrim(_justification), '');
  v_comment text := NULLIF(btrim(_comment), '');
BEGIN
  IF v_actor IS NULL OR NOT public.has_workspace_permission(
    _workspace_id, v_actor, 'admin_override', 'edit'
  ) THEN
    RAISE EXCEPTION 'Admin override edit permission required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.workspace_has_any_feature(_workspace_id, ARRAY['admin_override']) THEN
    RAISE EXCEPTION 'Admin override feature is not enabled for this workspace'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND status = 'active'::public.enterprise_membership_status
  ) THEN
    RAISE EXCEPTION 'Target user is not an active workspace member' USING ERRCODE = '22023';
  END IF;
  IF _leave_type NOT IN ('vacation', 'sick_leave', 'unpaid_leave', 'other') THEN
    RAISE EXCEPTION 'Invalid leave type' USING ERRCODE = '22023';
  END IF;
  IF _start_date IS NULL OR _end_date IS NULL OR _end_date < _start_date THEN
    RAISE EXCEPTION 'Invalid leave date range' USING ERRCODE = '22023';
  END IF;
  IF _auto_approve IS NULL OR _is_half_day IS NULL THEN
    RAISE EXCEPTION 'Override flags must be boolean' USING ERRCODE = '22023';
  END IF;
  IF _is_half_day AND (
    _start_date <> _end_date
    OR _half_day_period IS NULL
    OR _half_day_period NOT IN ('morning', 'afternoon')
  ) THEN
    RAISE EXCEPTION 'Half-day override requires one date and a valid period'
      USING ERRCODE = '22023';
  END IF;
  IF NOT _is_half_day AND _half_day_period IS NOT NULL THEN
    RAISE EXCEPTION 'Half-day period is only valid for half-day leave'
      USING ERRCODE = '22023';
  END IF;
  IF v_justification IS NULL OR length(v_justification) > 2000
     OR (v_comment IS NOT NULL AND length(v_comment) > 4000) THEN
    RAISE EXCEPTION 'Invalid override justification or comment' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.leave_requests (
    workspace_id, user_id, leave_type, start_date, end_date, status,
    comment, is_half_day, half_day_period,
    reviewer_id, reviewed_at, review_comment
  ) VALUES (
    _workspace_id, _user_id, _leave_type::public.leave_type,
    _start_date, _end_date, 'pending'::public.leave_request_status,
    v_comment, _is_half_day,
    CASE WHEN _is_half_day THEN _half_day_period ELSE NULL END,
    NULL, NULL, NULL
  ) RETURNING id INTO v_request_id;

  IF _auto_approve THEN
    UPDATE public.leave_requests
    SET status = 'approved'::public.leave_request_status,
        reviewer_id = v_actor,
        reviewed_at = now(),
        review_comment = 'Admin override: ' || v_justification
    WHERE id = v_request_id;

    INSERT INTO public.approval_decisions (
      leave_request_id, workspace_id, decided_by, decision, comment
    ) VALUES (
      v_request_id, _workspace_id, v_actor,
      'approved'::public.leave_request_status, v_justification
    );
  END IF;

  INSERT INTO public.enterprise_audit_events (
    workspace_id, actor_id, action, target_type, target_id,
    affected_user_id, prev_state, new_state, metadata
  ) VALUES (
    _workspace_id, v_actor, 'leave_request.admin_override',
    'leave_request', v_request_id, _user_id, NULL,
    jsonb_build_object('status', v_status),
    jsonb_build_object(
      'leave_type', _leave_type,
      'start_date', _start_date,
      'end_date', _end_date,
      'auto_approved', _auto_approve,
      'justification', v_justification,
      'is_half_day', _is_half_day
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'status', v_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_admin_leave_override(
  uuid, uuid, text, date, date, text, boolean, boolean, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_leave_override(
  uuid, uuid, text, date, date, text, boolean, boolean, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION contract.assert_true(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', message;
  END IF;
END;
$function$;

INSERT INTO public.enterprise_workspaces(id, name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Tenant A workspace'),
  ('22222222-2222-4222-8222-222222222222', 'Tenant B workspace');

INSERT INTO public.enterprise_memberships(id, workspace_id, user_id, role, status) VALUES
  ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'owner', 'active'),
  ('10000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'resourceAssistant', 'active'),
  ('10000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'member', 'active'),
  ('10000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'resourceAssistant', 'suspended'),
  ('10000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'resourceAssistant', 'active'),
  ('10000000-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'member', 'active'),
  ('10000000-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'member', 'suspended'),
  ('20000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'owner', 'active'),
  ('20000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'member', 'active'),
  ('20000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'owner', 'active');

INSERT INTO public.enterprise_role_permissions(
  workspace_id, role_key, feature_key, access_level
) VALUES
  ('11111111-1111-4111-8111-111111111111', 'resourceAssistant', 'admin_override', 'edit'),
  ('11111111-1111-4111-8111-111111111111', 'member', 'admin_override', 'none');

INSERT INTO public.fixture_workspace_features(workspace_id, feature_key, enabled) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin_override', true),
  ('22222222-2222-4222-8222-222222222222', 'admin_override', false);

CREATE TABLE contract.v1_before AS
SELECT
  procedure.oid,
  procedure.proowner AS owner_oid,
  pg_get_functiondef(procedure.oid) AS definition,
  procedure.proacl::text AS acl,
  procedure.proconfig::text AS config
FROM pg_proc AS procedure
WHERE procedure.oid = 'public.create_admin_leave_override(uuid,uuid,text,date,date,text,boolean,boolean,text,text)'::regprocedure;

\i /contract/migration.sql
\i /contract/migration.sql

DO $catalog_contract$
DECLARE
  v_v1_oid oid := to_regprocedure(
    'public.create_admin_leave_override(uuid,uuid,text,date,date,text,boolean,boolean,text,text)'
  )::oid;
  v_v2_oid oid := to_regprocedure(
    'public.create_admin_leave_override_v2(uuid,uuid,text,date,date,text,uuid,boolean,boolean,text,text)'
  )::oid;
  v_v1_owner oid;
  v_v2_owner oid;
BEGIN
  PERFORM contract.assert_true(v_v1_oid IS NOT NULL, 'Legacy v1 RPC signature is missing');
  PERFORM contract.assert_true(v_v2_oid IS NOT NULL, 'V2 RPC signature is missing');

  SELECT procedure.proowner
  INTO v_v1_owner
  FROM pg_proc AS procedure
  WHERE procedure.oid = v_v1_oid;

  SELECT procedure.proowner
  INTO v_v2_owner
  FROM pg_proc AS procedure
  WHERE procedure.oid = v_v2_oid;

  PERFORM contract.assert_true(
    pg_get_userbyid(v_v1_owner) NOT IN ('anon', 'authenticated', 'service_role')
    AND pg_get_userbyid(v_v2_owner) NOT IN ('anon', 'authenticated', 'service_role'),
    'V1 and v2 SECURITY DEFINER functions must have trusted owners'
  );
  PERFORM contract.assert_true(
    has_function_privilege(v_v2_owner, v_v1_oid, 'EXECUTE'),
    'V2 owner does not have EXECUTE privilege on legacy v1'
  );
  PERFORM contract.assert_true(
    (
      SELECT procedure.prosecdef
        AND array_to_string(procedure.proconfig, ',') = 'search_path=pg_catalog'
        AND owner_role.rolname NOT IN ('anon', 'authenticated', 'service_role')
      FROM pg_proc AS procedure
      JOIN pg_roles AS owner_role ON owner_role.oid = procedure.proowner
      WHERE procedure.oid = v_v2_oid
    ),
    'V2 RPC owner, SECURITY DEFINER or search_path contract is invalid'
  );
  PERFORM contract.assert_true(
    has_function_privilege(
      'authenticated',
      'public.create_admin_leave_override_v2(uuid,uuid,text,date,date,text,uuid,boolean,boolean,text,text)',
      'EXECUTE'
    )
    AND NOT has_function_privilege(
      'anon',
      'public.create_admin_leave_override_v2(uuid,uuid,text,date,date,text,uuid,boolean,boolean,text,text)',
      'EXECUTE'
    )
    AND NOT has_function_privilege(
      'service_role',
      'public.create_admin_leave_override_v2(uuid,uuid,text,date,date,text,uuid,boolean,boolean,text,text)',
      'EXECUTE'
    ),
    'V2 RPC runtime ACL is broader or narrower than authenticated-only'
  );
  PERFORM contract.assert_true(
    (
      SELECT before.oid = current.oid
        AND before.owner_oid = current.proowner
        AND before.definition = pg_get_functiondef(current.oid)
        AND before.acl IS NOT DISTINCT FROM current.proacl::text
        AND before.config IS NOT DISTINCT FROM current.proconfig::text
      FROM contract.v1_before AS before
      JOIN pg_proc AS current
        ON current.oid = 'public.create_admin_leave_override(uuid,uuid,text,date,date,text,boolean,boolean,text,text)'::regprocedure
    ),
    'Legacy v1 OID, definition, ACL or search_path changed'
  );
  PERFORM contract.assert_true(
    (
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'effectime_private.admin_leave_override_idempotency'::regclass
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_policy
      WHERE polrelid = 'effectime_private.admin_leave_override_idempotency'::regclass
    )
    AND NOT has_table_privilege(
      'authenticated',
      'effectime_private.admin_leave_override_idempotency',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    )
    AND NOT has_table_privilege(
      'service_role',
      'effectime_private.admin_leave_override_idempotency',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    ),
    'Private idempotency ledger RLS or runtime ACL contract is invalid'
  );
  PERFORM contract.assert_true(
    EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = 'public.enterprise_audit_events'::regclass
        AND tgname = 'guard_admin_leave_override_audit_mutation'
        AND NOT tgisinternal
    )
    AND NOT has_table_privilege('authenticated', 'public.enterprise_audit_events', 'TRUNCATE')
    AND NOT has_table_privilege('service_role', 'public.enterprise_audit_events', 'TRUNCATE'),
    'Reserved audit action guard or TRUNCATE revocation is missing'
  );
  RAISE NOTICE 'PASS migration replay, legacy compatibility, catalog, ACL and private ledger';
END;
$catalog_contract$;

-- Exercise the preserved v1 boundary as the real authenticated runtime role
-- after the migration and audit guard are installed. Legacy calls must retain
-- their behavior without participating in the v2-only idempotency ledger.
CREATE TABLE contract.authenticated_v1_smoke (
  response jsonb NOT NULL
);
CREATE TABLE contract.authenticated_v1_ledger_baseline AS
SELECT count(*) AS row_count
FROM effectime_private.admin_leave_override_idempotency;
GRANT INSERT ON contract.authenticated_v1_smoke TO authenticated;

SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  false
);
INSERT INTO contract.authenticated_v1_smoke(response)
SELECT public.create_admin_leave_override(
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'other',
  DATE '2026-07-19',
  DATE '2026-07-19',
  'Authenticated legacy v1 smoke',
  false,
  false,
  NULL,
  'legacy v1 smoke note'
);
RESET ROLE;

DO $authenticated_v1_smoke_contract$
DECLARE
  v_response jsonb;
  v_request_id uuid;
BEGIN
  SELECT response INTO STRICT v_response
  FROM contract.authenticated_v1_smoke;
  v_request_id := (v_response->>'request_id')::uuid;

  PERFORM contract.assert_true(
    jsonb_typeof(v_response) = 'object'
    AND v_response->'ok' = 'true'::jsonb
    AND v_response->>'status' = 'pending'
    AND (
      SELECT count(*) = 1
      FROM public.leave_requests
      WHERE id = v_request_id
        AND workspace_id = '11111111-1111-4111-8111-111111111111'
        AND user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
        AND leave_type = 'other'::public.leave_type
        AND status = 'pending'::public.leave_request_status
    )
    AND (
      SELECT count(*) = 1
      FROM public.enterprise_audit_events
      WHERE target_id = v_request_id
        AND action = 'leave_request.admin_override'
    ),
    'Authenticated legacy v1 smoke did not preserve its request and audit contract'
  );
  PERFORM contract.assert_true(
    (SELECT count(*) FROM effectime_private.admin_leave_override_idempotency)
      = (SELECT row_count FROM contract.authenticated_v1_ledger_baseline),
    'Legacy v1 unexpectedly wrote to the v2 idempotency ledger'
  );
  RAISE NOTICE 'PASS authenticated legacy v1 remains executable without ledger writes';
END;
$authenticated_v1_smoke_contract$;

DO $positive_and_replay_contract$
DECLARE
  v_pending jsonb;
  v_approved jsonb;
  v_replay jsonb;
  v_half_day jsonb;
  v_request_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
  v_pending := public.create_admin_leave_override_v2(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'vacation', DATE '2026-07-20', DATE '2026-07-20',
    'Pending contract', '90000000-0000-4000-8000-000000000001',
    false, false, NULL, 'pending note'
  );
  v_request_id := (v_pending->>'request_id')::uuid;
  PERFORM contract.assert_true(
    v_pending->>'status' = 'pending'
    AND (SELECT status = 'pending' FROM public.leave_requests WHERE id = v_request_id)
    AND NOT EXISTS (SELECT 1 FROM public.approval_decisions WHERE leave_request_id = v_request_id)
    AND NOT EXISTS (SELECT 1 FROM public.enterprise_quota_transactions WHERE leave_request_id = v_request_id)
    AND (SELECT count(*) = 1 FROM public.enterprise_audit_events WHERE target_id = v_request_id AND action = 'leave_request.admin_override'),
    'Pending override did not preserve exact request/audit/quota state'
  );

  v_approved := public.create_admin_leave_override_v2(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'vacation', DATE '2026-07-21', DATE '2026-07-21',
    'Approved contract', '90000000-0000-4000-8000-000000000002',
    true, false, NULL, 'approved note'
  );
  v_replay := public.create_admin_leave_override_v2(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'vacation', DATE '2026-07-21', DATE '2026-07-21',
    ' Approved contract ', '90000000-0000-4000-8000-000000000002',
    true, false, NULL, ' approved note '
  );
  v_request_id := (v_approved->>'request_id')::uuid;
  PERFORM contract.assert_true(
    v_replay = v_approved
    AND v_approved->>'status' = 'approved'
    AND (SELECT count(*) = 1 FROM public.leave_requests WHERE id = v_request_id AND reviewer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
    AND (SELECT count(*) = 1 FROM public.approval_decisions WHERE leave_request_id = v_request_id)
    AND (SELECT count(*) = 1 FROM public.enterprise_quota_transactions WHERE leave_request_id = v_request_id AND transaction_type = 'consume' AND amount_days = -1)
    AND (SELECT count(*) = 1 FROM public.enterprise_audit_events WHERE target_id = v_request_id AND action = 'leave_request.admin_override'),
    'Approved sequential replay was not exactly-once'
  );

  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', false);
  v_half_day := public.create_admin_leave_override_v2(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'vacation', DATE '2026-07-22', DATE '2026-07-22',
    'Assistant half day', '90000000-0000-4000-8000-000000000003',
    true, true, 'morning', NULL
  );
  v_request_id := (v_half_day->>'request_id')::uuid;
  PERFORM contract.assert_true(
    (SELECT count(*) = 1 FROM public.enterprise_quota_transactions WHERE leave_request_id = v_request_id AND amount_days = -0.5)
    AND (SELECT is_half_day AND half_day_period = 'morning' FROM public.leave_requests WHERE id = v_request_id),
    'Assistant half-day override did not consume exactly 0.5 day'
  );
  RAISE NOTICE 'PASS owner, assistant, pending, approved, half-day and sequential replay';
END;
$positive_and_replay_contract$;

-- A committed response remains replayable even when mutable authorization,
-- entitlement and target state change after the original commit. Otherwise a
-- lost response could be mistaken for a fresh rejection and the client could
-- discard the only key that prevents duplicate side effects.
DO $replay_after_control_change_contract$
DECLARE
  v_expected jsonb;
  v_replay jsonb;
  v_request_id uuid;
BEGIN
  SELECT response
  INTO STRICT v_expected
  FROM effectime_private.admin_leave_override_idempotency
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    AND idempotency_key = '90000000-0000-4000-8000-000000000003';
  v_request_id := (v_expected->>'request_id')::uuid;

  UPDATE public.enterprise_memberships
  SET status = 'suspended'
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND user_id IN (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    );
  UPDATE public.enterprise_role_permissions
  SET access_level = 'none'
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND role_key = 'resourceAssistant'
    AND feature_key = 'admin_override';
  UPDATE public.fixture_workspace_features
  SET enabled = false
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND feature_key = 'admin_override';

  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', false);
  v_replay := public.create_admin_leave_override_v2(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'vacation', DATE '2026-07-22', DATE '2026-07-22',
    ' Assistant half day ', '90000000-0000-4000-8000-000000000003',
    true, true, 'morning', NULL
  );

  PERFORM contract.assert_true(
    v_replay = v_expected
    AND (SELECT count(*) = 1 FROM public.leave_requests WHERE id = v_request_id)
    AND (SELECT count(*) = 1 FROM public.approval_decisions WHERE leave_request_id = v_request_id)
    AND (SELECT count(*) = 1 FROM public.enterprise_quota_transactions WHERE leave_request_id = v_request_id)
    AND (SELECT count(*) = 1 FROM public.enterprise_audit_events WHERE target_id = v_request_id AND action = 'leave_request.admin_override'),
    'Committed replay was blocked or duplicated after mutable control changes'
  );

  UPDATE public.enterprise_memberships
  SET status = 'active'
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND user_id IN (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    );
  UPDATE public.enterprise_role_permissions
  SET access_level = 'edit'
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND role_key = 'resourceAssistant'
    AND feature_key = 'admin_override';
  UPDATE public.fixture_workspace_features
  SET enabled = true
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND feature_key = 'admin_override';

  RAISE NOTICE 'PASS committed replay survives later control changes without duplicate effects';
END;
$replay_after_control_change_contract$;

-- Mutate a valid completed row inside caught PL/pgSQL subtransactions. The
-- named completion CHECK must reject both an incomplete response object and a
-- JSON value of the wrong type, and each failed mutation must be rolled back.
DO $completion_check_contract$
DECLARE
  v_original jsonb;
  v_after jsonb;
  v_constraint_name text;
BEGIN
  SELECT response INTO STRICT v_original
  FROM effectime_private.admin_leave_override_idempotency
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND idempotency_key = '90000000-0000-4000-8000-000000000002';

  BEGIN
    UPDATE effectime_private.admin_leave_override_idempotency
    SET response = response - 'request_id'
    WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
      AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      AND idempotency_key = '90000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Completion CHECK accepted a response without request_id';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
  END;
  SELECT response INTO STRICT v_after
  FROM effectime_private.admin_leave_override_idempotency
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND idempotency_key = '90000000-0000-4000-8000-000000000002';
  PERFORM contract.assert_true(
    v_constraint_name = 'admin_leave_override_completion_check'
    AND v_after = v_original,
    'Missing-field response was not rejected and rolled back by the completion CHECK'
  );

  v_constraint_name := NULL;
  BEGIN
    UPDATE effectime_private.admin_leave_override_idempotency
    SET response = jsonb_set(response, '{ok}', '"true"'::jsonb, false)
    WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
      AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      AND idempotency_key = '90000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Completion CHECK accepted a string-valued ok field';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
  END;
  SELECT response INTO STRICT v_after
  FROM effectime_private.admin_leave_override_idempotency
  WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
    AND actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND idempotency_key = '90000000-0000-4000-8000-000000000002';
  PERFORM contract.assert_true(
    v_constraint_name = 'admin_leave_override_completion_check'
    AND v_after = v_original,
    'Wrong-type response was not rejected and rolled back by the completion CHECK'
  );
  RAISE NOTICE 'PASS completion CHECK rejects malformed response mutations with rollback';
END;
$completion_check_contract$;

CREATE OR REPLACE FUNCTION contract.expect_override_failure(
  p_actor uuid,
  p_workspace_id uuid,
  p_target_id uuid,
  p_key uuid,
  p_expected_state text,
  p_leave_type text DEFAULT 'vacation',
  p_justification text DEFAULT 'Expected rejection',
  p_auto_approve boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_state text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_actor::text, ''), false);
  SELECT jsonb_build_array(
    (SELECT count(*) FROM public.leave_requests),
    (SELECT count(*) FROM public.approval_decisions),
    (SELECT count(*) FROM public.enterprise_quota_transactions),
    (SELECT count(*) FROM public.enterprise_audit_events),
    (SELECT count(*) FROM effectime_private.admin_leave_override_idempotency)
  ) INTO v_before;

  BEGIN
    PERFORM public.create_admin_leave_override_v2(
      p_workspace_id, p_target_id, p_leave_type,
      DATE '2026-07-23', DATE '2026-07-23', p_justification,
      p_key, p_auto_approve, false, NULL, NULL
    );
    v_state := 'unexpected-success';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLSTATE;
  END;

  SELECT jsonb_build_array(
    (SELECT count(*) FROM public.leave_requests),
    (SELECT count(*) FROM public.approval_decisions),
    (SELECT count(*) FROM public.enterprise_quota_transactions),
    (SELECT count(*) FROM public.enterprise_audit_events),
    (SELECT count(*) FROM effectime_private.admin_leave_override_idempotency)
  ) INTO v_after;
  IF v_state IS DISTINCT FROM p_expected_state OR v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'Expected SQLSTATE %, got %, state before %, after %',
      p_expected_state, v_state, v_before, v_after;
  END IF;
END;
$function$;

SELECT contract.expect_override_failure(
  NULL,
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '90000000-0000-4000-8000-000000000010',
  '42501'
);
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '90000000-0000-4000-8000-000000000011',
  '42501'
);
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '90000000-0000-4000-8000-000000000012',
  '42501'
);
SELECT contract.expect_override_failure(
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  '22222222-2222-4222-8222-222222222222',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  '90000000-0000-4000-8000-000000000013',
  '42501'
);
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  '90000000-0000-4000-8000-000000000014',
  '22023'
);
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '90000000-0000-4000-8000-000000000015',
  '22023'
);
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '90000000-0000-4000-8000-000000000016',
  '22023',
  'invalid'
);
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '90000000-0000-4000-8000-000000000002',
  '22023',
  'vacation',
  'Different payload for an existing key'
);

UPDATE public.enterprise_role_permissions
SET access_level = 'none'
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND role_key = 'resourceAssistant'
  AND feature_key = 'admin_override';
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '90000000-0000-4000-8000-000000000017',
  '42501'
);
UPDATE public.enterprise_role_permissions
SET access_level = 'edit'
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND role_key = 'resourceAssistant'
  AND feature_key = 'admin_override';
\echo 'PASS authentication, permission, entitlement, target, input and key-conflict failures'

-- The same actor and UUID key are isolated by workspace. Tenant B is enabled
-- only after its negative entitlement case above has been proven.
UPDATE public.fixture_workspace_features
SET enabled = true
WHERE workspace_id = '22222222-2222-4222-8222-222222222222'
  AND feature_key = 'admin_override';
DO $tenant_isolation_contract$
DECLARE
  v_a jsonb;
  v_b jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
  v_a := public.create_admin_leave_override_v2(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'other', DATE '2026-07-24', DATE '2026-07-24',
    'Tenant A shared key', '90000000-0000-4000-8000-000000000020',
    false, false, NULL, NULL
  );
  v_b := public.create_admin_leave_override_v2(
    '22222222-2222-4222-8222-222222222222',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'other', DATE '2026-07-24', DATE '2026-07-24',
    'Tenant B shared key', '90000000-0000-4000-8000-000000000020',
    false, false, NULL, NULL
  );
  PERFORM contract.assert_true(
    v_a->>'request_id' <> v_b->>'request_id'
    AND (
      SELECT count(*) = 2
      FROM effectime_private.admin_leave_override_idempotency
      WHERE actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
        AND idempotency_key = '90000000-0000-4000-8000-000000000020'
    ),
    'Identical actor/key pairs were not isolated by workspace'
  );
END;
$tenant_isolation_contract$;

-- Force failures at two late side-effect boundaries. The caught subtransaction
-- must roll back request, decision, quota, audit and idempotency rows together.
CREATE OR REPLACE FUNCTION contract.reject_selected_override_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.action = 'leave_request.admin_override'
     AND NEW.metadata->>'justification' = 'force-audit-failure' THEN
    RAISE EXCEPTION 'fixture forced admin override audit failure';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER zz_fixture_reject_selected_override_audit
  BEFORE INSERT ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION contract.reject_selected_override_audit();
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '90000000-0000-4000-8000-000000000030',
  'P0001',
  'vacation',
  'force-audit-failure'
);
DROP TRIGGER zz_fixture_reject_selected_override_audit ON public.enterprise_audit_events;

CREATE OR REPLACE FUNCTION contract.reject_selected_quota_consume()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.reason = 'Auto-consume on approval' THEN
    RAISE EXCEPTION 'fixture forced admin override quota failure';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER zz_fixture_reject_selected_quota_consume
  BEFORE INSERT ON public.enterprise_quota_transactions
  FOR EACH ROW EXECUTE FUNCTION contract.reject_selected_quota_consume();
SELECT contract.expect_override_failure(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '90000000-0000-4000-8000-000000000031',
  'P0001',
  'vacation',
  'force-quota-failure'
);
DROP TRIGGER zz_fixture_reject_selected_quota_consume ON public.enterprise_quota_transactions;
\echo 'PASS audit and quota failures roll back every side effect'

-- Ordinary authenticated/service clients may retain generic audit DML, but the
-- reserved action must be immutable and unforgeable even when RLS is permissive.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
DO $authenticated_audit_guard$
DECLARE
  v_target uuid;
  v_rejected boolean;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_audit_events(
      workspace_id, actor_id, action, target_type
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'leave_request.admin_override',
      'forged'
    );
    v_rejected := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Authenticated reserved audit forgery succeeded'; END IF;

  SELECT target_id INTO STRICT v_target
  FROM public.enterprise_audit_events
  WHERE action = 'leave_request.admin_override'
  LIMIT 1;
  BEGIN
    UPDATE public.enterprise_audit_events
    SET action = 'forged'
    WHERE target_id = v_target AND action = 'leave_request.admin_override';
    v_rejected := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Authenticated reserved audit update succeeded'; END IF;

  BEGIN
    DELETE FROM public.enterprise_audit_events
    WHERE target_id = v_target AND action = 'leave_request.admin_override';
    v_rejected := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Authenticated reserved audit delete succeeded'; END IF;
END;
$authenticated_audit_guard$;
RESET ROLE;

SET ROLE service_role;
DO $service_audit_guard$
DECLARE
  v_rejected boolean;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_audit_events(
      workspace_id, actor_id, action, target_type
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'leave_request.admin_override',
      'forged-service'
    );
    v_rejected := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Service reserved audit forgery succeeded'; END IF;
END;
$service_audit_guard$;
RESET ROLE;
\echo 'PASS reserved audit forge, update, delete and TRUNCATE protections'

CREATE TABLE contract.admin_override_concurrency_gate (
  id integer PRIMARY KEY,
  released boolean NOT NULL
);
INSERT INTO contract.admin_override_concurrency_gate(id, released) VALUES (1, false);

CREATE TABLE contract.admin_override_concurrency_results (
  scenario text NOT NULL,
  client text NOT NULL,
  response jsonb,
  outcome text NOT NULL,
  PRIMARY KEY (scenario, client)
);
GRANT SELECT, INSERT ON contract.admin_override_concurrency_results TO authenticated;

CREATE OR REPLACE FUNCTION contract.wait_for_admin_override_release()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'contract'
AS $function$
DECLARE
  v_attempt integer;
BEGIN
  FOR v_attempt IN 1..600 LOOP
    IF EXISTS (
      SELECT 1
      FROM contract.admin_override_concurrency_gate AS gate
      WHERE gate.id = 1 AND gate.released
    ) THEN
      RETURN;
    END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  RAISE EXCEPTION 'Timed out waiting for admin override concurrency release';
END;
$function$;
REVOKE ALL ON FUNCTION contract.wait_for_admin_override_release() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contract.wait_for_admin_override_release() TO authenticated;

SELECT 'admin_leave_override_base_contract_passed' AS assertion;
\endif
