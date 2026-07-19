\set ON_ERROR_STOP on
SET client_min_messages TO notice;

-- The same contract drives deterministic two-session authorization races after
-- the base fixture has been installed. Session A exposes an advisory barrier
-- while holding the row lock; the runner starts session B, proves it is waiting
-- on A, and only then releases the database gate.
\if :{?HR_REASSIGN_A}
SET application_name TO 'effectime-hr-reassign-a';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
UPDATE public.enterprise_hr_workflow_tasks
SET assignee_membership_id = 'a1000000-0000-4000-8000-000000000003'
WHERE title = 'concurrency-reassign';
SELECT pg_advisory_xact_lock(734552, 1);
SELECT contract.wait_for_hr_release();
COMMIT;
\elif :{?HR_REASSIGN_B}
SET application_name TO 'effectime-hr-reassign-b';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
DO $reassign_old_assignee$
DECLARE
  v_task_id uuid := 'aa300000-0000-4000-8000-000000000005';
BEGIN
  BEGIN
    PERFORM public.hr_workflow_update_task(v_task_id, 'done');
    INSERT INTO contract.hr_concurrency_results(scenario, outcome)
    VALUES ('reassign', 'unexpected-success');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO contract.hr_concurrency_results(scenario, outcome)
    VALUES ('reassign', 'denied-after-lock');
  END;
END;
$reassign_old_assignee$;
COMMIT;
\elif :{?HR_REASSIGN_VERIFY}
SELECT contract.assert_true(
  (
    SELECT assignee_membership_id = 'a1000000-0000-4000-8000-000000000003'
       AND status = 'pending'
    FROM public.enterprise_hr_workflow_tasks
    WHERE title = 'concurrency-reassign'
  ),
  'Concurrent reassignment did not preserve the new assignee and pending status'
);
SELECT contract.assert_true(
  (
    SELECT count(*) = 1
    FROM contract.hr_concurrency_results
    WHERE scenario = 'reassign' AND outcome = 'denied-after-lock'
  ),
  'Old assignee was not denied after the reassignment lock committed'
);
SELECT 'hr_reassignment_concurrency_contract_passed' AS assertion;
\elif :{?HR_SUSPEND_A}
SET application_name TO 'effectime-hr-suspend-a';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
UPDATE public.enterprise_memberships
SET status = 'suspended'::public.enterprise_membership_status
WHERE id = 'a1000000-0000-4000-8000-000000000009';
SELECT pg_advisory_xact_lock(734552, 2);
SELECT contract.wait_for_hr_release();
COMMIT;
\elif :{?HR_SUSPEND_B}
SET application_name TO 'effectime-hr-suspend-b';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000009', true);
DO $suspended_assignee$
DECLARE
  v_task_id uuid := 'aa300000-0000-4000-8000-000000000006';
BEGIN
  BEGIN
    PERFORM public.hr_workflow_update_task(v_task_id, 'done');
    INSERT INTO contract.hr_concurrency_results(scenario, outcome)
    VALUES ('suspend', 'unexpected-success');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO contract.hr_concurrency_results(scenario, outcome)
    VALUES ('suspend', 'denied-after-lock');
  END;
END;
$suspended_assignee$;
COMMIT;
\elif :{?HR_SUSPEND_VERIFY}
SELECT contract.assert_true(
  (
    SELECT status = 'pending' AND completed_at IS NULL AND completed_by IS NULL
    FROM public.enterprise_hr_workflow_tasks
    WHERE title = 'concurrency-suspend'
  ),
  'Concurrent suspension changed the protected task'
);
SELECT contract.assert_true(
  (
    SELECT count(*) = 1
    FROM contract.hr_concurrency_results
    WHERE scenario = 'suspend' AND outcome = 'denied-after-lock'
  ),
  'Suspended assignee was not denied after the membership lock committed'
);
SELECT 'hr_suspension_concurrency_contract_passed' AS assertion;
\elif :{?HR_DIRECT_SUSPEND_A}
SET application_name TO 'effectime-hr-direct-suspend-a';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
UPDATE public.enterprise_memberships
SET status = 'suspended'::public.enterprise_membership_status
WHERE id = 'a1000000-0000-4000-8000-000000000003';
SELECT pg_advisory_xact_lock(734552, 3);
SELECT contract.wait_for_hr_release();
COMMIT;
\elif :{?HR_DIRECT_SUSPEND_B}
SET application_name TO 'effectime-hr-direct-suspend-b';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
DO $direct_insert_during_suspension$
BEGIN
  BEGIN
    INSERT INTO public.enterprise_hr_workflow_tasks(
      workspace_id, instance_id, title, assignee_membership_id
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'aa200000-0000-4000-8000-000000000002',
      'direct-suspension-race',
      'a1000000-0000-4000-8000-000000000003'
    );
    INSERT INTO contract.hr_concurrency_results(scenario, outcome)
    VALUES ('direct-suspend', 'unexpected-success');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO contract.hr_concurrency_results(scenario, outcome)
    VALUES ('direct-suspend', 'denied-after-lock');
  END;
