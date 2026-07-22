\set ON_ERROR_STOP on

CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE SCHEMA contract;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

GRANT USAGE ON SCHEMA public, auth, contract TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), current_user);
$function$;

CREATE OR REPLACE FUNCTION contract.assert_true(_condition boolean, _message text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT COALESCE(_condition, false) THEN
    RAISE EXCEPTION 'contract assertion failed: %', _message;
  END IF;
END;
$function$;

CREATE TYPE public.enterprise_role AS ENUM ('owner', 'resourceAssistant', 'member');
CREATE TYPE public.enterprise_membership_status AS ENUM (
  'active', 'invited', 'suspended', 'removed'
);

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text
);

CREATE TABLE public.enterprise_workspaces (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  is_archived boolean NOT NULL DEFAULT false
);

CREATE TABLE public.enterprise_memberships (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.enterprise_role NOT NULL DEFAULT 'member',
  status public.enterprise_membership_status NOT NULL DEFAULT 'active',
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE public.enterprise_invitations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.enterprise_role NOT NULL DEFAULT 'member',
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  invited_by uuid NOT NULL,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email),
  UNIQUE (token)
);

ALTER TABLE public.enterprise_invitations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_invitations TO authenticated;

CREATE OR REPLACE FUNCTION public.has_enterprise_role(
  _workspace_id uuid,
  _user_id uuid,
  _roles public.enterprise_role[]
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
      AND membership.role = ANY(_roles)
  );
$function$;

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

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE
);

CREATE TABLE public.tenant_workspaces (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

CREATE TABLE public.features (
  id uuid PRIMARY KEY,
  feature_key text NOT NULL UNIQUE
);

CREATE TABLE public.tiers (
  id uuid PRIMARY KEY,
  tier_key text NOT NULL UNIQUE
);

CREATE TABLE public.tier_features (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES public.tiers(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  UNIQUE (tier_id, feature_id)
);

CREATE TABLE public.addons (
  id uuid PRIMARY KEY,
  addon_key text NOT NULL UNIQUE
);

CREATE TABLE public.addon_features (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  UNIQUE (addon_id, feature_id)
);

CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.tiers(id),
  status text NOT NULL DEFAULT 'active',
  ends_at timestamptz
);

CREATE TABLE public.tenant_addons (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.addons(id),
  status text NOT NULL DEFAULT 'active',
  ends_at timestamptz,
  UNIQUE (tenant_id, addon_id)
);

CREATE TABLE public.tenant_feature_overrides (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  UNIQUE (tenant_id, feature_id)
);

CREATE OR REPLACE FUNCTION public.tenant_enabled_features(_tenant_id uuid)
RETURNS TABLE(feature_key text, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH enabled AS (
    SELECT feature.feature_key, 'tier'::text AS source
    FROM public.tenant_subscriptions AS subscription
    JOIN public.tier_features AS tier_feature
      ON tier_feature.tier_id = subscription.tier_id
    JOIN public.features AS feature ON feature.id = tier_feature.feature_id
    WHERE subscription.tenant_id = _tenant_id
      AND subscription.status = 'active'
      AND (subscription.ends_at IS NULL OR subscription.ends_at > now())
    UNION
    SELECT feature.feature_key, 'addon'::text
    FROM public.tenant_addons AS tenant_addon
    JOIN public.addon_features AS addon_feature
      ON addon_feature.addon_id = tenant_addon.addon_id
    JOIN public.features AS feature ON feature.id = addon_feature.feature_id
    WHERE tenant_addon.tenant_id = _tenant_id
      AND tenant_addon.status = 'active'
      AND (tenant_addon.ends_at IS NULL OR tenant_addon.ends_at > now())
    UNION
    SELECT feature.feature_key, 'override'::text
    FROM public.tenant_feature_overrides AS feature_override
    JOIN public.features AS feature ON feature.id = feature_override.feature_id
    WHERE feature_override.tenant_id = _tenant_id
      AND feature_override.enabled = true
      AND (feature_override.expires_at IS NULL OR feature_override.expires_at > now())
  ),
  disabled AS (
    SELECT feature.feature_key
    FROM public.tenant_feature_overrides AS feature_override
    JOIN public.features AS feature ON feature.id = feature_override.feature_id
    WHERE feature_override.tenant_id = _tenant_id
      AND feature_override.enabled = false
      AND (feature_override.expires_at IS NULL OR feature_override.expires_at > now())
  )
  SELECT DISTINCT enabled.feature_key, enabled.source
  FROM enabled
  WHERE enabled.feature_key NOT IN (SELECT disabled.feature_key FROM disabled);
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
      FROM public.tenant_workspaces AS mapping
      CROSS JOIN LATERAL public.tenant_enabled_features(mapping.tenant_id) AS enabled
      WHERE mapping.workspace_id = _workspace_id
        AND enabled.feature_key = ANY(COALESCE(_feature_keys, ARRAY[]::text[]))
    );
$function$;

REVOKE ALL ON FUNCTION public.workspace_has_any_feature(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_has_any_feature(uuid, text[]) TO authenticated;

-- The pre-migration routine intentionally has a tiny body. Its catalog shape,
-- defaults, OID and ACL exactly model the deployed contract; the candidate
-- migration must replace the body without replacing that catalog identity.
CREATE OR REPLACE FUNCTION public.issue_enterprise_invitation(
  _workspace_id uuid,
  _email text,
  _role public.enterprise_role,
  _expires_at timestamptz,
  _prefill jsonb DEFAULT '{}'::jsonb,
  _actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RETURN jsonb_build_object('pre_migration', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_enterprise_invitation(
  uuid, text, public.enterprise_role, timestamptz, jsonb, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_enterprise_invitation(
  uuid, text, public.enterprise_role, timestamptz, jsonb, uuid
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_enterprise_invitation(
  _invitation_token text,
  _user_id uuid,
  _prefill_override jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'token', _invitation_token,
    'user_id', _user_id,
    'prefill', _prefill_override
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_enterprise_invitation(text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_enterprise_invitation(text, uuid, jsonb)
  TO service_role;

CREATE POLICY "Owners and assistants create bounded invitations"
  ON public.enterprise_invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
    )
  );

CREATE POLICY "Workspace admins update bounded invitations"
  ON public.enterprise_invitations FOR UPDATE TO authenticated
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
    )
  )
  WITH CHECK (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
    )
  );

CREATE POLICY "Admins view workspace invitations"
  ON public.enterprise_invitations FOR SELECT TO authenticated
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
    )
  );

CREATE POLICY "Owners can delete invitations"
  ON public.enterprise_invitations FOR DELETE TO authenticated
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role]
    )
  );

