-- v3.51.3 — restore proven runtime contracts and close metadata/settings gaps

-- Service-only auth directory resolver used by import-entity-data. The live
-- object was created through an external MCP migration and never committed.
CREATE OR REPLACE FUNCTION public.get_user_ids_by_emails(p_emails text[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT users.id AS user_id, users.email::text
  FROM auth.users AS users
  WHERE users.email IS NOT NULL
    AND lower(users.email) = ANY (
      SELECT lower(trim(input_email))
      FROM unnest(COALESCE(p_emails, ARRAY[]::text[])) AS input_email
      WHERE input_email IS NOT NULL AND trim(input_email) <> ''
    );
$function$;

REVOKE ALL ON FUNCTION public.get_user_ids_by_emails(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ids_by_emails(text[]) TO service_role;

-- The lower-level tenant mapping and feature-union RPCs expose subscription
-- metadata and are intended for service-side entitlement checks only.
REVOKE ALL ON FUNCTION public.tenant_id_for_workspace(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tenant_enabled_features(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_id_for_workspace(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tenant_enabled_features(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.workspace_enabled_features(_workspace_id uuid)
RETURNS TABLE(feature_key text, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.is_enterprise_member(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Workspace membership required' USING ERRCODE = '42501';
  END IF;

  SELECT mapping.tenant_id
  INTO v_tenant_id
  FROM public.tenant_workspaces AS mapping
  WHERE mapping.workspace_id = _workspace_id
  ORDER BY mapping.is_primary DESC, mapping.created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT enabled.feature_key, enabled.source
  FROM public.tenant_enabled_features(v_tenant_id) AS enabled;
END;
$function$;

REVOKE ALL ON FUNCTION public.workspace_enabled_features(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_enabled_features(uuid) TO authenticated;

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

-- Server-side equivalent of useEnterprisePermissions. Owner access remains
-- implicit, while every other active role must have the configured minimum
-- access level. Restrict the user argument to the current JWT so the helper
-- cannot be used as a permission-enumeration oracle.
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

REVOKE ALL ON FUNCTION public.has_workspace_permission(uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_permission(uuid, uuid, text, text)
  TO authenticated;

-- Permission configuration is an owner-only business contract. The previous
-- ALL policies allowed a resource assistant to restore permissions that an
-- owner had explicitly removed and therefore bypass every downstream guard.
DROP POLICY IF EXISTS "Admins can manage role permissions"
  ON public.enterprise_role_permissions;
CREATE POLICY "Owners can manage role permissions"
  ON public.enterprise_role_permissions FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role]
    )
  )
  WITH CHECK (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role]
    )
  );

DROP POLICY IF EXISTS "Admins can manage role definitions"
  ON public.enterprise_role_definitions;
CREATE POLICY "Owners can manage role definitions"
  ON public.enterprise_role_definitions FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role]
    )
  )
  WITH CHECK (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role]
    )
  );

-- Onboarding is a paid capability. Rebuild all four direct-CRUD boundaries so
-- PostgREST cannot bypass the feature gate and child UUIDs cannot cross a
-- workspace or attach a completion to a step from another template.
DROP POLICY IF EXISTS "Members view onboarding templates" ON public.enterprise_onboarding_templates;
DROP POLICY IF EXISTS "Admins manage onboarding templates" ON public.enterprise_onboarding_templates;
CREATE POLICY "Entitled members view onboarding templates"
  ON public.enterprise_onboarding_templates FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['onboarding_template'])
  );
CREATE POLICY "Entitled admins manage onboarding templates"
  ON public.enterprise_onboarding_templates FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['onboarding_template'])
  )
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['onboarding_template'])
    AND (
      scope_org_unit_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_org_units AS org_unit
        WHERE org_unit.id = enterprise_onboarding_templates.scope_org_unit_id
          AND org_unit.workspace_id = enterprise_onboarding_templates.workspace_id
      )
    )
    AND (
      scope_position_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_workspace_roles AS workspace_role
        WHERE workspace_role.id = enterprise_onboarding_templates.scope_position_id
          AND workspace_role.workspace_id = enterprise_onboarding_templates.workspace_id
      )
    )
  );

DROP POLICY IF EXISTS "Members view onboarding template steps" ON public.enterprise_onboarding_template_steps;
DROP POLICY IF EXISTS "Admins manage onboarding template steps" ON public.enterprise_onboarding_template_steps;
CREATE POLICY "Entitled members view onboarding template steps"
  ON public.enterprise_onboarding_template_steps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enterprise_onboarding_templates AS template
      WHERE template.id = enterprise_onboarding_template_steps.template_id
        AND public.is_enterprise_member(template.workspace_id, auth.uid())
        AND public.workspace_has_any_feature(template.workspace_id, ARRAY['onboarding_template'])
    )
  );
CREATE POLICY "Entitled admins manage onboarding template steps"
  ON public.enterprise_onboarding_template_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enterprise_onboarding_templates AS template
      WHERE template.id = enterprise_onboarding_template_steps.template_id
        AND public.has_enterprise_role(template.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
        AND public.workspace_has_any_feature(template.workspace_id, ARRAY['onboarding_template'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.enterprise_onboarding_templates AS template
      WHERE template.id = enterprise_onboarding_template_steps.template_id
        AND public.has_enterprise_role(template.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
        AND public.workspace_has_any_feature(template.workspace_id, ARRAY['onboarding_template'])
        AND (
          enterprise_onboarding_template_steps.access_system_id IS NULL OR EXISTS (
            SELECT 1 FROM public.enterprise_access_systems AS access_system
            WHERE access_system.id = enterprise_onboarding_template_steps.access_system_id
              AND access_system.workspace_id = template.workspace_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members view onboarding instances" ON public.enterprise_onboarding_instances;
DROP POLICY IF EXISTS "Admins manage onboarding instances" ON public.enterprise_onboarding_instances;
CREATE POLICY "Entitled members view onboarding instances"
  ON public.enterprise_onboarding_instances FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['onboarding_inbox'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS member
      WHERE member.id = enterprise_onboarding_instances.member_id
        AND member.workspace_id = enterprise_onboarding_instances.workspace_id
    )
    AND (
      template_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_onboarding_templates AS template
        WHERE template.id = enterprise_onboarding_instances.template_id
          AND template.workspace_id = enterprise_onboarding_instances.workspace_id
      )
    )
  );
CREATE POLICY "Entitled admins manage onboarding instances"
  ON public.enterprise_onboarding_instances FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['onboarding_inbox'])
  )
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['onboarding_inbox'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS member
      WHERE member.id = enterprise_onboarding_instances.member_id
        AND member.workspace_id = enterprise_onboarding_instances.workspace_id
    )
    AND (
      template_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_onboarding_templates AS template
        WHERE template.id = enterprise_onboarding_instances.template_id
          AND template.workspace_id = enterprise_onboarding_instances.workspace_id
      )
    )
  );

DROP POLICY IF EXISTS "Members view onboarding step completions" ON public.enterprise_onboarding_step_completions;
DROP POLICY IF EXISTS "Admins manage onboarding step completions" ON public.enterprise_onboarding_step_completions;
CREATE POLICY "Entitled members view onboarding step completions"
  ON public.enterprise_onboarding_step_completions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.enterprise_onboarding_instances AS instance
      JOIN public.enterprise_onboarding_template_steps AS step
        ON step.id = enterprise_onboarding_step_completions.step_id
       AND step.template_id = instance.template_id
      WHERE instance.id = enterprise_onboarding_step_completions.instance_id
        AND public.is_enterprise_member(instance.workspace_id, auth.uid())
        AND public.workspace_has_any_feature(instance.workspace_id, ARRAY['onboarding_inbox'])
    )
  );