END;
$direct_insert_during_suspension$;
COMMIT;
\elif :{?HR_DIRECT_SUSPEND_VERIFY}
SELECT contract.assert_true(
  (
    SELECT status = 'suspended'::public.enterprise_membership_status
    FROM public.enterprise_memberships
    WHERE id = 'a1000000-0000-4000-8000-000000000003'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_tasks
    WHERE title = 'direct-suspension-race'
  ),
  'Concurrent direct insert retained a newly suspended assignee'
);
SELECT contract.assert_true(
  (
    SELECT count(*) = 1
    FROM contract.hr_concurrency_results
    WHERE scenario = 'direct-suspend' AND outcome = 'denied-after-lock'
  ),
  'Direct insert was not denied after the membership suspension committed'
);
SELECT 'hr_direct_suspension_concurrency_contract_passed' AS assertion;
\elif :{?HR_TEMPLATE_DEACTIVATE_A}
SET application_name TO 'effectime-hr-template-deactivate-a';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
UPDATE public.enterprise_hr_workflow_templates
SET is_active = false
WHERE id = 'aa000000-0000-4000-8000-000000000001';
SELECT pg_advisory_xact_lock(734552, 4);
SELECT contract.wait_for_hr_release();
COMMIT;
\elif :{?HR_TEMPLATE_DEACTIVATE_B}
SET application_name TO 'effectime-hr-template-deactivate-b';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
DO $direct_insert_during_template_deactivation$
BEGIN
  BEGIN
    INSERT INTO public.enterprise_hr_workflow_instances(
      workspace_id, template_id, membership_id, title
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'aa000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001',
      'template-deactivation-race'
    );
    INSERT INTO contract.hr_concurrency_results(scenario, outcome)
    VALUES ('template-deactivate', 'unexpected-success');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO contract.hr_concurrency_results(scenario, outcome)
    VALUES ('template-deactivate', 'denied-after-lock');
  END;
END;
$direct_insert_during_template_deactivation$;
COMMIT;
\elif :{?HR_TEMPLATE_DEACTIVATE_VERIFY}
SELECT contract.assert_true(
  NOT (SELECT is_active FROM public.enterprise_hr_workflow_templates
       WHERE id = 'aa000000-0000-4000-8000-000000000001')
  AND NOT EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_instances
    WHERE title = 'template-deactivation-race'
  ),
  'Concurrent direct insert retained a deactivated template'
);
SELECT contract.assert_true(
  (
    SELECT count(*) = 1
    FROM contract.hr_concurrency_results
    WHERE scenario = 'template-deactivate' AND outcome = 'denied-after-lock'
  ),
  'Direct insert was not denied after template deactivation committed'
);
SELECT 'hr_template_deactivation_concurrency_contract_passed' AS assertion;
\else

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS contract;

DO $roles$
BEGIN
  BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END;
END;
$roles$;

GRANT USAGE ON SCHEMA public, auth, contract TO anon, authenticated, service_role;

CREATE TYPE public.enterprise_role AS ENUM ('owner', 'resourceAssistant', 'member');
CREATE TYPE public.enterprise_membership_status AS ENUM (
  'active', 'invited', 'suspended', 'removed'
);

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $function$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $function$
  SELECT current_user::text;
$function$;

GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated, service_role;

CREATE TABLE public.enterprise_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.enterprise_memberships (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.enterprise_role NOT NULL DEFAULT 'member',
  status public.enterprise_membership_status NOT NULL DEFAULT 'active',
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text
);

CREATE OR REPLACE FUNCTION public.has_enterprise_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_roles public.enterprise_role[]
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.workspace_id = p_workspace_id
      AND membership.user_id = p_user_id
      AND membership.status = 'active'::public.enterprise_membership_status
      AND membership.role = ANY (p_roles)
  );
$function$;

GRANT EXECUTE ON FUNCTION public.has_enterprise_role(
  uuid, uuid, public.enterprise_role[]
) TO anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.enterprise_memberships TO authenticated;