CREATE OR REPLACE FUNCTION public.guard_enterprise_invitation_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_enterprise_invitation_mutation()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_enterprise_invitation_mutation
  BEFORE INSERT OR UPDATE ON public.enterprise_invitations
  FOR EACH ROW EXECUTE FUNCTION public.guard_enterprise_invitation_mutation();

CREATE TABLE contract.function_identity_before AS
SELECT
  procedure.oid,
  procedure.proargtypes::text AS argument_types,
  procedure.proargnames,
  procedure.pronargdefaults,
  pg_get_expr(procedure.proargdefaults, 0) AS argument_defaults,
  procedure.prorettype,
  procedure.proretset,
  procedure.provolatile,
  procedure.proparallel,
  procedure.prosecdef,
  procedure.proconfig,
  procedure.proacl
FROM pg_proc AS procedure
WHERE procedure.oid = (
  'public.issue_enterprise_invitation(uuid,text,public.enterprise_role,timestamptz,jsonb,uuid)'
    ::regprocedure
);

CREATE TABLE contract.acceptance_before AS
SELECT
  procedure.oid,
  pg_get_functiondef(procedure.oid) AS definition,
  procedure.proacl
FROM pg_proc AS procedure
WHERE procedure.oid = 'public.accept_enterprise_invitation(text,uuid,jsonb)'::regprocedure;

CREATE TABLE contract.stable_policies_before AS
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'enterprise_invitations'
  AND policyname IN ('Admins view workspace invitations', 'Owners can delete invitations');

\i /contract/migration.sql
\i /contract/migration.sql