CREATE POLICY "Entitled admins manage onboarding step completions"
  ON public.enterprise_onboarding_step_completions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.enterprise_onboarding_instances AS instance
      JOIN public.enterprise_onboarding_template_steps AS step
        ON step.id = enterprise_onboarding_step_completions.step_id
       AND step.template_id = instance.template_id
      WHERE instance.id = enterprise_onboarding_step_completions.instance_id
        AND public.has_enterprise_role(instance.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
        AND public.workspace_has_any_feature(instance.workspace_id, ARRAY['onboarding_inbox'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.enterprise_onboarding_instances AS instance
      JOIN public.enterprise_onboarding_template_steps AS step
        ON step.id = enterprise_onboarding_step_completions.step_id
       AND step.template_id = instance.template_id
      WHERE instance.id = enterprise_onboarding_step_completions.instance_id
        AND public.has_enterprise_role(instance.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
        AND public.workspace_has_any_feature(instance.workspace_id, ARRAY['onboarding_inbox'])
    )
  );

-- Access management and strategic datasets were only role-gated in the
-- historical RLS. Enforce the paid capability at the data boundary and keep
-- every child identifier inside the row's authoritative workspace.
DROP POLICY IF EXISTS "Members view access systems" ON public.enterprise_access_systems;
DROP POLICY IF EXISTS "Admins manage access systems" ON public.enterprise_access_systems;
CREATE POLICY "Entitled members view access systems"
  ON public.enterprise_access_systems FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_systems'])
  );
CREATE POLICY "Entitled admins manage access systems"
  ON public.enterprise_access_systems FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_systems'])
  )
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_systems'])
  );

DROP POLICY IF EXISTS "Members view access templates" ON public.enterprise_access_templates;
DROP POLICY IF EXISTS "Admins manage access templates" ON public.enterprise_access_templates;
CREATE POLICY "Entitled members view access templates"
  ON public.enterprise_access_templates FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_templates'])
  );
CREATE POLICY "Entitled admins manage access templates"
  ON public.enterprise_access_templates FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_templates'])
  )
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_templates'])
    AND (
      scope_org_unit_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_org_units AS org_unit
        WHERE org_unit.id = enterprise_access_templates.scope_org_unit_id
          AND org_unit.workspace_id = enterprise_access_templates.workspace_id
      )
    )
    AND (
      scope_position_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_workspace_roles AS workspace_role
        WHERE workspace_role.id = enterprise_access_templates.scope_position_id
          AND workspace_role.workspace_id = enterprise_access_templates.workspace_id
      )
    )
  );

DROP POLICY IF EXISTS "Members view access template systems" ON public.enterprise_access_template_systems;
DROP POLICY IF EXISTS "Admins manage access template systems" ON public.enterprise_access_template_systems;
CREATE POLICY "Entitled members view access template systems"
  ON public.enterprise_access_template_systems FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.enterprise_access_templates AS template
      JOIN public.enterprise_access_systems AS access_system
        ON access_system.id = enterprise_access_template_systems.system_id
       AND access_system.workspace_id = template.workspace_id
      WHERE template.id = enterprise_access_template_systems.template_id
        AND public.is_enterprise_member(template.workspace_id, auth.uid())
        AND public.workspace_has_any_feature(template.workspace_id, ARRAY['access_templates'])
    )
  );
CREATE POLICY "Entitled admins manage access template systems"
  ON public.enterprise_access_template_systems FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.enterprise_access_templates AS template
      JOIN public.enterprise_access_systems AS access_system
        ON access_system.id = enterprise_access_template_systems.system_id
       AND access_system.workspace_id = template.workspace_id
      WHERE template.id = enterprise_access_template_systems.template_id
        AND public.has_enterprise_role(template.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
        AND public.workspace_has_any_feature(template.workspace_id, ARRAY['access_templates'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.enterprise_access_templates AS template
      JOIN public.enterprise_access_systems AS access_system
        ON access_system.id = enterprise_access_template_systems.system_id
       AND access_system.workspace_id = template.workspace_id
      WHERE template.id = enterprise_access_template_systems.template_id
        AND public.has_enterprise_role(template.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
        AND public.workspace_has_any_feature(template.workspace_id, ARRAY['access_templates'])
    )
  );

DROP POLICY IF EXISTS "Members view access requests" ON public.enterprise_access_requests;
DROP POLICY IF EXISTS "Members create access requests" ON public.enterprise_access_requests;
DROP POLICY IF EXISTS "Admins manage access requests" ON public.enterprise_access_requests;
CREATE POLICY "Entitled users view access requests"
  ON public.enterprise_access_requests FOR SELECT TO authenticated
  USING (
    public.workspace_has_any_feature(workspace_id, ARRAY['access_inbox'])
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS target_member
      JOIN public.enterprise_access_systems AS access_system
        ON access_system.id = enterprise_access_requests.system_id
       AND access_system.workspace_id = enterprise_access_requests.workspace_id
      WHERE target_member.id = enterprise_access_requests.member_id
        AND target_member.workspace_id = enterprise_access_requests.workspace_id
        AND (
          target_member.user_id = auth.uid()
          OR public.has_enterprise_role(
            enterprise_access_requests.workspace_id,
            auth.uid(),
            ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
          )
        )
    )
    AND (
      template_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_access_templates AS template
        WHERE template.id = enterprise_access_requests.template_id
          AND template.workspace_id = enterprise_access_requests.workspace_id
      )
    )
  );
CREATE POLICY "Entitled users create access requests"
  ON public.enterprise_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND status = 'pending'
    AND decided_by IS NULL
    AND decided_at IS NULL
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_inbox'])
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS target_member
      JOIN public.enterprise_access_systems AS access_system
        ON access_system.id = enterprise_access_requests.system_id
       AND access_system.workspace_id = enterprise_access_requests.workspace_id
      WHERE target_member.id = enterprise_access_requests.member_id
        AND target_member.workspace_id = enterprise_access_requests.workspace_id
        AND (
          target_member.user_id = auth.uid()
          OR public.has_enterprise_role(
            enterprise_access_requests.workspace_id,
            auth.uid(),
            ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
          )
        )
    )
    AND (
      template_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_access_templates AS template
        WHERE template.id = enterprise_access_requests.template_id
          AND template.workspace_id = enterprise_access_requests.workspace_id
      )
    )
  );
CREATE POLICY "Entitled admins manage access requests"
  ON public.enterprise_access_requests FOR UPDATE TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_inbox'])
  )
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['access_inbox'])
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS target_member
      JOIN public.enterprise_access_systems AS access_system
        ON access_system.id = enterprise_access_requests.system_id
       AND access_system.workspace_id = enterprise_access_requests.workspace_id
      WHERE target_member.id = enterprise_access_requests.member_id
        AND target_member.workspace_id = enterprise_access_requests.workspace_id
    )
    AND (
      template_id IS NULL OR EXISTS (
        SELECT 1 FROM public.enterprise_access_templates AS template
        WHERE template.id = enterprise_access_requests.template_id
          AND template.workspace_id = enterprise_access_requests.workspace_id
      )
    )
  );

DROP POLICY IF EXISTS "Members view access decisions" ON public.enterprise_access_decisions;
DROP POLICY IF EXISTS "Admins write access decisions" ON public.enterprise_access_decisions;
CREATE POLICY "Entitled users view access decisions"
  ON public.enterprise_access_decisions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.enterprise_access_requests AS request
      JOIN public.enterprise_memberships AS target_member
        ON target_member.id = request.member_id
       AND target_member.workspace_id = request.workspace_id
      WHERE request.id = enterprise_access_decisions.request_id
        AND public.workspace_has_any_feature(request.workspace_id, ARRAY['access_inbox'])
        AND (
          target_member.user_id = auth.uid()
          OR public.has_enterprise_role(request.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
        )
    )
  );