CREATE OR REPLACE FUNCTION contract.assert_true(p_condition boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$function$;

\i /contract/base-migration.sql

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.enterprise_hr_workflow_templates,
     public.enterprise_hr_workflow_instances,
     public.enterprise_hr_workflow_tasks
  TO authenticated;

INSERT INTO auth.users(id, email) VALUES
  ('10000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'member-a@example.test'),
  ('10000000-0000-4000-8000-000000000003', 'other-a@example.test'),
  ('10000000-0000-4000-8000-000000000004', 'invited-a@example.test'),
  ('10000000-0000-4000-8000-000000000005', 'suspended-a@example.test'),
  ('10000000-0000-4000-8000-000000000006', 'removed-a@example.test'),
  ('10000000-0000-4000-8000-000000000007', 'cascade-a@example.test'),
  ('10000000-0000-4000-8000-000000000008', 'set-null-a@example.test'),
  ('10000000-0000-4000-8000-000000000009', 'race-a@example.test'),
  ('20000000-0000-4000-8000-000000000001', 'owner-b@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'member-b@example.test');

INSERT INTO public.profiles(user_id, display_name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Owner A'),
  ('10000000-0000-4000-8000-000000000002', 'Member A'),
  ('10000000-0000-4000-8000-000000000003', 'Other A'),
  ('10000000-0000-4000-8000-000000000009', 'Race A'),
  ('20000000-0000-4000-8000-000000000001', 'Owner B'),
  ('20000000-0000-4000-8000-000000000002', 'SECRET MEMBER B');

INSERT INTO public.enterprise_workspaces(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Workspace A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Workspace B');

INSERT INTO public.enterprise_memberships(id, workspace_id, user_id, role, status) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000002', 'member', 'active'),
  ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000003', 'member', 'active'),
  ('a1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000004', 'member', 'invited'),
  ('a1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000005', 'member', 'suspended'),
  ('a1000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000006', 'member', 'removed'),
  ('a1000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000007', 'member', 'active'),
  ('a1000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000008', 'member', 'active'),
  ('a1000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '10000000-0000-4000-8000-000000000009', 'member', 'active'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '20000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('b1000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '20000000-0000-4000-8000-000000000002', 'member', 'active');

INSERT INTO public.enterprise_hr_workflow_templates(
  id, workspace_id, name, category, steps, is_active
) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Active A', 'custom', '[{"title":"Step A"}]', true),
  ('aa000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Inactive A', 'custom', '[]', false),
  ('bb000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Active B', 'custom', '[{"title":"Step B"}]', true);

-- Legacy malformed rows are intentionally seeded before the repair migration.
-- The repair must leave them bit-for-bit intact while making them fail closed.
INSERT INTO public.enterprise_hr_workflow_instances(
  id, workspace_id, template_id, membership_id, title, category, status
) VALUES
  ('aa200000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bb000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'legacy-cross-member', 'custom', 'open'),
  ('aa200000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aa000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'valid-a-instance', 'custom', 'open'),
  ('bb200000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'bb000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'valid-b-instance', 'custom', 'open'),
  ('aa200000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', NULL, 'a1000000-0000-4000-8000-000000000002', 'idempotent-close', 'custom', 'open'),
  ('aa200000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', NULL, 'a1000000-0000-4000-8000-000000000002', 'concurrency-reassign-parent', 'custom', 'open'),
  ('aa200000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', NULL, 'a1000000-0000-4000-8000-000000000009', 'concurrency-suspend-parent', 'custom', 'open');

INSERT INTO public.enterprise_hr_workflow_tasks(
  id, workspace_id, instance_id, title, assignee_membership_id, status
) VALUES
  ('aa300000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aa200000-0000-4000-8000-000000000001', 'same-workspace-count', 'a1000000-0000-4000-8000-000000000002', 'pending'),
  ('bb300000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aa200000-0000-4000-8000-000000000001', 'cross-workspace-count', 'b1000000-0000-4000-8000-000000000002', 'done'),
  ('aa300000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aa200000-0000-4000-8000-000000000002', 'valid-assignee-task', 'a1000000-0000-4000-8000-000000000002', 'pending'),
  ('aa300000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aa200000-0000-4000-8000-000000000002', 'legacy-cross-assignee', 'b1000000-0000-4000-8000-000000000002', 'pending'),
  ('aa300000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bb200000-0000-4000-8000-000000000001', 'legacy-cross-instance', 'a1000000-0000-4000-8000-000000000002', 'pending'),
  ('aa300000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aa200000-0000-4000-8000-000000000004', 'concurrency-reassign', 'a1000000-0000-4000-8000-000000000002', 'pending'),
  ('aa300000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aa200000-0000-4000-8000-000000000005', 'concurrency-suspend', 'a1000000-0000-4000-8000-000000000009', 'pending');

\i /contract/migration.sql
\i /contract/migration.sql

-- A24/A25: legacy malformed rows survive and the migration is safely re-runnable.
SELECT contract.assert_true(
  (SELECT count(*) = 1 FROM public.enterprise_hr_workflow_instances WHERE title = 'legacy-cross-member'),
  'Migration rewrote or deleted a legacy malformed instance'
);
SELECT contract.assert_true(
  (SELECT count(*) = 1 FROM public.enterprise_hr_workflow_tasks WHERE title = 'legacy-cross-instance'),
  'Migration rewrote or deleted a legacy malformed task'
);
SELECT contract.assert_true(
  (
    SELECT count(*) = 6
    FROM pg_catalog.pg_trigger
    WHERE tgname IN (
      'hr_wf_templates_tenant_guard',
      'hr_wf_instances_tenant_guard',
      'hr_wf_tasks_tenant_guard',
      'hr_wf_templates_parent_delete_guard',
      'hr_wf_instances_parent_delete_guard',
      'hr_wf_memberships_parent_change_guard'
    )
      AND NOT tgisinternal
  ),
  'Tenant guard triggers were duplicated or are missing'
);

-- A01/A02: user-context RPCs are never callable by anon or service_role.
SELECT contract.assert_true(
  NOT pg_catalog.has_function_privilege('anon', 'public.hr_workflow_create_instance(uuid,uuid,uuid,text,text,date,text,text)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('anon', 'public.hr_workflow_update_task(uuid,text)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('anon', 'public.hr_workflow_close_instance(uuid,text)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('anon', 'public.hr_workflow_list_instances(uuid,text,text)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('anon', 'effectime_private.hr_workflow_can_read_assigned_task(uuid)', 'EXECUTE'),
  'anon retained HR workflow RPC execution'
);
SELECT contract.assert_true(
  NOT pg_catalog.has_function_privilege('service_role', 'public.hr_workflow_create_instance(uuid,uuid,uuid,text,text,date,text,text)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('service_role', 'public.hr_workflow_update_task(uuid,text)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('service_role', 'public.hr_workflow_close_instance(uuid,text)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('service_role', 'public.hr_workflow_list_instances(uuid,text,text)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('service_role', 'effectime_private.hr_workflow_can_read_assigned_task(uuid)', 'EXECUTE'),
  'service_role retained user-context HR workflow RPC execution'
);
SELECT contract.assert_true(
  pg_catalog.has_function_privilege('authenticated', 'public.hr_workflow_create_instance(uuid,uuid,uuid,text,text,date,text,text)', 'EXECUTE')
  AND pg_catalog.has_function_privilege('authenticated', 'public.hr_workflow_update_task(uuid,text)', 'EXECUTE')
  AND pg_catalog.has_function_privilege('authenticated', 'public.hr_workflow_close_instance(uuid,text)', 'EXECUTE')
  AND pg_catalog.has_function_privilege('authenticated', 'public.hr_workflow_list_instances(uuid,text,text)', 'EXECUTE')
  AND pg_catalog.has_function_privilege('authenticated', 'effectime_private.hr_workflow_can_read_assigned_task(uuid)', 'EXECUTE'),
  'authenticated lost the compatible HR workflow RPC contract'
);
SELECT contract.assert_true(
  pg_catalog.has_schema_privilege('authenticated', 'effectime_private', 'USAGE')
  AND NOT pg_catalog.has_schema_privilege('authenticated', 'effectime_private', 'CREATE')
  AND NOT pg_catalog.has_schema_privilege('anon', 'effectime_private', 'USAGE')
  AND NOT pg_catalog.has_schema_privilege('service_role', 'effectime_private', 'USAGE'),
  'Private HR workflow helper schema ACL is broader than required'
);

-- A03: an ordinary member receives an authorization error, not an empty admin list.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
DO $ordinary_member_denied$
BEGIN
  BEGIN
    PERFORM public.hr_workflow_create_instance(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', NULL, NULL, 'forbidden-create'
    );
    RAISE EXCEPTION 'Ordinary member unexpectedly created a workflow';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM 1 FROM public.hr_workflow_list_instances(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', NULL, NULL
    );
    RAISE EXCEPTION 'Ordinary member unexpectedly received the admin workflow list';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.hr_workflow_close_instance(
      'aa200000-0000-4000-8000-000000000002', 'completed'
    );
    RAISE EXCEPTION 'Ordinary member unexpectedly closed a workflow';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$ordinary_member_denied$;
RESET ROLE;

-- A04-A08: valid admin create stays compatible; cross-tenant/inactive refs fail.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
DO $admin_create_contract$
DECLARE
  v_instance_id uuid;
  v_invalid_membership uuid;
BEGIN
  v_instance_id := public.hr_workflow_create_instance(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    NULL,
    'a1000000-0000-4000-8000-000000000002',
    'valid-admin-create'
  );
  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'Valid owner create did not return a UUID';
  END IF;

  BEGIN
    PERFORM public.hr_workflow_create_instance(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'bb000000-0000-4000-8000-000000000001',
      NULL,
      'cross-template-create'
    );
    RAISE EXCEPTION 'Cross-workspace template create unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.hr_workflow_create_instance(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      NULL,
      'b1000000-0000-4000-8000-000000000002',
      'cross-membership-create'
    );
    RAISE EXCEPTION 'Cross-workspace membership create unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  FOREACH v_invalid_membership IN ARRAY ARRAY[
    'a1000000-0000-4000-8000-000000000004'::uuid,
    'a1000000-0000-4000-8000-000000000005'::uuid,
    'a1000000-0000-4000-8000-000000000006'::uuid
  ] LOOP
    BEGIN
      PERFORM public.hr_workflow_create_instance(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', NULL, v_invalid_membership, 'inactive-member-create'
      );
      RAISE EXCEPTION 'Inactive membership create unexpectedly succeeded';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;

  BEGIN
    PERFORM public.hr_workflow_create_instance(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'aa000000-0000-4000-8000-000000000002',
      NULL,
      'inactive-template-create'
    );
    RAISE EXCEPTION 'Inactive template create unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$admin_create_contract$;
RESET ROLE;

-- A09-A11: direct admin writes cannot create or update tenant-invalid relations.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
DO $direct_write_guards$
BEGIN
  BEGIN
    UPDATE public.enterprise_hr_workflow_templates
    SET workspace_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
    WHERE id = 'aa000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'HR workflow template workspace unexpectedly changed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.enterprise_hr_workflow_instances(
      workspace_id, template_id, membership_id, title
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'bb000000-0000-4000-8000-000000000001',
      NULL,
      'direct-cross-template'
    );
    RAISE EXCEPTION 'Direct cross-workspace template insert unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.enterprise_hr_workflow_instances(
      workspace_id, membership_id, title
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'b1000000-0000-4000-8000-000000000002',
      'direct-cross-member'
    );
    RAISE EXCEPTION 'Direct cross-workspace membership insert unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.enterprise_hr_workflow_instances
    SET membership_id = 'b1000000-0000-4000-8000-000000000002'
    WHERE id = 'aa200000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Direct cross-workspace membership update unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.enterprise_hr_workflow_tasks(
      workspace_id, instance_id, title
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'bb200000-0000-4000-8000-000000000001',
      'direct-cross-instance'
    );
    RAISE EXCEPTION 'Direct cross-workspace instance task insert unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.enterprise_hr_workflow_tasks(
      workspace_id, instance_id, title, assignee_membership_id
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'aa200000-0000-4000-8000-000000000002',
      'direct-inactive-assignee',
      'a1000000-0000-4000-8000-000000000005'
    );
    RAISE EXCEPTION 'Direct inactive assignee insert unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.enterprise_hr_workflow_tasks(
      workspace_id, instance_id, title, assignee_membership_id
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'aa200000-0000-4000-8000-000000000002',
      'direct-cross-assignee',
      'b1000000-0000-4000-8000-000000000002'
    );
    RAISE EXCEPTION 'Direct cross-workspace assignee insert unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.enterprise_hr_workflow_tasks
    SET assignee_membership_id = 'b1000000-0000-4000-8000-000000000002'
    WHERE id = 'aa300000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Direct cross-workspace assignee update unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.enterprise_hr_workflow_tasks(
    id, workspace_id, instance_id, title, assignee_membership_id, status
  ) VALUES (
    'aa300000-0000-4000-8000-000000000007',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'aa200000-0000-4000-8000-000000000002',
    'delegated-assignee-task',
    'a1000000-0000-4000-8000-000000000003',
    'pending'
  );

  INSERT INTO public.enterprise_hr_workflow_templates(
    id, workspace_id, name, category, steps, is_active
  ) VALUES (
    'aa000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'same-workspace-set-null-template',
    'custom',
    '[]'::jsonb,
    true
  );
  INSERT INTO public.enterprise_hr_workflow_instances(
    id, workspace_id, template_id, membership_id, title, category, status
  ) VALUES (
    'aa200000-0000-4000-8000-000000000007',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'aa000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000007',
    'same-workspace-membership-cascade',
    'custom',
    'open'
  );
  INSERT INTO public.enterprise_hr_workflow_tasks(
    id, workspace_id, instance_id, title, assignee_membership_id, status
  ) VALUES (
    'aa300000-0000-4000-8000-000000000009',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'aa200000-0000-4000-8000-000000000002',
    'same-workspace-assignee-set-null',
    'a1000000-0000-4000-8000-000000000008',
    'pending'
  );

  INSERT INTO public.enterprise_hr_workflow_instances(
    workspace_id, membership_id, title
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    NULL,
    'direct-valid-null'
  );
END;
$direct_write_guards$;
RESET ROLE;

-- A12/A13: malformed A rows never become visible or mutable through the
-- referenced B membership.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
DO $legacy_rls_fail_closed$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.enterprise_hr_workflow_instances
  WHERE title = 'legacy-cross-member';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-workspace member could read a malformed instance';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.enterprise_hr_workflow_tasks
  WHERE title = 'legacy-cross-assignee';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-workspace assignee could read a malformed task';
  END IF;

  BEGIN
    PERFORM public.hr_workflow_update_task(
      'aa300000-0000-4000-8000-000000000003', 'done'
    );
    RAISE EXCEPTION 'Cross-workspace assignee unexpectedly updated a malformed task';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$legacy_rls_fail_closed$;
RESET ROLE;

-- A28: a tenant-B parent delete cannot cascade into a malformed tenant-A task,
-- while a valid same-workspace instance retains the historical cascade behavior.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
DO $cross_tenant_parent_delete_guard$
BEGIN
  INSERT INTO public.enterprise_hr_workflow_instances(
    id, workspace_id, membership_id, title, category, status
  ) VALUES (
    'bb200000-0000-4000-8000-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'b1000000-0000-4000-8000-000000000002',
    'same-workspace-delete-parent',
    'custom',
    'open'
  );
  INSERT INTO public.enterprise_hr_workflow_tasks(
    id, workspace_id, instance_id, title, assignee_membership_id, status
  ) VALUES (
    'bb300000-0000-4000-8000-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'bb200000-0000-4000-8000-000000000002',
    'same-workspace-delete-child',
    'b1000000-0000-4000-8000-000000000002',
    'pending'
  );

  DELETE FROM public.enterprise_hr_workflow_instances
  WHERE id = 'bb200000-0000-4000-8000-000000000002';
  IF EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_tasks
    WHERE id = 'bb300000-0000-4000-8000-000000000002'
  ) THEN
    RAISE EXCEPTION 'Valid same-workspace instance delete did not cascade';
  END IF;

  BEGIN
    DELETE FROM public.enterprise_hr_workflow_instances
    WHERE id = 'bb200000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Cross-workspace legacy child was deleted through parent cascade';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM public.enterprise_hr_workflow_templates
    WHERE id = 'bb000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Cross-workspace legacy instance was changed through template delete';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END;
$cross_tenant_parent_delete_guard$;
RESET ROLE;

DO $cross_tenant_membership_delete_guard$
BEGIN
  BEGIN
    UPDATE public.enterprise_memberships
    SET workspace_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    WHERE id = 'b1000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Referenced membership workspace unexpectedly changed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM public.enterprise_memberships
    WHERE id = 'b1000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Cross-workspace workflow rows changed through membership delete';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END;
$cross_tenant_membership_delete_guard$;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_instances
    WHERE id = 'bb200000-0000-4000-8000-000000000001'
  )
  AND EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_tasks
    WHERE id = 'aa300000-0000-4000-8000-000000000004'
      AND workspace_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  )
  AND EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_templates
    WHERE id = 'bb000000-0000-4000-8000-000000000001'
  )
  AND EXISTS (
    SELECT 1
    FROM public.enterprise_memberships
    WHERE id = 'b1000000-0000-4000-8000-000000000002'
  ),
  'Cross-tenant parent delete changed protected instance/task rows'
);

-- A29: guards do not break the historical same-workspace SET NULL/CASCADE
-- semantics that the UI and PostgREST relationships rely on.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
DELETE FROM public.enterprise_hr_workflow_templates
WHERE id = 'aa000000-0000-4000-8000-000000000003';
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT template_id IS NULL
    FROM public.enterprise_hr_workflow_instances
    WHERE id = 'aa200000-0000-4000-8000-000000000007'
  ),
  'Valid same-workspace template delete did not preserve SET NULL behavior'
);