SELECT contract.assert_true(
  (SELECT count(*) = 1 FROM contract.function_identity_before),
  'issue RPC baseline catalog identity was missing'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM contract.function_identity_before AS before
    JOIN pg_proc AS after ON after.oid = before.oid
    WHERE after.oid = (
      'public.issue_enterprise_invitation(uuid,text,public.enterprise_role,timestamptz,jsonb,uuid)'
        ::regprocedure
    )
      AND after.proargtypes::text = before.argument_types
      AND after.proargnames IS NOT DISTINCT FROM before.proargnames
      AND after.pronargdefaults = before.pronargdefaults
      AND pg_get_expr(after.proargdefaults, 0) IS NOT DISTINCT FROM before.argument_defaults
      AND after.prorettype = before.prorettype
      AND after.proretset = before.proretset
      AND after.provolatile = before.provolatile
      AND after.proparallel = before.proparallel
      AND after.prosecdef = before.prosecdef
      AND after.proconfig IS NOT DISTINCT FROM before.proconfig
      AND after.proacl IS NOT DISTINCT FROM before.proacl
  ),
  'issue RPC OID, signature, defaults, return, security, search_path or ACL changed'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM contract.acceptance_before AS before
    JOIN pg_proc AS after ON after.oid = before.oid
    WHERE after.oid = 'public.accept_enterprise_invitation(text,uuid,jsonb)'::regprocedure
      AND pg_get_functiondef(after.oid) = before.definition
      AND after.proacl IS NOT DISTINCT FROM before.proacl
  ),
  'accept RPC catalog identity, definition or ACL changed'
);

SELECT contract.assert_true(
  NOT EXISTS (
    (SELECT * FROM contract.stable_policies_before
     EXCEPT
     SELECT policyname, cmd, roles, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'enterprise_invitations'
       AND policyname IN ('Admins view workspace invitations', 'Owners can delete invitations'))
    UNION ALL
    (SELECT policyname, cmd, roles, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'enterprise_invitations'
       AND policyname IN ('Admins view workspace invitations', 'Owners can delete invitations')
     EXCEPT
     SELECT * FROM contract.stable_policies_before)
  ),
  'invitation SELECT or DELETE cleanup policy changed'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'enterprise_invitations'
      AND policyname = 'Owners and assistants create bounded invitations'
      AND cmd = 'INSERT'
      AND with_check LIKE '%workspace_has_any_feature%'
      AND with_check LIKE '%members_invite%'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'enterprise_invitations'
      AND policyname = 'Workspace admins update bounded invitations'
      AND cmd = 'UPDATE'
      AND qual LIKE '%workspace_has_any_feature%'
      AND qual LIKE '%members_invite%'
      AND with_check LIKE '%workspace_has_any_feature%'
      AND with_check LIKE '%members_invite%'
  ),
  'direct invitation INSERT/UPDATE policies lack the exact members_invite gate'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger
    JOIN pg_proc AS procedure ON procedure.oid = trigger.tgfoid
    WHERE trigger.tgrelid = 'public.enterprise_invitations'::regclass
      AND trigger.tgname = 'guard_enterprise_invitation_mutation'
      AND NOT trigger.tgisinternal
      AND pg_get_triggerdef(trigger.oid) LIKE '%BEFORE INSERT OR UPDATE%'
      AND pg_get_functiondef(procedure.oid) LIKE '%workspace_has_any_feature%'
      AND pg_get_functiondef(procedure.oid) LIKE '%members_invite%'
  ),
  'invitation write guard lacks the exact members_invite gate'
);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    WHERE procedure.oid = (
      'public.issue_enterprise_invitation(uuid,text,public.enterprise_role,timestamptz,jsonb,uuid)'
        ::regprocedure
    )
      AND strpos(pg_get_functiondef(procedure.oid), 'Workspace administrator role required') > 0
      AND strpos(pg_get_functiondef(procedure.oid), 'FROM public.tenant_workspaces')
        > strpos(pg_get_functiondef(procedure.oid), 'Workspace administrator role required')
      AND strpos(pg_get_functiondef(procedure.oid), 'FROM public.tenant_enabled_features')
        > strpos(pg_get_functiondef(procedure.oid), 'FROM public.tenant_workspaces')
      AND strpos(pg_get_functiondef(procedure.oid), 'INSERT INTO public.enterprise_invitations')
        > strpos(pg_get_functiondef(procedure.oid), 'FROM public.tenant_enabled_features')
      AND strpos(pg_get_functiondef(procedure.oid), 'UPDATE public.enterprise_workspaces')
        > strpos(pg_get_functiondef(procedure.oid), 'FROM public.tenant_enabled_features')
  ),
  'issue entitlement check is not after actor/RBAC and before every write'
);