CREATE POLICY "Entitled users write access decisions"
  ON public.enterprise_access_decisions FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_access_requests AS request
      JOIN public.enterprise_memberships AS target_member
        ON target_member.id = request.member_id
       AND target_member.workspace_id = request.workspace_id
      WHERE request.id = enterprise_access_decisions.request_id
        AND public.workspace_has_any_feature(request.workspace_id, ARRAY['access_inbox'])
        AND (
          (
            enterprise_access_decisions.action = 'submit'
            AND (target_member.user_id = auth.uid() OR public.has_enterprise_role(request.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]))
          )
          OR (
            enterprise_access_decisions.action <> 'submit'
            AND public.has_enterprise_role(request.workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
          )
        )
    )
  );

DROP POLICY IF EXISTS "Members view capacity snapshots" ON public.enterprise_capacity_snapshots;
DROP POLICY IF EXISTS "Admins manage capacity snapshots" ON public.enterprise_capacity_snapshots;
CREATE POLICY "Entitled members view capacity snapshots"
  ON public.enterprise_capacity_snapshots FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['capacity_dna'])
  );
CREATE POLICY "Entitled admins manage capacity snapshots"
  ON public.enterprise_capacity_snapshots FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['capacity_dna'])
  )
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['capacity_dna'])
  );

DROP POLICY IF EXISTS "Members view decision memory" ON public.enterprise_decision_memory;
DROP POLICY IF EXISTS "Admins manage decision memory" ON public.enterprise_decision_memory;
CREATE POLICY "Entitled members view decision memory"
  ON public.enterprise_decision_memory FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['decision_memory'])
  );
CREATE POLICY "Entitled admins manage decision memory"
  ON public.enterprise_decision_memory FOR ALL TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['decision_memory'])
  )
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['decision_memory'])
  );

CREATE OR REPLACE FUNCTION public.seed_default_access_systems(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_enterprise_role(
       p_workspace_id,
       auth.uid(),
       ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
     ) THEN
    RAISE EXCEPTION 'Workspace administrator role required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.workspace_has_any_feature(p_workspace_id, ARRAY['access_systems']) THEN
    RAISE EXCEPTION 'Access systems feature is not enabled for this workspace'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.enterprise_access_systems (workspace_id, name, kind)
  VALUES
    (p_workspace_id, 'Jira',          'external'),
    (p_workspace_id, 'Confluence',    'external'),
    (p_workspace_id, 'Outlook',       'external'),
    (p_workspace_id, 'Dynatrace',     'external'),
    (p_workspace_id, 'ERP',           'external'),
    (p_workspace_id, 'Billing',       'external'),
    (p_workspace_id, 'Entry Control', 'internal')
  ON CONFLICT (workspace_id, name) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_default_access_systems(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_access_systems(uuid) TO authenticated;

-- Submission audit is derived in the same transaction as request creation.
-- This preserves the existing direct INSERT API while removing the UI's
-- failure window between request creation and its immutable ledger row.
CREATE OR REPLACE FUNCTION public.record_access_request_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  INSERT INTO public.enterprise_access_decisions (
    request_id, action, actor_id
  ) VALUES (
    NEW.id, 'submit', NEW.requested_by
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_access_request_submission()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS record_access_request_submission
  ON public.enterprise_access_requests;
CREATE TRIGGER record_access_request_submission
  AFTER INSERT ON public.enterprise_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.record_access_request_submission();

-- Status transitions and decision-ledger writes must be atomic. Remove direct
-- authenticated writes; the SECURITY DEFINER RPC below owns the row lock,
-- transition validation and ledger insert.
DROP POLICY IF EXISTS "Entitled admins manage access requests"
  ON public.enterprise_access_requests;
DROP POLICY IF EXISTS "Entitled users write access decisions"
  ON public.enterprise_access_decisions;

CREATE OR REPLACE FUNCTION public.guard_access_request_direct_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Access decisions can only be written by decide_access_request'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_access_request_direct_decision
  ON public.enterprise_access_requests;
CREATE TRIGGER guard_access_request_direct_decision
  BEFORE UPDATE ON public.enterprise_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_access_request_direct_decision();

CREATE OR REPLACE FUNCTION public.guard_access_decision_direct_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Access decision ledger is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_access_decision_direct_mutation
  ON public.enterprise_access_decisions;
CREATE TRIGGER guard_access_decision_direct_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_access_decisions
  FOR EACH ROW EXECUTE FUNCTION public.guard_access_decision_direct_mutation();

CREATE OR REPLACE FUNCTION public.decide_access_request(
  _workspace_id uuid,
  _request_id uuid,
  _action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_request public.enterprise_access_requests%ROWTYPE;
  v_new_status text;
  v_ledger_action text;
BEGIN
  IF v_actor IS NULL OR NOT public.has_enterprise_role(
    _workspace_id,
    v_actor,
    ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Workspace administrator role required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.workspace_has_any_feature(_workspace_id, ARRAY['access_inbox']) THEN
    RAISE EXCEPTION 'Access inbox feature is not enabled for this workspace'
      USING ERRCODE = '42501';
  END IF;
  IF _action NOT IN ('approve', 'reject', 'mark_granted', 'revoke', 'cancel') THEN
    RAISE EXCEPTION 'Unsupported access decision action' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_request
  FROM public.enterprise_access_requests
  WHERE id = _request_id
    AND workspace_id = _workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request not found' USING ERRCODE = 'P0002';
  END IF;

  IF _action = 'approve' AND v_request.status = 'pending' THEN
    v_new_status := 'approved';
    v_ledger_action := 'approve';
  ELSIF _action = 'reject' AND v_request.status = 'pending' THEN
    v_new_status := 'rejected';
    v_ledger_action := 'reject';
  ELSIF _action = 'cancel' AND v_request.status = 'pending' THEN
    v_new_status := 'cancelled';
    v_ledger_action := 'cancel';
  ELSIF _action = 'mark_granted' AND v_request.status = 'approved' THEN
    v_new_status := 'granted';
    -- The legacy ledger enum models provisioning completion as approval.
    v_ledger_action := 'approve';
  ELSIF _action = 'revoke' AND v_request.status IN ('approved', 'granted') THEN
    v_new_status := 'revoked';
    v_ledger_action := 'revoke';
  ELSE
    RAISE EXCEPTION 'Invalid access request state transition'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.enterprise_access_requests
  SET status = v_new_status,
      decided_by = v_actor,
      decided_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.enterprise_access_decisions (
    request_id, action, actor_id
  ) VALUES (
    v_request.id, v_ledger_action, v_actor
  );

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'status', v_new_status,
    'action', _action
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.decide_access_request(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_access_request(uuid, uuid, text)
  TO authenticated;

-- Direct PostgREST access must enforce the same paid capability as the UI and
-- Edge APIs. Member rates are shared by Financials and Payroll; the remaining
-- tables have one product boundary.
DROP POLICY IF EXISTS "Members view member rates" ON public.enterprise_member_rates;
DROP POLICY IF EXISTS "Admins view member rates" ON public.enterprise_member_rates;
DROP POLICY IF EXISTS "Admins insert member rates" ON public.enterprise_member_rates;
DROP POLICY IF EXISTS "Admins update member rates" ON public.enterprise_member_rates;
DROP POLICY IF EXISTS "Admins delete member rates" ON public.enterprise_member_rates;
CREATE POLICY "Entitled admins view member rates" ON public.enterprise_member_rates
  FOR SELECT TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials', 'payroll_engine'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_member_rates.membership_id
        AND membership.workspace_id = enterprise_member_rates.workspace_id
    )
  );
CREATE POLICY "Entitled admins insert member rates" ON public.enterprise_member_rates
  FOR INSERT TO authenticated WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials', 'payroll_engine'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_member_rates.membership_id
        AND membership.workspace_id = enterprise_member_rates.workspace_id
    )
  );
CREATE POLICY "Entitled admins update member rates" ON public.enterprise_member_rates
  FOR UPDATE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials', 'payroll_engine'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_member_rates.membership_id
        AND membership.workspace_id = enterprise_member_rates.workspace_id
    )
  ) WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials', 'payroll_engine'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_member_rates.membership_id
        AND membership.workspace_id = enterprise_member_rates.workspace_id
    )
  );