DELETE FROM public.enterprise_memberships
WHERE id IN (
  'a1000000-0000-4000-8000-000000000007',
  'a1000000-0000-4000-8000-000000000008'
);

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_instances
    WHERE id = 'aa200000-0000-4000-8000-000000000007'
  )
  AND EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_tasks
    WHERE id = 'aa300000-0000-4000-8000-000000000009'
      AND assignee_membership_id IS NULL
  ),
  'Valid same-workspace membership CASCADE/assignee SET NULL behavior changed'
);

-- The same-workspace assignee sees valid rows, but a malformed parent-instance
-- relation remains hidden even when the task's assignee itself is valid.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
DO $member_rls_positive_and_parent_guard$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.enterprise_hr_workflow_instances
  WHERE id = 'aa200000-0000-4000-8000-000000000002';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Active instance member could not read their valid instance';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.enterprise_hr_workflow_tasks
  WHERE id = 'aa300000-0000-4000-8000-000000000002';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Active assignee could not read their valid task';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.enterprise_hr_workflow_tasks
  WHERE id = 'aa300000-0000-4000-8000-000000000004';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Assignee could read a task with a cross-workspace parent instance';
  END IF;
END;
$member_rls_positive_and_parent_guard$;
RESET ROLE;

-- A14/A15: admin list joins are tenant-correlated and cross-tenant admins error.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
DO $admin_list_contract$
DECLARE
  v_name text;
  v_total bigint;
  v_done bigint;