INSERT INTO public.enterprise_workspaces(id, name, settings, created_by) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Tier workspace', '{"marker":"tier"}', '10000000-0000-4000-8000-000000000001'),
  ('22222222-2222-4222-8222-222222222222', 'Addon workspace', '{"marker":"addon"}', '20000000-0000-4000-8000-000000000001'),
  ('33333333-3333-4333-8333-333333333333', 'Override workspace', '{"marker":"override"}', '30000000-0000-4000-8000-000000000001'),
  ('44444444-4444-4444-8444-444444444444', 'Missing workspace', '{"marker":"missing"}', '40000000-0000-4000-8000-000000000001'),
  ('55555555-5555-4555-8555-555555555555', 'Disabled workspace', '{"marker":"disabled"}', '50000000-0000-4000-8000-000000000001');

INSERT INTO public.enterprise_memberships(id, workspace_id, user_id, role, status) VALUES
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000002', 'resourceAssistant', 'active'),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000003', 'member', 'active'),
  ('a2000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '20000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('a3000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', '30000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('a4000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', '40000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('a5000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', '50000000-0000-4000-8000-000000000001', 'owner', 'active');

INSERT INTO public.tenants(id, name, slug) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'Tier tenant', 'tier-tenant'),
  ('aa000000-0000-4000-8000-000000000002', 'Addon tenant', 'addon-tenant'),
  ('aa000000-0000-4000-8000-000000000003', 'Override tenant', 'override-tenant'),
  ('aa000000-0000-4000-8000-000000000004', 'Missing tenant', 'missing-tenant'),
  ('aa000000-0000-4000-8000-000000000005', 'Disabled tenant', 'disabled-tenant');

INSERT INTO public.tenant_workspaces(tenant_id, workspace_id, is_primary) VALUES
  ('aa000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', true),
  ('aa000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', true),
  ('aa000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', true),
  ('aa000000-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', true),
  ('aa000000-0000-4000-8000-000000000005', '55555555-5555-4555-8555-555555555555', true);

INSERT INTO public.features(id, feature_key)
VALUES ('f0000000-0000-4000-8000-000000000001', 'members_invite');
INSERT INTO public.tiers(id, tier_key)
VALUES ('b1000000-0000-4000-8000-000000000001', 'enterprise-contract');
INSERT INTO public.tier_features(tier_id, feature_id)
VALUES ('b1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001');
INSERT INTO public.addons(id, addon_key)
VALUES ('b2000000-0000-4000-8000-000000000001', 'member-invites-contract');
INSERT INTO public.addon_features(addon_id, feature_id)
VALUES ('b2000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001');

INSERT INTO public.tenant_subscriptions(tenant_id, tier_id, status) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'active'),
  ('aa000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001', 'active');
INSERT INTO public.tenant_addons(tenant_id, addon_id, status)
VALUES ('aa000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'active');
INSERT INTO public.tenant_feature_overrides(tenant_id, feature_id, enabled) VALUES
  ('aa000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', true),
  ('aa000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001', false);

SELECT contract.assert_true(
  EXISTS (
    SELECT 1 FROM public.tenant_enabled_features('aa000000-0000-4000-8000-000000000001')
    WHERE feature_key = 'members_invite' AND source = 'tier'
  )
  AND EXISTS (
    SELECT 1 FROM public.tenant_enabled_features('aa000000-0000-4000-8000-000000000002')
    WHERE feature_key = 'members_invite' AND source = 'addon'
  )
  AND EXISTS (
    SELECT 1 FROM public.tenant_enabled_features('aa000000-0000-4000-8000-000000000003')
    WHERE feature_key = 'members_invite' AND source = 'override'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_enabled_features('aa000000-0000-4000-8000-000000000004')
    WHERE feature_key = 'members_invite'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_enabled_features('aa000000-0000-4000-8000-000000000005')
    WHERE feature_key = 'members_invite'
  ),
  'tier, addon, enabled override, missing or disabled override fixture semantics regressed'
);

-- Positive issue/reissue paths for every entitlement source and actor channel.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT contract.assert_true(
  (public.issue_enterprise_invitation(
    '11111111-1111-4111-8111-111111111111',
    'owner-tier@example.test',
    'member',
    now() + interval '7 days',
    '{"team":"A"}'::jsonb
  ) ->> 'ok')::boolean,
  'tier-entitled owner issue failed'
);
RESET ROLE;
CREATE TABLE contract.owner_reissue_before AS
SELECT token
FROM public.enterprise_invitations
WHERE workspace_id = '11111111-1111-4111-8111-111111111111'
  AND email = 'owner-tier@example.test';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT contract.assert_true(
  (public.issue_enterprise_invitation(
    '11111111-1111-4111-8111-111111111111',
    'owner-tier@example.test',
    'member',
    now() + interval '8 days',
    '{"team":"A2"}'::jsonb
  ) ->> 'ok')::boolean,
  'tier-entitled owner reissue failed'
);
RESET ROLE;
SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.enterprise_invitations AS invitation
    CROSS JOIN contract.owner_reissue_before AS before
    WHERE invitation.workspace_id = '11111111-1111-4111-8111-111111111111'
      AND invitation.email = 'owner-tier@example.test'
      AND invitation.token <> before.token
      AND invitation.accepted_at IS NULL
  ),
  'entitled reissue did not rotate the token'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