CREATE POLICY "Entitled admins delete member rates" ON public.enterprise_member_rates
  FOR DELETE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials', 'payroll_engine'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_member_rates.membership_id
        AND membership.workspace_id = enterprise_member_rates.workspace_id
    )
  );

DROP POLICY IF EXISTS "Members view project rates" ON public.enterprise_project_rates;
DROP POLICY IF EXISTS "Admins insert project rates" ON public.enterprise_project_rates;
DROP POLICY IF EXISTS "Admins update project rates" ON public.enterprise_project_rates;
DROP POLICY IF EXISTS "Admins delete project rates" ON public.enterprise_project_rates;
CREATE POLICY "Entitled members view project rates" ON public.enterprise_project_rates
  FOR SELECT TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_projects AS project
      WHERE project.id = enterprise_project_rates.project_id
        AND project.workspace_id = enterprise_project_rates.workspace_id
    )
  );
CREATE POLICY "Entitled admins insert project rates" ON public.enterprise_project_rates
  FOR INSERT TO authenticated WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_projects AS project
      WHERE project.id = enterprise_project_rates.project_id
        AND project.workspace_id = enterprise_project_rates.workspace_id
    )
  );
CREATE POLICY "Entitled admins update project rates" ON public.enterprise_project_rates
  FOR UPDATE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_projects AS project
      WHERE project.id = enterprise_project_rates.project_id
        AND project.workspace_id = enterprise_project_rates.workspace_id
    )
  ) WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_projects AS project
      WHERE project.id = enterprise_project_rates.project_id
        AND project.workspace_id = enterprise_project_rates.workspace_id
    )
  );
CREATE POLICY "Entitled admins delete project rates" ON public.enterprise_project_rates
  FOR DELETE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['financials'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_projects AS project
      WHERE project.id = enterprise_project_rates.project_id
        AND project.workspace_id = enterprise_project_rates.workspace_id
    )
  );

DROP POLICY IF EXISTS "payroll_periods_select" ON public.payroll_periods;
DROP POLICY IF EXISTS "payroll_periods_insert" ON public.payroll_periods;
DROP POLICY IF EXISTS "payroll_periods_update" ON public.payroll_periods;
DROP POLICY IF EXISTS "payroll_periods_delete" ON public.payroll_periods;
CREATE POLICY "payroll_periods_select" ON public.payroll_periods
  FOR SELECT TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_engine'])
  );
CREATE POLICY "payroll_periods_insert" ON public.payroll_periods
  FOR INSERT TO authenticated WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_engine'])
  );
CREATE POLICY "payroll_periods_update" ON public.payroll_periods
  FOR UPDATE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_engine'])
  ) WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_engine'])
  );
CREATE POLICY "payroll_periods_delete" ON public.payroll_periods
  FOR DELETE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_engine'])
  );

DROP POLICY IF EXISTS "payroll_export_configs_select" ON public.payroll_export_configs;
DROP POLICY IF EXISTS "payroll_export_configs_insert" ON public.payroll_export_configs;
DROP POLICY IF EXISTS "payroll_export_configs_update" ON public.payroll_export_configs;
DROP POLICY IF EXISTS "payroll_export_configs_delete" ON public.payroll_export_configs;
CREATE POLICY "payroll_export_configs_select" ON public.payroll_export_configs
  FOR SELECT TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_export'])
  );
CREATE POLICY "payroll_export_configs_insert" ON public.payroll_export_configs
  FOR INSERT TO authenticated WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_export'])
  );
CREATE POLICY "payroll_export_configs_update" ON public.payroll_export_configs
  FOR UPDATE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_export'])
  ) WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_export'])
  );
CREATE POLICY "payroll_export_configs_delete" ON public.payroll_export_configs
  FOR DELETE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['payroll_export'])
  );

-- Scenario planning is a paid capability. The historical policies only checked
-- workspace membership/role, so a direct PostgREST caller could bypass the UI
-- feature gate. Assignment rows must also belong to the referenced scenario's
-- workspace; this prevents cross-workspace graph corruption.
DROP POLICY IF EXISTS "Members view scenarios" ON public.enterprise_scenarios;
DROP POLICY IF EXISTS "Admins insert scenarios" ON public.enterprise_scenarios;
DROP POLICY IF EXISTS "Admins update scenarios" ON public.enterprise_scenarios;
DROP POLICY IF EXISTS "Admins delete scenarios" ON public.enterprise_scenarios;
CREATE POLICY "Entitled members view scenarios" ON public.enterprise_scenarios
  FOR SELECT TO authenticated USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
  );
CREATE POLICY "Entitled admins insert scenarios" ON public.enterprise_scenarios
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
  );
CREATE POLICY "Entitled admins update scenarios" ON public.enterprise_scenarios
  FOR UPDATE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
  ) WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
  );
CREATE POLICY "Entitled admins delete scenarios" ON public.enterprise_scenarios
  FOR DELETE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
  );

DROP POLICY IF EXISTS "Members view scenario asgn" ON public.enterprise_scenario_assignments;
DROP POLICY IF EXISTS "Admins insert scenario asgn" ON public.enterprise_scenario_assignments;
DROP POLICY IF EXISTS "Admins update scenario asgn" ON public.enterprise_scenario_assignments;
DROP POLICY IF EXISTS "Admins delete scenario asgn" ON public.enterprise_scenario_assignments;
CREATE POLICY "Entitled members view scenario assignments" ON public.enterprise_scenario_assignments
  FOR SELECT TO authenticated USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_scenarios AS scenario
      WHERE scenario.id = enterprise_scenario_assignments.scenario_id
        AND scenario.workspace_id = enterprise_scenario_assignments.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM public.enterprise_projects AS project
      WHERE project.id = enterprise_scenario_assignments.project_id
        AND project.workspace_id = enterprise_scenario_assignments.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS member
      WHERE member.id = enterprise_scenario_assignments.membership_id
        AND member.workspace_id = enterprise_scenario_assignments.workspace_id
    )
  );
CREATE POLICY "Entitled admins insert scenario assignments" ON public.enterprise_scenario_assignments
  FOR INSERT TO authenticated WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_scenarios AS scenario
      WHERE scenario.id = enterprise_scenario_assignments.scenario_id
        AND scenario.workspace_id = enterprise_scenario_assignments.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM public.enterprise_projects AS project
      WHERE project.id = enterprise_scenario_assignments.project_id
        AND project.workspace_id = enterprise_scenario_assignments.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS member
      WHERE member.id = enterprise_scenario_assignments.membership_id
        AND member.workspace_id = enterprise_scenario_assignments.workspace_id
    )
  );
CREATE POLICY "Entitled admins update scenario assignments" ON public.enterprise_scenario_assignments
  FOR UPDATE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
  ) WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_scenarios AS scenario
      WHERE scenario.id = enterprise_scenario_assignments.scenario_id
        AND scenario.workspace_id = enterprise_scenario_assignments.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM public.enterprise_projects AS project
      WHERE project.id = enterprise_scenario_assignments.project_id
        AND project.workspace_id = enterprise_scenario_assignments.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS member
      WHERE member.id = enterprise_scenario_assignments.membership_id
        AND member.workspace_id = enterprise_scenario_assignments.workspace_id
    )
  );