BEGIN
  SELECT member_name, total_tasks, done_tasks
  INTO v_name, v_total, v_done
  FROM public.hr_workflow_list_instances(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', NULL, NULL
  )
  WHERE title = 'legacy-cross-member';

  IF NOT FOUND
     OR v_name IS DISTINCT FROM 'Ismeretlen'
     OR v_total IS DISTINCT FROM 1
     OR v_done IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Admin list leaked cross-workspace PII or task counts: %, %, %', v_name, v_total, v_done;
  END IF;
END;
$admin_list_contract$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
DO $cross_workspace_admin_denied$
BEGIN
  BEGIN
    PERFORM 1 FROM public.hr_workflow_list_instances(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', NULL, NULL
    );
    RAISE EXCEPTION 'Workspace B admin unexpectedly listed workspace A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.hr_workflow_close_instance(
      'aa200000-0000-4000-8000-000000000002', 'completed'
    );
    RAISE EXCEPTION 'Workspace B admin unexpectedly closed workspace A instance';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$cross_workspace_admin_denied$;
RESET ROLE;

-- A16-A19/A22/A27: delegated assignee visibility, authorization, validation
-- and idempotent retry. The instance member intentionally differs from the task
-- assignee so parent-instance RLS cannot hide a legitimately assigned task.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false);
DO $non_assignee_denied$
DECLARE
  v_visible bigint;