SELECT contract.assert_true(
  (public.issue_enterprise_invitation(
    '11111111-1111-4111-8111-111111111111',
    'assistant-tier@example.test',
    'member',
    now() + interval '7 days'
  ) ->> 'ok')::boolean,
  'tier-entitled resource assistant issue failed'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT contract.assert_true(
  (public.issue_enterprise_invitation(
    '11111111-1111-4111-8111-111111111111',
    'elevated-tier@example.test',
    'resourceAssistant',
    now() + interval '7 days'
  ) ->> 'ok')::boolean,
  'tier-entitled owner elevated issue failed'
);
RESET ROLE;

SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT contract.assert_true(
  (public.issue_enterprise_invitation(
    '11111111-1111-4111-8111-111111111111',
    'service-tier@example.test',
    'member',
    now() + interval '7 days',
    '{}'::jsonb,
    '10000000-0000-4000-8000-000000000001'
  ) ->> 'ok')::boolean,
  'service_role plus explicit actor issue failed'
);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
SELECT contract.assert_true(
  (public.issue_enterprise_invitation(
    '22222222-2222-4222-8222-222222222222',
    'owner-addon@example.test',
    'member',
    now() + interval '7 days'
  ) ->> 'ok')::boolean,
  'addon-entitled owner issue failed'
);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', false);
SELECT contract.assert_true(
  (public.issue_enterprise_invitation(
    '33333333-3333-4333-8333-333333333333',
    'owner-override@example.test',
    'member',
    now() + interval '7 days'
  ) ->> 'ok')::boolean,
  'enabled-override owner issue failed'
);
RESET ROLE;

SELECT contract.assert_true(
  (SELECT count(*) = 6 FROM public.enterprise_invitations),
  'positive issue/reissue paths created an unexpected invitation set'
);

-- RBAC failures remain authoritative and occur before entitlement resolution.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
DO $assistant_elevated_issue_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_enterprise_invitation(
      '11111111-1111-4111-8111-111111111111',
      'assistant-elevated@example.test',
      'owner',
      now() + interval '7 days'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := SQLERRM LIKE '%Only a workspace owner%';
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'resource assistant elevated issue was not denied by RBAC';
  END IF;
END;
$assistant_elevated_issue_denied$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false);
DO $member_issue_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_enterprise_invitation(
      '11111111-1111-4111-8111-111111111111',
      'member-attempt@example.test',
      'member',
      now() + interval '7 days'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := SQLERRM LIKE '%Workspace administrator role required%';
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'ordinary member issue was not denied by RBAC';
  END IF;
END;
$member_issue_denied$;

SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
DO $cross_tenant_issue_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_enterprise_invitation(
      '11111111-1111-4111-8111-111111111111',
      'cross-tenant@example.test',
      'member',
      now() + interval '7 days'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := SQLERRM LIKE '%Workspace administrator role required%';
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'cross-tenant owner issue was not denied by RBAC';
  END IF;
END;
$cross_tenant_issue_denied$;
RESET ROLE;

-- A missing feature must deny before any invitation or workspace prefill write.
CREATE TABLE contract.missing_workspace_before AS
SELECT to_jsonb(workspace.*) AS row_data
FROM public.enterprise_workspaces AS workspace
WHERE workspace.id = '44444444-4444-4444-8444-444444444444';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', false);
DO $missing_feature_issue_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_enterprise_invitation(
      '44444444-4444-4444-8444-444444444444',
      'missing-feature@example.test',
      'member',
      now() + interval '7 days',
      '{"team":"must-not-persist"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := SQLERRM LIKE '%feature is not enabled%';
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'feature-missing issue did not fail closed';
  END IF;
END;
$missing_feature_issue_denied$;
RESET ROLE;

SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.enterprise_invitations
    WHERE workspace_id = '44444444-4444-4444-8444-444444444444'
  )
  AND EXISTS (
    SELECT 1
    FROM public.enterprise_workspaces AS workspace
    CROSS JOIN contract.missing_workspace_before AS before
    WHERE workspace.id = '44444444-4444-4444-8444-444444444444'
      AND to_jsonb(workspace.*) = before.row_data
  ),
  'feature-missing issue mutated an invitation or workspace prefill'
);

-- A disabled override wins over the tier and denied reissue preserves the
-- complete invitation plus its pre-existing prefill byte-for-byte.
INSERT INTO public.enterprise_invitations(
  id, workspace_id, email, role, token, invited_by, expires_at, accepted_at, created_at
) VALUES (
  'e5000000-0000-4000-8000-000000000001',
  '55555555-5555-4555-8555-555555555555',
  'disabled-reissue@example.test',
  'owner',
  'disabled-reissue-token-before',
  '50000000-0000-4000-8000-000000000001',
  now() + interval '6 days',
  now() - interval '1 day',
  now() - interval '2 days'
);
UPDATE public.enterprise_workspaces
SET settings = jsonb_build_object(
  'marker', 'disabled',
  'invitation_prefills', jsonb_build_object(
    'e5000000-0000-4000-8000-000000000001',
    jsonb_build_object('team', 'must-survive')
  )
)
WHERE id = '55555555-5555-4555-8555-555555555555';

CREATE TABLE contract.disabled_invitation_before AS
SELECT to_jsonb(invitation.*) AS row_data
FROM public.enterprise_invitations AS invitation
WHERE invitation.id = 'e5000000-0000-4000-8000-000000000001';
CREATE TABLE contract.disabled_workspace_before AS
SELECT to_jsonb(workspace.*) AS row_data
FROM public.enterprise_workspaces AS workspace
WHERE workspace.id = '55555555-5555-4555-8555-555555555555';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000001', false);
DO $disabled_override_reissue_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_enterprise_invitation(
      '55555555-5555-4555-8555-555555555555',
      'disabled-reissue@example.test',
      'member',
      now() + interval '10 days',
      '{"team":"must-not-replace"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := SQLERRM LIKE '%feature is not enabled%';
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'disabled override reissue did not fail closed';
  END IF;
END;
$disabled_override_reissue_denied$;
RESET ROLE;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1
    FROM public.enterprise_invitations AS invitation
    CROSS JOIN contract.disabled_invitation_before AS before
    WHERE invitation.id = 'e5000000-0000-4000-8000-000000000001'
      AND to_jsonb(invitation.*) = before.row_data
      AND invitation.token = 'disabled-reissue-token-before'
      AND invitation.role = 'owner'::public.enterprise_role
      AND invitation.accepted_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.enterprise_workspaces AS workspace
    CROSS JOIN contract.disabled_workspace_before AS before
    WHERE workspace.id = '55555555-5555-4555-8555-555555555555'
      AND to_jsonb(workspace.*) = before.row_data
  ),
  'disabled override reissue mutated invite/token/accepted/role or workspace prefill'
);

-- Direct authenticated writes have both RLS and trigger protection.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
INSERT INTO public.enterprise_invitations(
  id, workspace_id, email, role, token, invited_by, expires_at
) VALUES (
  'e1000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'direct-owner@example.test',
  'member',
  'direct-owner-token',
  '10000000-0000-4000-8000-000000000001',
  now() + interval '5 days'
);
UPDATE public.enterprise_invitations
SET role = 'resourceAssistant', expires_at = now() + interval '6 days'
WHERE id = 'e1000000-0000-4000-8000-000000000001';

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
INSERT INTO public.enterprise_invitations(
  id, workspace_id, email, role, token, invited_by, expires_at
) VALUES (
  'e1000000-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  'direct-assistant@example.test',
  'member',
  'direct-assistant-token',
  '10000000-0000-4000-8000-000000000002',
  now() + interval '5 days'
);

DO $direct_assistant_elevated_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_invitations(
      workspace_id, email, role, token, invited_by, expires_at
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'direct-assistant-elevated@example.test',
      'owner',
      'direct-assistant-elevated-token',
      '10000000-0000-4000-8000-000000000002',
      now() + interval '5 days'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'resource assistant directly inserted an elevated invitation';
  END IF;
END;
$direct_assistant_elevated_denied$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false);
DO $direct_member_insert_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_invitations(
      workspace_id, email, role, token, invited_by, expires_at
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'direct-member@example.test',
      'member',
      'direct-member-token',
      '10000000-0000-4000-8000-000000000003',
      now() + interval '5 days'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'ordinary member directly inserted an invitation';
  END IF;
END;
$direct_member_insert_denied$;

SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
DO $direct_cross_tenant_insert_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_invitations(
      workspace_id, email, role, token, invited_by, expires_at
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'direct-cross@example.test',
      'member',
      'direct-cross-token',
      '20000000-0000-4000-8000-000000000001',
      now() + interval '5 days'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'cross-tenant owner directly inserted an invitation';
  END IF;
END;
$direct_cross_tenant_insert_denied$;

SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', false);
DO $direct_missing_feature_insert_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.enterprise_invitations(
      workspace_id, email, role, token, invited_by, expires_at
    ) VALUES (
      '44444444-4444-4444-8444-444444444444',
      'direct-missing@example.test',
      'member',
      'direct-missing-token',
      '40000000-0000-4000-8000-000000000001',
      now() + interval '5 days'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'feature-missing owner directly inserted an invitation';
  END IF;
END;
$direct_missing_feature_insert_denied$;

SELECT set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000001', false);
DO $direct_disabled_update_denied$
DECLARE
  v_rows bigint;
BEGIN
  UPDATE public.enterprise_invitations
  SET expires_at = now() + interval '12 days'
  WHERE id = 'e5000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'disabled-override direct update changed % rows', v_rows;
  END IF;
END;
$direct_disabled_update_denied$;

SELECT contract.assert_true(
  (SELECT count(*) = 1
   FROM public.enterprise_invitations
   WHERE id = 'e5000000-0000-4000-8000-000000000001'),
  'SELECT cleanup semantics changed while entitlement is disabled'
);
DELETE FROM public.enterprise_invitations
WHERE id = 'e5000000-0000-4000-8000-000000000001';
SELECT contract.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.enterprise_invitations
    WHERE id = 'e5000000-0000-4000-8000-000000000001'
  ),
  'owner DELETE cleanup semantics changed while entitlement is disabled'
);
RESET ROLE;

SELECT contract.assert_true(
  EXISTS (
    SELECT 1 FROM public.enterprise_invitations
    WHERE id = 'e1000000-0000-4000-8000-000000000001'
      AND role = 'resourceAssistant'::public.enterprise_role
      AND token = 'direct-owner-token'
      AND accepted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM public.enterprise_invitations
    WHERE id = 'e1000000-0000-4000-8000-000000000002'
      AND role = 'member'::public.enterprise_role
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_invitations
    WHERE email IN (
      'direct-assistant-elevated@example.test',
      'direct-member@example.test',
      'direct-cross@example.test',
      'direct-missing@example.test'
    )
  ),
  'direct write policy/guard allowed denial paths or damaged positive paths'
);

-- The unchanged acceptance RPC remains executable only through its original
-- service boundary after the invitation entitlement migration.
SET ROLE authenticated;
DO $authenticated_accept_still_denied$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.accept_enterprise_invitation(
      'unchanged-accept-token',
      '10000000-0000-4000-8000-000000000001',
      NULL
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'authenticated unexpectedly executed accept RPC';
  END IF;
END;
$authenticated_accept_still_denied$;
RESET ROLE;

SET ROLE service_role;
SELECT contract.assert_true(
  public.accept_enterprise_invitation(
    'unchanged-accept-token',
    '10000000-0000-4000-8000-000000000001',
    NULL
  ) ->> 'token' = 'unchanged-accept-token',
  'service_role acceptance contract changed'
);
RESET ROLE;

SELECT 'invitation_entitlement_migration_contract_passed' AS assertion;