CREATE POLICY "Entitled admins delete scenario assignments" ON public.enterprise_scenario_assignments
  FOR DELETE TO authenticated USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND public.workspace_has_any_feature(workspace_id, ARRAY['scenario_planner'])
  );

-- A shallow JSON object patch is sufficient for the two independently-owned
-- settings keys and, unlike client read/replace/write, is atomic and preserves
-- concurrent invitation/demo metadata stored under other top-level keys.
CREATE OR REPLACE FUNCTION public.patch_workspace_settings(
  _workspace_id uuid,
  _name text,
  _description text,
  _settings_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_enterprise_role(
       _workspace_id,
       auth.uid(),
       ARRAY['owner'::public.enterprise_role]
     ) THEN
    RAISE EXCEPTION 'Workspace owner role required' USING ERRCODE = '42501';
  END IF;
  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'Workspace name is required' USING ERRCODE = '22023';
  END IF;
  IF _settings_patch IS NULL OR jsonb_typeof(_settings_patch) <> 'object' THEN
    RAISE EXCEPTION 'Settings patch must be a JSON object' USING ERRCODE = '22023';
  END IF;

  UPDATE public.enterprise_workspaces
  SET name = btrim(_name),
      description = NULLIF(btrim(_description), ''),
      settings = COALESCE(settings, '{}'::jsonb) || _settings_patch
  WHERE id = _workspace_id
  RETURNING id INTO v_workspace_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('ok', true, 'workspace_id', v_workspace_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.patch_workspace_settings(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patch_workspace_settings(uuid, text, text, jsonb) TO authenticated;

-- Membership access fields are a security boundary, not ordinary editable
-- profile metadata. Authenticated users cannot create memberships directly;
-- accepted invitations and audited service/security-definer workflows do so.
DROP POLICY IF EXISTS "Owners and assistants can add members" ON public.enterprise_memberships;
DROP POLICY IF EXISTS "Owners and assistants can update members" ON public.enterprise_memberships;
-- Membership removal is represented by the guarded status workflow. Direct
-- DELETE is unused by the UI and could otherwise delete the caller/last owner
-- while cascading workspace-owned records.
DROP POLICY IF EXISTS "Owners can remove members" ON public.enterprise_memberships;

CREATE POLICY "Workspace admins update member metadata"
  ON public.enterprise_memberships FOR UPDATE TO authenticated
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

CREATE OR REPLACE FUNCTION public.guard_enterprise_membership_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- UUID foreign keys are globally valid but still tenant-local. Enforce the
  -- workspace domain for every membership write, including trusted workflows.
  IF NEW.office_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_offices AS office
    WHERE office.id = NEW.office_id AND office.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Membership office must belong to the same workspace'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.org_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_org_units AS org_unit
    WHERE org_unit.id = NEW.org_unit_id AND org_unit.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Membership organization unit must belong to the same workspace'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_memberships AS manager
    WHERE manager.id = NEW.manager_id
      AND manager.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Membership manager must be active in the same workspace'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.contract_type_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_contract_types AS contract_type
    WHERE contract_type.id = NEW.contract_type_id
      AND contract_type.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Membership contract type must belong to the same workspace'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.leadership_level_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_leadership_levels AS leadership_level
    WHERE leadership_level.id = NEW.leadership_level_id
      AND leadership_level.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Membership leadership level must belong to the same workspace'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.position_catalog_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_workspace_roles AS workspace_role
    WHERE workspace_role.id = NEW.position_catalog_id
      AND workspace_role.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Membership position must belong to the same workspace'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.business_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.enterprise_workspace_roles AS workspace_role
    WHERE workspace_role.id = NEW.business_role_id
      AND workspace_role.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'Membership business role must belong to the same workspace'
      USING ERRCODE = '23514';
  END IF;

  -- Trusted service-role and SECURITY DEFINER workflows keep their explicit
  -- contracts. Direct PostgREST writes run as the authenticated DB role.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Memberships must be created through an accepted invitation'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Membership identity fields are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.has_enterprise_role(
      OLD.workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role]
    ) THEN
      RAISE EXCEPTION 'Only a workspace owner may change membership role or status'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'Workspace owners cannot change their own role or status directly'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'invited'::public.enterprise_membership_status
       AND OLD.status <> 'invited'::public.enterprise_membership_status THEN
      RAISE EXCEPTION 'An existing membership cannot be moved back to invited status'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_enterprise_membership_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_enterprise_membership_mutation ON public.enterprise_memberships;
CREATE TRIGGER guard_enterprise_membership_mutation
  BEFORE INSERT OR UPDATE ON public.enterprise_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_enterprise_membership_mutation();

-- Resource assistants may invite ordinary members but cannot mint owner or
-- assistant invitations, re-role elevated invitations, or forge acceptance.
DROP POLICY IF EXISTS "Owners and assistants can create invitations" ON public.enterprise_invitations;
DROP POLICY IF EXISTS "Workspace admins can update invitations" ON public.enterprise_invitations;
CREATE POLICY "Owners and assistants create bounded invitations"
  ON public.enterprise_invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
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
  WITH CHECK (
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
  );

-- Possessing a JWT whose email matches an invitation is not proof that the
-- mailbox owner received that specific opaque token. Only workspace admins may
-- list invitation rows; recipients use the token delivered out of band.
DROP POLICY IF EXISTS "Admins or invitee can view invitations" ON public.enterprise_invitations;
DROP POLICY IF EXISTS "Admins view workspace invitations" ON public.enterprise_invitations;
CREATE POLICY "Admins view workspace invitations"
  ON public.enterprise_invitations FOR SELECT TO authenticated
  USING (
    public.has_enterprise_role(
      workspace_id,
      auth.uid(),
      ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
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

REVOKE ALL ON FUNCTION public.guard_enterprise_invitation_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_enterprise_invitation_mutation ON public.enterprise_invitations;
CREATE TRIGGER guard_enterprise_invitation_mutation
  BEFORE INSERT OR UPDATE ON public.enterprise_invitations
  FOR EACH ROW EXECUTE FUNCTION public.guard_enterprise_invitation_mutation();

CREATE OR REPLACE FUNCTION public.set_workspace_invitation_prefill(
  _workspace_id uuid,
  _invitation_id uuid,
  _prefill jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_is_owner boolean;
  v_invitation public.enterprise_invitations%ROWTYPE;
BEGIN
  -- Match the acceptance lock order (invitation, then workspace). Once this row
  -- is locked, acceptance cannot consume the invitation between validation and
  -- the settings update, and a completed/expired invite can never gain an
  -- orphaned prefill afterwards.
  SELECT * INTO v_invitation
  FROM public.enterprise_invitations
  WHERE id = _invitation_id AND workspace_id = _workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found in workspace' USING ERRCODE = 'P0002';
  END IF;
  IF v_invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been accepted' USING ERRCODE = '55000';
  END IF;
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '55000';
  END IF;

  v_is_owner := auth.uid() IS NOT NULL AND public.has_enterprise_role(
    _workspace_id,
    auth.uid(),
    ARRAY['owner'::public.enterprise_role]
  );
  IF NOT v_is_owner AND (
    auth.uid() IS NULL
    OR NOT public.has_enterprise_role(
      _workspace_id,
      auth.uid(),
      ARRAY['resourceAssistant'::public.enterprise_role]
    )
    OR v_invitation.role <> 'member'::public.enterprise_role
  ) THEN
    RAISE EXCEPTION 'Workspace administrator role required' USING ERRCODE = '42501';
  END IF;
  IF _prefill IS NULL OR jsonb_typeof(_prefill) <> 'object' THEN
    RAISE EXCEPTION 'Invitation prefill must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF octet_length(_prefill::text) > 65536 THEN
    RAISE EXCEPTION 'Invitation prefill exceeds 64 KiB' USING ERRCODE = '22023';
  END IF;
  UPDATE public.enterprise_workspaces
  SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{invitation_prefills}',
    COALESCE(settings -> 'invitation_prefills', '{}'::jsonb)
      || jsonb_build_object(_invitation_id::text, _prefill),
    true
  )
  WHERE id = _workspace_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_workspace_invitation_prefill(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_workspace_invitation_prefill(uuid, uuid, jsonb) TO authenticated;

-- Removes only one invitation's prefill under a row lock. Returning the value
-- supports audited service consumers without ever writing a stale settings
-- snapshot over concurrent workspace changes.
CREATE OR REPLACE FUNCTION public.consume_workspace_invitation_prefill(
  _workspace_id uuid,
  _invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_settings jsonb;
  v_prefills jsonb;
  v_prefill jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(settings, '{}'::jsonb)
  INTO v_settings
  FROM public.enterprise_workspaces
  WHERE id = _workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found' USING ERRCODE = 'P0002';
  END IF;

  v_prefills := COALESCE(v_settings -> 'invitation_prefills', '{}'::jsonb);
  IF jsonb_typeof(v_prefills) <> 'object' THEN
    v_prefills := '{}'::jsonb;
  END IF;
  v_prefill := COALESCE(v_prefills -> _invitation_id::text, '{}'::jsonb);
  v_prefills := v_prefills - _invitation_id::text;

  IF v_prefills = '{}'::jsonb THEN
    v_settings := v_settings - 'invitation_prefills';
  ELSE
    v_settings := jsonb_set(v_settings, '{invitation_prefills}', v_prefills, true);
  END IF;
  UPDATE public.enterprise_workspaces
  SET settings = v_settings
  WHERE id = _workspace_id;

  RETURN v_prefill;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_workspace_invitation_prefill(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_workspace_invitation_prefill(uuid, uuid)
  TO service_role;

-- Token creation is feature/UI gated, but the table boundary must still stop
-- ordinary members from minting a workspace-wide team feed directly.
DROP POLICY IF EXISTS "Users create own ical tokens" ON public.enterprise_ical_tokens;
CREATE POLICY "Users create entitled-scope ical tokens"
  ON public.enterprise_ical_tokens FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_enterprise_member(workspace_id, auth.uid())
    AND public.workspace_has_any_feature(workspace_id, ARRAY['ical_feed'])
    AND scope IN ('own', 'team')
    AND (
      scope = 'own'
      OR public.has_enterprise_role(
        workspace_id,
        auth.uid(),
        ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
      )
    )
  );

-- Quota identifiers were globally referenceable even though each row also
-- carries a workspace_id. Correlate every parent and repair the historical
-- refund trigger so a legacy approved row that never consumed quota cannot
-- manufacture a positive balance when cancelled.
DROP POLICY IF EXISTS "Members view own quotas" ON public.enterprise_leave_quotas;
DROP POLICY IF EXISTS "Admins insert quotas" ON public.enterprise_leave_quotas;
DROP POLICY IF EXISTS "Admins update quotas" ON public.enterprise_leave_quotas;
DROP POLICY IF EXISTS "Admins delete quotas" ON public.enterprise_leave_quotas;
CREATE POLICY "Members view tenant-local quotas"
  ON public.enterprise_leave_quotas FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_leave_quotas.membership_id
        AND membership.workspace_id = enterprise_leave_quotas.workspace_id
        AND (
          membership.user_id = auth.uid()
          OR public.has_enterprise_role(
            enterprise_leave_quotas.workspace_id,
            auth.uid(),
            ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
          )
        )
    )
  );
CREATE POLICY "Admins insert tenant-local quotas"
  ON public.enterprise_leave_quotas FOR INSERT TO authenticated
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_leave_quotas.membership_id
        AND membership.workspace_id = enterprise_leave_quotas.workspace_id
    )
  );
CREATE POLICY "Admins update tenant-local quotas"
  ON public.enterprise_leave_quotas FOR UPDATE TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_leave_quotas.membership_id
        AND membership.workspace_id = enterprise_leave_quotas.workspace_id
    )
  )
  WITH CHECK (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_leave_quotas.membership_id
        AND membership.workspace_id = enterprise_leave_quotas.workspace_id
    )
  );