BEGIN
  SELECT count(*) INTO v_visible
  FROM public.enterprise_hr_workflow_tasks
  WHERE id = 'aa300000-0000-4000-8000-000000000007';
  IF v_visible <> 1 THEN
    RAISE EXCEPTION 'Delegated assignee could not read their task';
  END IF;

  PERFORM public.hr_workflow_update_task(
    'aa300000-0000-4000-8000-000000000007', 'done'
  );

  BEGIN
    PERFORM public.hr_workflow_update_task(
      'aa300000-0000-4000-8000-000000000002', 'done'
    );
    RAISE EXCEPTION 'Non-assignee unexpectedly updated a task';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$non_assignee_denied$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
DO $active_assignee_contract$
BEGIN
  PERFORM public.hr_workflow_update_task(
    'aa300000-0000-4000-8000-000000000002', 'done'
  );

  BEGIN
    PERFORM public.hr_workflow_update_task(
      'aa300000-0000-4000-8000-000000000002', 'arbitrary'
    );
    RAISE EXCEPTION 'Invalid task status unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.hr_workflow_update_task(
      'aa300000-0000-4000-8000-000000000004', 'done'
    );
    RAISE EXCEPTION 'Malformed cross-workspace parent task unexpectedly updated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$active_assignee_contract$;
RESET ROLE;

CREATE TABLE contract.hr_task_retry_baseline AS
SELECT completed_at, completed_by
FROM public.enterprise_hr_workflow_tasks
WHERE id = 'aa300000-0000-4000-8000-000000000002';

