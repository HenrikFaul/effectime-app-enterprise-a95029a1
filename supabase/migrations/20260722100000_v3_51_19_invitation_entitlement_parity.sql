-- v3.51.19 — enforce members_invite at every invitation write boundary.
--
-- Invitation delivery has always been feature-gated in the application, but
-- authenticated callers could still write the underlying table directly and
-- the service-backed issue RPC did not enforce the tenant entitlement. Keep
-- acceptance and invitation cleanup semantics unchanged while making issue,
-- reissue, direct INSERT and direct UPDATE fail closed.

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
DECLARE
  v_actor uuid;
  v_email text := lower(btrim(_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_invitation public.enterprise_invitations%ROWTYPE;
  v_settings jsonb;
  v_prefills jsonb;
  v_target_user_id uuid;
  v_actor_is_owner boolean;
  v_tenant_id uuid;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_actor := _actor_id;
  ELSE
    v_actor := auth.uid();
    IF _actor_id IS NOT NULL AND _actor_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Invitation actor mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_actor IS NULL OR NOT public.has_enterprise_role(
    _workspace_id,
    v_actor,
    ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Workspace administrator role required' USING ERRCODE = '42501';
  END IF;
  v_actor_is_owner := public.has_enterprise_role(
    _workspace_id,
    v_actor,
    ARRAY['owner'::public.enterprise_role]
  );
  IF NOT v_actor_is_owner AND _role <> 'member'::public.enterprise_role THEN
    RAISE EXCEPTION 'Only a workspace owner may issue elevated invitations'
      USING ERRCODE = '42501';
  END IF;

  -- Resolve the entitlement from tenant data instead of the authenticated-only
  -- workspace helper. The issue RPC also serves service_role callers carrying
  -- an explicit, already-authorized actor, so auth.uid() is intentionally not
  -- part of this check. It runs after actor/RBAC validation and before the
  -- already-member shortcut, row locks, invitation writes or prefill writes.
  SELECT mapping.tenant_id
  INTO v_tenant_id
  FROM public.tenant_workspaces AS mapping
  WHERE mapping.workspace_id = _workspace_id
  ORDER BY mapping.is_primary DESC, mapping.created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.tenant_enabled_features(v_tenant_id) AS enabled
    WHERE enabled.feature_key = 'members_invite'
  ) THEN
    RAISE EXCEPTION 'Workspace invitation feature is not enabled'
      USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL OR length(v_email) > 320
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid invitation email' USING ERRCODE = '22023';
  END IF;
  IF _expires_at IS NULL OR _expires_at <= now()
     OR _expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'Invalid invitation expiry' USING ERRCODE = '22023';
  END IF;
  IF _prefill IS NULL OR jsonb_typeof(_prefill) <> 'object'
     OR octet_length(_prefill::text) > 65536 THEN
    RAISE EXCEPTION 'Invalid invitation prefill' USING ERRCODE = '22023';
  END IF;

  -- Fast negative check for the usual already-member case. The same check is
  -- repeated after the invitation row lock to close the accept/reissue race.
  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(email::text) = v_email
  LIMIT 1;
  IF v_target_user_id IS NOT NULL AND public.is_enterprise_member(
    _workspace_id,
    v_target_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_MEMBER');
  END IF;

  INSERT INTO public.enterprise_invitations (
    workspace_id, email, role, token, invited_by, expires_at, accepted_at, created_at
  ) VALUES (
    _workspace_id, v_email, _role, v_token, v_actor, _expires_at, NULL, now()
  )
  ON CONFLICT (workspace_id, email) DO UPDATE SET
    role = EXCLUDED.role,
    token = EXCLUDED.token,
    invited_by = EXCLUDED.invited_by,
    expires_at = EXCLUDED.expires_at,
    accepted_at = NULL,
    created_at = now()
  -- A resource assistant may renew an ordinary invitation, but must not
  -- rotate, downgrade or otherwise invalidate an existing elevated invite.
  -- Keeping this predicate on the atomic upsert also closes the concurrent
  -- "row was absent during a preceding SELECT" race.
  WHERE v_actor_is_owner
     OR public.enterprise_invitations.role = 'member'::public.enterprise_role
  RETURNING * INTO v_invitation;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a workspace owner may replace an elevated invitation'
      USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(email::text) = v_email
  LIMIT 1;
  IF v_target_user_id IS NOT NULL AND public.is_enterprise_member(
    _workspace_id,
    v_target_user_id
  ) THEN
    RAISE EXCEPTION 'Target user is already an active workspace member'
      USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(settings, '{}'::jsonb) INTO v_settings
  FROM public.enterprise_workspaces
  WHERE id = _workspace_id AND NOT is_archived
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace is unavailable' USING ERRCODE = '55000';
  END IF;

  v_prefills := CASE
    WHEN jsonb_typeof(v_settings -> 'invitation_prefills') = 'object'
      THEN v_settings -> 'invitation_prefills'
    ELSE '{}'::jsonb
  END;
  IF _prefill = '{}'::jsonb THEN
    v_prefills := v_prefills - v_invitation.id::text;
  ELSE
    v_prefills := v_prefills || jsonb_build_object(v_invitation.id::text, _prefill);
  END IF;
  v_settings := CASE WHEN v_prefills = '{}'::jsonb
    THEN v_settings - 'invitation_prefills'
    ELSE jsonb_set(v_settings, '{invitation_prefills}', v_prefills, true)
  END;
  UPDATE public.enterprise_workspaces
  SET settings = v_settings
  WHERE id = _workspace_id;

  RETURN jsonb_build_object(
    'ok', true,
    'invitation_id', v_invitation.id,
    'token', v_invitation.token,
    'expires_at', v_invitation.expires_at
  );
END;
$function$;

DROP POLICY IF EXISTS "Owners and assistants create bounded invitations"
  ON public.enterprise_invitations;
DROP POLICY IF EXISTS "Workspace admins update bounded invitations"
  ON public.enterprise_invitations;

CREATE POLICY "Owners and assistants create bounded invitations"
  ON public.enterprise_invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.workspace_has_any_feature(workspace_id, ARRAY['members_invite'])
    AND (
      public.has_enterprise_role(
        workspace_id,
        auth.uid(),
        ARRAY['owner'::public.enterprise_role]
      )
      OR (
        role = 'member'::public.enterprise_role
        AND public.has_enterprise_role(
          workspace_id,
          auth.uid(),
          ARRAY['resourceAssistant'::public.enterprise_role]
        )
      )
    )
  );

CREATE POLICY "Workspace admins update bounded invitations"
  ON public.enterprise_invitations FOR UPDATE TO authenticated
  USING (
    public.workspace_has_any_feature(workspace_id, ARRAY['members_invite'])
    AND (
      public.has_enterprise_role(
        workspace_id,
        auth.uid(),
        ARRAY['owner'::public.enterprise_role]
      )
      OR (
        role = 'member'::public.enterprise_role
        AND public.has_enterprise_role(
          workspace_id,
          auth.uid(),
          ARRAY['resourceAssistant'::public.enterprise_role]
        )
      )
    )
  )
  WITH CHECK (
    public.workspace_has_any_feature(workspace_id, ARRAY['members_invite'])
    AND (
      public.has_enterprise_role(
        workspace_id,
        auth.uid(),
        ARRAY['owner'::public.enterprise_role]
      )
      OR (
        role = 'member'::public.enterprise_role
        AND public.has_enterprise_role(
          workspace_id,
          auth.uid(),
          ARRAY['resourceAssistant'::public.enterprise_role]
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.guard_enterprise_invitation_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NOT public.workspace_has_any_feature(
    NEW.workspace_id,
    ARRAY['members_invite']
  ) THEN
    RAISE EXCEPTION 'Workspace invitation feature is not enabled'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.invited_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Invitation actor mismatch' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.token IS DISTINCT FROM OLD.token
       OR NEW.invited_by IS DISTINCT FROM OLD.invited_by
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
      RAISE EXCEPTION 'Invitation identity and acceptance fields are immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NOT public.has_enterprise_role(
    NEW.workspace_id,
    auth.uid(),
    ARRAY['owner'::public.enterprise_role]
  ) THEN
    IF NOT public.has_enterprise_role(
      NEW.workspace_id,
      auth.uid(),
      ARRAY['resourceAssistant'::public.enterprise_role]
    ) OR NEW.role <> 'member'::public.enterprise_role
       OR (TG_OP = 'UPDATE' AND OLD.role <> 'member'::public.enterprise_role) THEN
      RAISE EXCEPTION 'Only a workspace owner may manage elevated invitations'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_enterprise_invitation_mutation()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_enterprise_invitation_mutation
  ON public.enterprise_invitations;
CREATE TRIGGER guard_enterprise_invitation_mutation
  BEFORE INSERT OR UPDATE ON public.enterprise_invitations
  FOR EACH ROW EXECUTE FUNCTION public.guard_enterprise_invitation_mutation();