CREATE POLICY "Owners delete tenant-local quotas"
  ON public.enterprise_leave_quotas FOR DELETE TO authenticated
  USING (
    public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role])
    AND EXISTS (
      SELECT 1 FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_leave_quotas.membership_id
        AND membership.workspace_id = enterprise_leave_quotas.workspace_id
    )
  );

DROP POLICY IF EXISTS "Members view own quota txns" ON public.enterprise_quota_transactions;
DROP POLICY IF EXISTS "Admins insert quota txns" ON public.enterprise_quota_transactions;
CREATE POLICY "Members view tenant-local quota transactions"
  ON public.enterprise_quota_transactions FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_leave_quotas AS quota
      JOIN public.enterprise_memberships AS membership
        ON membership.id = enterprise_quota_transactions.membership_id
       AND membership.workspace_id = enterprise_quota_transactions.workspace_id
      WHERE quota.id = enterprise_quota_transactions.quota_id
        AND quota.workspace_id = enterprise_quota_transactions.workspace_id
        AND quota.membership_id = membership.id
        AND (
          enterprise_quota_transactions.leave_request_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.leave_requests AS leave_request
            WHERE leave_request.id = enterprise_quota_transactions.leave_request_id
              AND leave_request.workspace_id = enterprise_quota_transactions.workspace_id
              AND leave_request.user_id = membership.user_id
          )
        )
        AND (
          membership.user_id = auth.uid()
          OR public.has_enterprise_role(
            enterprise_quota_transactions.workspace_id,
            auth.uid(),
            ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
          )
        )
    )
  );
CREATE POLICY "Admins insert tenant-local quota transactions"
  ON public.enterprise_quota_transactions FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role])
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_leave_quotas AS quota
      JOIN public.enterprise_memberships AS membership
        ON membership.id = enterprise_quota_transactions.membership_id
       AND membership.workspace_id = enterprise_quota_transactions.workspace_id
      WHERE quota.id = enterprise_quota_transactions.quota_id
        AND quota.workspace_id = enterprise_quota_transactions.workspace_id
        AND quota.membership_id = membership.id
        AND (
          enterprise_quota_transactions.leave_request_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.leave_requests AS leave_request
            WHERE leave_request.id = enterprise_quota_transactions.leave_request_id
              AND leave_request.workspace_id = enterprise_quota_transactions.workspace_id
              AND leave_request.user_id = membership.user_id
          )
        )
    )
  );

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
  v_year integer;
  v_net_amount numeric;