SELECT pg_catalog.pg_sleep(0.02);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
SELECT public.hr_workflow_update_task(
  'aa300000-0000-4000-8000-000000000002', 'done'
);
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT task.completed_at = baseline.completed_at
       AND task.completed_by = baseline.completed_by
    FROM public.enterprise_hr_workflow_tasks AS task
    CROSS JOIN contract.hr_task_retry_baseline AS baseline
    WHERE task.id = 'aa300000-0000-4000-8000-000000000002'
  ),
  'Idempotent done retry changed completion evidence'
);

UPDATE public.enterprise_memberships
SET status = 'suspended'::public.enterprise_membership_status
WHERE id = 'a1000000-0000-4000-8000-000000000002';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
DO $suspended_assignee_denied$
BEGIN
  BEGIN
    PERFORM public.hr_workflow_update_task(
      'aa300000-0000-4000-8000-000000000001', 'done'
    );
    RAISE EXCEPTION 'Suspended assignee unexpectedly updated a task';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$suspended_assignee_denied$;
RESET ROLE;

UPDATE public.enterprise_memberships
SET status = 'active'::public.enterprise_membership_status
WHERE id = 'a1000000-0000-4000-8000-000000000002';

-- A23: a repeated close with the same terminal state preserves completed_at.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT public.hr_workflow_close_instance(
  'aa200000-0000-4000-8000-000000000003', 'completed'
);
RESET ROLE;

CREATE TABLE contract.hr_close_retry_baseline AS
SELECT completed_at
FROM public.enterprise_hr_workflow_instances
WHERE id = 'aa200000-0000-4000-8000-000000000003';

SELECT pg_catalog.pg_sleep(0.02);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT public.hr_workflow_close_instance(
  'aa200000-0000-4000-8000-000000000003', 'completed'
);
DO $invalid_close_status$
BEGIN
  BEGIN
    PERFORM public.hr_workflow_close_instance(
      'aa200000-0000-4000-8000-000000000003', 'open'
    );
    RAISE EXCEPTION 'Invalid close status unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$invalid_close_status$;
RESET ROLE;

SELECT contract.assert_true(
  (
    SELECT instance.completed_at = baseline.completed_at
    FROM public.enterprise_hr_workflow_instances AS instance
    CROSS JOIN contract.hr_close_retry_baseline AS baseline
    WHERE instance.id = 'aa200000-0000-4000-8000-000000000003'
  ),
  'Idempotent close retry changed completed_at'
);

-- A26: public names/signatures and the original PostgREST FK relationships remain.
SELECT contract.assert_true(
  pg_catalog.to_regprocedure('public.hr_workflow_create_instance(uuid,uuid,uuid,text,text,date,text,text)') IS NOT NULL
  AND pg_catalog.to_regprocedure('public.hr_workflow_update_task(uuid,text)') IS NOT NULL
  AND pg_catalog.to_regprocedure('public.hr_workflow_close_instance(uuid,text)') IS NOT NULL
  AND pg_catalog.to_regprocedure('public.hr_workflow_list_instances(uuid,text,text)') IS NOT NULL,
  'Compatible HR workflow RPC signatures changed'
);
SELECT contract.assert_true(
  COALESCE((
    SELECT confdeltype = 'n'
       AND pg_catalog.pg_get_constraintdef(oid) LIKE
         'FOREIGN KEY (template_id) REFERENCES enterprise_hr_workflow_templates(id) ON DELETE SET NULL%'
    FROM pg_catalog.pg_constraint
    WHERE conname = 'enterprise_hr_workflow_instances_template_id_fkey'
      AND conrelid = 'public.enterprise_hr_workflow_instances'::regclass
  ), false)
  AND COALESCE((
    SELECT confdeltype = 'c'
       AND pg_catalog.pg_get_constraintdef(oid) LIKE
         'FOREIGN KEY (membership_id) REFERENCES enterprise_memberships(id) ON DELETE CASCADE%'
    FROM pg_catalog.pg_constraint
    WHERE conname = 'enterprise_hr_workflow_instances_membership_id_fkey'
      AND conrelid = 'public.enterprise_hr_workflow_instances'::regclass
  ), false)
  AND COALESCE((
    SELECT confdeltype = 'c'
       AND pg_catalog.pg_get_constraintdef(oid) LIKE
         'FOREIGN KEY (instance_id) REFERENCES enterprise_hr_workflow_instances(id) ON DELETE CASCADE%'
    FROM pg_catalog.pg_constraint
    WHERE conname = 'enterprise_hr_workflow_tasks_instance_id_fkey'
      AND conrelid = 'public.enterprise_hr_workflow_tasks'::regclass
  ), false)
  AND COALESCE((
    SELECT confdeltype = 'n'
       AND pg_catalog.pg_get_constraintdef(oid) LIKE
         'FOREIGN KEY (assignee_membership_id) REFERENCES enterprise_memberships(id) ON DELETE SET NULL%'
    FROM pg_catalog.pg_constraint
    WHERE conname = 'enterprise_hr_workflow_tasks_assignee_membership_id_fkey'
      AND conrelid = 'public.enterprise_hr_workflow_tasks'::regclass
  ), false),
  'Existing PostgREST HR workflow relationship columns/actions changed'
);