BEGIN
  IF TG_OP <> 'UPDATE' OR NOT (
    (OLD.status <> 'approved'::public.leave_request_status AND NEW.status = 'approved'::public.leave_request_status)
    OR (OLD.status = 'approved'::public.leave_request_status AND NEW.status = 'cancelled'::public.leave_request_status)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT membership.id
  INTO v_membership_id
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = NEW.workspace_id
    AND membership.user_id = NEW.user_id
  LIMIT 1;
  IF v_membership_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_year := EXTRACT(YEAR FROM NEW.start_date)::integer;
  v_days := public.calc_leave_days(
    NEW.start_date,
    NEW.end_date,
    COALESCE(NEW.is_half_day, false)
  );

  SELECT quota.id
  INTO v_quota_id
  FROM public.enterprise_leave_quotas AS quota
  WHERE quota.workspace_id = NEW.workspace_id
    AND quota.membership_id = v_membership_id
    AND quota.leave_type = NEW.leave_type
    AND quota.year = v_year
  FOR UPDATE;

  IF v_quota_id IS NULL THEN
    INSERT INTO public.enterprise_leave_quotas (
      workspace_id, membership_id, leave_type, year, initial_days
    ) VALUES (
      NEW.workspace_id, v_membership_id, NEW.leave_type, v_year, 0
    )
    ON CONFLICT (workspace_id, membership_id, leave_type, year) DO NOTHING
    RETURNING id INTO v_quota_id;

    IF v_quota_id IS NULL THEN
      SELECT quota.id
      INTO v_quota_id
      FROM public.enterprise_leave_quotas AS quota
      WHERE quota.workspace_id = NEW.workspace_id
        AND quota.membership_id = v_membership_id
        AND quota.leave_type = NEW.leave_type
        AND quota.year = v_year
      FOR UPDATE;
    END IF;
  END IF;

  IF OLD.status <> 'approved'::public.leave_request_status
     AND NEW.status = 'approved'::public.leave_request_status
     AND NOT EXISTS (
       SELECT 1
       FROM public.enterprise_quota_transactions AS quota_txn
       WHERE quota_txn.leave_request_id = NEW.id
         AND quota_txn.workspace_id = NEW.workspace_id
         AND quota_txn.quota_id = v_quota_id
         AND quota_txn.membership_id = v_membership_id
         AND quota_txn.transaction_type = 'consume'::public.quota_transaction_type
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

  IF OLD.status = 'approved'::public.leave_request_status
     AND NEW.status = 'cancelled'::public.leave_request_status THEN
    SELECT COALESCE(sum(quota_txn.amount_days), 0)
    INTO v_net_amount
    FROM public.enterprise_quota_transactions AS quota_txn
    WHERE quota_txn.leave_request_id = NEW.id
      AND quota_txn.workspace_id = NEW.workspace_id
      AND quota_txn.quota_id = v_quota_id
      AND quota_txn.membership_id = v_membership_id
      AND quota_txn.transaction_type IN (
        'consume'::public.quota_transaction_type,
        'refund'::public.quota_transaction_type
      );

    IF v_net_amount < 0 THEN
      INSERT INTO public.enterprise_quota_transactions (
        workspace_id, quota_id, membership_id, leave_request_id,
        transaction_type, amount_days, reason, created_by
      ) VALUES (
        NEW.workspace_id, v_quota_id, v_membership_id, NEW.id,
        'refund'::public.quota_transaction_type, -v_net_amount,
        'Auto-refund on cancellation', COALESCE(NEW.reviewer_id, NEW.user_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_leave_quota_change()
  FROM PUBLIC, anon, authenticated;

-- Keep leave state transitions and their decision ledger behind the atomic RPC
-- below. The historical INSERT policy allowed a caller to submit an already
-- approved row, while the broad admin UPDATE/decision INSERT policies allowed
-- approval without the matching ledger and audit event.
DROP POLICY IF EXISTS "Members can view workspace leave requests" ON public.leave_requests;
CREATE POLICY "Authorized users view leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    public.is_enterprise_member(workspace_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR public.has_workspace_permission(
        workspace_id,
        auth.uid(),
        'approvals',
        'readonly'
      )
      OR (
        NOT COALESCE(is_private, false)
        AND public.has_workspace_permission(
          workspace_id,
          auth.uid(),
          'requests_team',
          'readonly'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Members can view approval decisions" ON public.approval_decisions;
CREATE POLICY "Authorized users view approval decisions"
  ON public.approval_decisions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.leave_requests AS leave_request
      WHERE leave_request.id = approval_decisions.leave_request_id
        AND leave_request.workspace_id = approval_decisions.workspace_id
        AND (
          leave_request.user_id = auth.uid()
          OR public.has_workspace_permission(
            approval_decisions.workspace_id,
            auth.uid(),
            'approvals',
            'readonly'
          )
        )
    )
  );

-- Deleting a request would cascade its decision ledger and detach quota audit
-- transactions. Cancellation is the only supported terminal user operation.
DROP POLICY IF EXISTS "Owners can delete leave requests" ON public.leave_requests;

DROP POLICY IF EXISTS "Members can create own leave requests" ON public.leave_requests;
CREATE POLICY "Members can create own pending leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_enterprise_member(workspace_id, auth.uid())
    AND status IN ('draft'::public.leave_request_status, 'pending'::public.leave_request_status)
    AND reviewer_id IS NULL
    AND reviewed_at IS NULL
    AND review_comment IS NULL
  );

DROP POLICY IF EXISTS "Requesters can update own pending requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update leave request metadata" ON public.leave_requests;
CREATE POLICY "Requesters can edit or cancel own leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND status IN (
      'draft'::public.leave_request_status,
      'pending'::public.leave_request_status,
      'approved'::public.leave_request_status
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_enterprise_member(workspace_id, auth.uid())
    AND status IN (
      'draft'::public.leave_request_status,
      'pending'::public.leave_request_status,
      'approved'::public.leave_request_status,
      'cancelled'::public.leave_request_status
    )
  );
CREATE POLICY "Admins can update leave request metadata"
  ON public.leave_requests FOR UPDATE TO authenticated
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

CREATE OR REPLACE FUNCTION public.guard_leave_request_direct_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_actor IS NULL
       OR NEW.user_id <> v_actor
       OR NEW.status NOT IN ('draft'::public.leave_request_status, 'pending'::public.leave_request_status)
       OR NEW.reviewer_id IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL
       OR NEW.review_comment IS NOT NULL THEN
      RAISE EXCEPTION 'Leave requests must be submitted by the requester as draft or pending'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Leave request identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.review_comment IS DISTINCT FROM OLD.review_comment THEN
    RAISE EXCEPTION 'Review metadata can only be written by decide_leave_request'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_actor IS NULL OR v_actor <> OLD.user_id OR NOT (
      (OLD.status = 'draft'::public.leave_request_status
        AND NEW.status IN ('pending'::public.leave_request_status, 'cancelled'::public.leave_request_status))
      OR (OLD.status = 'pending'::public.leave_request_status
        AND NEW.status = 'cancelled'::public.leave_request_status)
      OR (OLD.status = 'approved'::public.leave_request_status
        AND NEW.status = 'cancelled'::public.leave_request_status)
    ) THEN
      RAISE EXCEPTION 'Leave decisions can only be written by decide_leave_request'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF OLD.status = 'approved'::public.leave_request_status
     AND (
       to_jsonb(NEW) - ARRAY['status', 'cancellation_reason', 'updated_at']::text[]
       <> to_jsonb(OLD) - ARRAY['status', 'cancellation_reason', 'updated_at']::text[]
     ) THEN
    RAISE EXCEPTION 'An approved leave request can only be withdrawn'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_leave_request_direct_mutation ON public.leave_requests;
CREATE TRIGGER guard_leave_request_direct_mutation
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_leave_request_direct_mutation();

DROP POLICY IF EXISTS "Admins can create approval decisions" ON public.approval_decisions;

CREATE OR REPLACE FUNCTION public.guard_approval_decision_direct_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Approval decisions can only be written by decide_leave_request'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_approval_decision_direct_mutation ON public.approval_decisions;
CREATE TRIGGER guard_approval_decision_direct_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.approval_decisions
  FOR EACH ROW EXECUTE FUNCTION public.guard_approval_decision_direct_mutation();

-- The mounted admin-override workflow intentionally creates a request for a
-- different active member and may approve it immediately. Keep that exception
-- explicit and atomic instead of reopening broad table policies.
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
  IF NOT EXISTS (
    SELECT 1 FROM public.enterprise_memberships
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
    _workspace_id,
    _user_id,
    _leave_type::public.leave_type,
    _start_date,
    _end_date,
    'pending'::public.leave_request_status,
    v_comment,
    _is_half_day,
    CASE WHEN _is_half_day THEN _half_day_period ELSE NULL END,
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_request_id;

  IF _auto_approve THEN
    -- Use the ordinary pending -> approved transition so the existing quota
    -- accounting trigger runs in the same transaction.
    UPDATE public.leave_requests
    SET status = 'approved'::public.leave_request_status,
        reviewer_id = v_actor,
        reviewed_at = now(),
        review_comment = 'Admin override: ' || v_justification
    WHERE id = v_request_id;

    INSERT INTO public.approval_decisions (
      leave_request_id, workspace_id, decided_by, decision, comment
    ) VALUES (
      v_request_id,
      _workspace_id,
      v_actor,
      'approved'::public.leave_request_status,
      v_justification
    );
  END IF;

  INSERT INTO public.enterprise_audit_events (
    workspace_id, actor_id, action, target_type, target_id,
    affected_user_id, prev_state, new_state, metadata
  ) VALUES (
    _workspace_id,
    v_actor,
    'leave_request.admin_override',
    'leave_request',
    v_request_id,
    _user_id,
    NULL,
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

-- Status transition, decision ledger and immutable audit event must commit or
-- roll back together. Row locking prevents two approvers from deciding the
-- same pending request concurrently.
CREATE OR REPLACE FUNCTION public.decide_leave_request(
  _workspace_id uuid,
  _request_id uuid,
  _decision text,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_request public.leave_requests%ROWTYPE;
  v_decision public.leave_request_status;
BEGIN
  IF v_actor IS NULL
     OR NOT public.has_workspace_permission(
       _workspace_id,
       v_actor,
       'approvals',
       'edit'
     ) THEN
    RAISE EXCEPTION 'Approval edit permission required' USING ERRCODE = '42501';
  END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected' USING ERRCODE = '22023';
  END IF;
  v_decision := _decision::public.leave_request_status;

  SELECT * INTO v_request
  FROM public.leave_requests
  WHERE id = _request_id AND workspace_id = _workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status <> 'pending'::public.leave_request_status THEN
    RAISE EXCEPTION 'Leave request is no longer pending' USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS target_member
    WHERE target_member.workspace_id = v_request.workspace_id
      AND target_member.user_id = v_request.user_id
      AND target_member.status = 'active'::public.enterprise_membership_status
  ) THEN
    RAISE EXCEPTION 'Leave requester is not an active workspace member'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.leave_requests
  SET status = v_decision,
      reviewer_id = v_actor,
      reviewed_at = now(),
      review_comment = NULLIF(btrim(_comment), '')
  WHERE id = v_request.id;

  INSERT INTO public.approval_decisions (
    leave_request_id, workspace_id, decided_by, decision, comment
  ) VALUES (
    v_request.id, _workspace_id, v_actor, v_decision, NULLIF(btrim(_comment), '')
  );

  INSERT INTO public.enterprise_audit_events (
    workspace_id, actor_id, action, target_type, target_id,
    affected_user_id, prev_state, new_state, metadata
  ) VALUES (
    _workspace_id,
    v_actor,
    CASE WHEN v_decision = 'approved'::public.leave_request_status
      THEN 'leave_request.approved' ELSE 'leave_request.rejected' END,
    'leave_request',
    v_request.id,
    v_request.user_id,
    jsonb_build_object('status', v_request.status),
    jsonb_build_object('status', v_decision),
    jsonb_build_object('comment', NULLIF(btrim(_comment), ''))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'affected_user_id', v_request.user_id,
    'decision', v_decision
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.decide_leave_request(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_leave_request(uuid, uuid, text, text) TO authenticated;

-- 429 attempts are operationally distinct from failed/dlq attempts and the
-- worker already emits this status. Align the persisted contract.
ALTER TABLE public.email_send_log
  DROP CONSTRAINT IF EXISTS email_send_log_status_check;
ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_status_check CHECK (
    status IN (
      'pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained',
      'dlq', 'rate_limited'
    )
  );

-- Reproducible queue worker scheduling. Project-specific values stay in Vault;
-- absence of either secret is explicit and leaves no cross-project fallback.
DO $unschedule_email_worker$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;
END
$unschedule_email_worker$;

DO $schedule_email_worker$
DECLARE
  v_base_url text;
  v_has_service_key boolean;
BEGIN
  SELECT decrypted_secret INTO v_base_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_function_base_url'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
      AND decrypted_secret IS NOT NULL
      AND decrypted_secret <> ''
  ) INTO v_has_service_key;

  IF v_base_url IS NULL OR v_base_url = '' OR NOT v_has_service_key THEN
    RAISE NOTICE 'Email queue cron not installed: configure supabase_function_base_url and email_queue_service_role_key in Vault';
    RETURN;
  END IF;
  IF v_base_url !~ '^https://[a-z0-9-]+[.]supabase[.]co/?$' THEN
    RAISE EXCEPTION 'Invalid supabase_function_base_url Vault secret';
  END IF;

  PERFORM cron.schedule(
    'process-email-queue',
    '5 seconds',
    $job$
    SELECT net.http_post(
      url := rtrim(endpoint.decrypted_secret, '/') || '/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || credential.decrypted_secret
      ),
      body := '{}'::jsonb
    ) AS request_id
    FROM vault.decrypted_secrets AS endpoint
    CROSS JOIN vault.decrypted_secrets AS credential
    WHERE endpoint.name = 'supabase_function_base_url'
      AND credential.name = 'email_queue_service_role_key'
      AND endpoint.decrypted_secret ~ '^https://[a-z0-9-]+[.]supabase[.]co/?$'
      AND (
        EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
        OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
      );
    $job$
  );
END
$schedule_email_worker$;

DO $unschedule_report_worker$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-scheduled-reports-hourly') THEN
    PERFORM cron.unschedule('send-scheduled-reports-hourly');
  END IF;
END
$unschedule_report_worker$;

DO $schedule_report_worker$
DECLARE
  v_base_url text;
  v_has_service_key boolean;
BEGIN
  SELECT decrypted_secret INTO v_base_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_function_base_url'
  LIMIT 1;
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
      AND decrypted_secret IS NOT NULL
      AND decrypted_secret <> ''
  ) INTO v_has_service_key;

  IF v_base_url IS NULL OR v_base_url = '' OR NOT v_has_service_key THEN
    RAISE NOTICE 'Scheduled report cron not installed: configure supabase_function_base_url and email_queue_service_role_key in Vault';
    RETURN;
  END IF;
  IF v_base_url !~ '^https://[a-z0-9-]+[.]supabase[.]co/?$' THEN
    RAISE EXCEPTION 'Invalid supabase_function_base_url Vault secret';
  END IF;

  PERFORM cron.schedule(
    'send-scheduled-reports-hourly',
    '0 * * * *',
    $job$
    SELECT net.http_post(
      url := rtrim(endpoint.decrypted_secret, '/') || '/functions/v1/send-scheduled-reports',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || credential.decrypted_secret
      ),
      body := '{}'::jsonb
    ) AS request_id
    FROM vault.decrypted_secrets AS endpoint
    CROSS JOIN vault.decrypted_secrets AS credential
    WHERE endpoint.name = 'supabase_function_base_url'
      AND credential.name = 'email_queue_service_role_key'
      AND endpoint.decrypted_secret ~ '^https://[a-z0-9-]+[.]supabase[.]co/?$';
    $job$
  );
END
$schedule_report_worker$;