-- PostgREST named arguments/defaults and the list return shape are public API.
SELECT contract.assert_true(
  COALESCE((
    SELECT prosecdef
       AND proconfig @> ARRAY['search_path=pg_catalog']::text[]
       AND pronargdefaults = 7
       AND pg_catalog.pg_get_expr(proargdefaults, 0) =
         'NULL::uuid, NULL::uuid, NULL::text, ''custom''::text, NULL::date, ''normal''::text, NULL::text'
       AND proargnames[1:pronargs] = ARRAY[
         'p_workspace_id', 'p_template_id', 'p_membership_id', 'p_title',
         'p_category', 'p_due_date', 'p_priority', 'p_notes'
       ]::text[]
       AND prorettype = 'uuid'::regtype
       AND NOT proretset
    FROM pg_catalog.pg_proc
    WHERE oid = 'public.hr_workflow_create_instance(uuid,uuid,uuid,text,text,date,text,text)'::regprocedure
  ), false)
  AND COALESCE((
    SELECT prosecdef
       AND proconfig @> ARRAY['search_path=pg_catalog']::text[]
       AND pronargdefaults = 0
       AND proargdefaults IS NULL
       AND proargnames[1:pronargs] = ARRAY['p_task_id', 'p_status']::text[]
       AND prorettype = 'void'::regtype
       AND NOT proretset
    FROM pg_catalog.pg_proc
    WHERE oid = 'public.hr_workflow_update_task(uuid,text)'::regprocedure
  ), false)
  AND COALESCE((
    SELECT prosecdef
       AND proconfig @> ARRAY['search_path=pg_catalog']::text[]
       AND pronargdefaults = 1
       AND pg_catalog.pg_get_expr(proargdefaults, 0) = '''completed''::text'
       AND proargnames[1:pronargs] = ARRAY['p_instance_id', 'p_status']::text[]
       AND prorettype = 'void'::regtype
       AND NOT proretset
    FROM pg_catalog.pg_proc
    WHERE oid = 'public.hr_workflow_close_instance(uuid,text)'::regprocedure
  ), false),
  'HR workflow RPC named arguments, defaults, return type or trusted execution changed'
);
SELECT contract.assert_true(
  COALESCE((
    SELECT prosecdef
       AND proconfig @> ARRAY['search_path=pg_catalog']::text[]
       AND pronargdefaults = 2
       AND pg_catalog.pg_get_expr(proargdefaults, 0) = 'NULL::text, NULL::text'
       AND proretset
       AND proargnames = ARRAY[
         'p_workspace_id', 'p_status', 'p_category',
         'id', 'template_id', 'membership_id', 'title', 'category', 'status',
         'priority', 'due_date', 'started_at', 'completed_at', 'notes',
         'member_name', 'total_tasks', 'done_tasks'
       ]::text[]
       AND proallargtypes = ARRAY[
         'uuid'::regtype::oid, 'text'::regtype::oid, 'text'::regtype::oid,
         'uuid'::regtype::oid, 'uuid'::regtype::oid, 'uuid'::regtype::oid,
         'text'::regtype::oid, 'text'::regtype::oid, 'text'::regtype::oid,
         'text'::regtype::oid, 'date'::regtype::oid,
         'timestamp with time zone'::regtype::oid,
         'timestamp with time zone'::regtype::oid,
         'text'::regtype::oid, 'text'::regtype::oid,
         'bigint'::regtype::oid, 'bigint'::regtype::oid
       ]::oid[]
       AND proargmodes::text = '{i,i,i,t,t,t,t,t,t,t,t,t,t,t,t,t,t}'
    FROM pg_catalog.pg_proc
    WHERE oid = 'public.hr_workflow_list_instances(uuid,text,text)'::regprocedure
  ), false),
  'HR workflow list RPC named/default/return-table contract changed'
);
SELECT contract.assert_true(
  (
    SELECT count(*) = 4
       AND bool_and(prosecdef)
       AND bool_and(proconfig @> ARRAY['search_path=pg_catalog']::text[])
    FROM pg_catalog.pg_proc
    WHERE oid = ANY (ARRAY[
      'public.guard_hr_workflow_tenant_references()'::regprocedure,
      'public.guard_hr_workflow_cross_tenant_parent_change()'::regprocedure,
      'effectime_private.hr_workflow_can_read_assigned_task(uuid)'::regprocedure,
      'public.hr_workflow_list_instances(uuid,text,text)'::regprocedure
    ]::oid[])
  ),
  'HR workflow SECURITY DEFINER helper trust contract changed'
);

CREATE TABLE contract.hr_concurrency_gate (
  id integer PRIMARY KEY CHECK (id = 1),
  released boolean NOT NULL
);
INSERT INTO contract.hr_concurrency_gate(id, released) VALUES (1, false);

CREATE TABLE contract.hr_concurrency_results (
  scenario text NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
GRANT INSERT ON contract.hr_concurrency_results TO authenticated;

CREATE OR REPLACE FUNCTION contract.wait_for_hr_release()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_deadline timestamptz := pg_catalog.clock_timestamp() + interval '45 seconds';
BEGIN
  LOOP
    IF COALESCE((
      SELECT gate.released
      FROM contract.hr_concurrency_gate AS gate
      WHERE gate.id = 1
    ), false) THEN
      RETURN;
    END IF;
    IF pg_catalog.clock_timestamp() >= v_deadline THEN
      RAISE EXCEPTION 'Timed out waiting for HR workflow concurrency release';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION contract.wait_for_hr_release() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contract.wait_for_hr_release() TO authenticated;

SELECT 'hr_workflow_tenant_static_contract_passed' AS assertion;
\endif
