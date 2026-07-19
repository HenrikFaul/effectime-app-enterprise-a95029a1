-- HR workflow tenant-boundary repair.
--
-- Forward-only and data-lossless by design:
--   * existing malformed references are counted, never rewritten or deleted;
--   * new cross-workspace/inactive references are rejected by write guards;
--   * member RLS and admin list joins fail closed for legacy malformed rows;
--   * user-context SECURITY DEFINER RPCs are executable by authenticated only.

DO $inventory$
DECLARE
  v_instance_template_mismatch bigint;
  v_instance_membership_mismatch bigint;
  v_instance_inactive_membership bigint;
  v_task_instance_mismatch bigint;
  v_task_assignee_mismatch bigint;
  v_task_inactive_assignee bigint;
BEGIN
  SELECT count(*)
  INTO v_instance_template_mismatch
  FROM public.enterprise_hr_workflow_instances AS instance
  WHERE instance.template_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.enterprise_hr_workflow_templates AS template
      WHERE template.id = instance.template_id
        AND template.workspace_id = instance.workspace_id
    );

  SELECT count(*)
  INTO v_instance_membership_mismatch
  FROM public.enterprise_hr_workflow_instances AS instance
  WHERE instance.membership_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = instance.membership_id
        AND membership.workspace_id = instance.workspace_id
    );

  SELECT count(*)
  INTO v_instance_inactive_membership
  FROM public.enterprise_hr_workflow_instances AS instance
  JOIN public.enterprise_memberships AS membership
    ON membership.id = instance.membership_id
   AND membership.workspace_id = instance.workspace_id
  WHERE membership.status <> 'active'::public.enterprise_membership_status;

  SELECT count(*)
  INTO v_task_instance_mismatch
  FROM public.enterprise_hr_workflow_tasks AS task
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_instances AS instance
    WHERE instance.id = task.instance_id
      AND instance.workspace_id = task.workspace_id
  );

  SELECT count(*)
  INTO v_task_assignee_mismatch
  FROM public.enterprise_hr_workflow_tasks AS task
  WHERE task.assignee_membership_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = task.assignee_membership_id
        AND membership.workspace_id = task.workspace_id
    );

  SELECT count(*)
  INTO v_task_inactive_assignee
  FROM public.enterprise_hr_workflow_tasks AS task
  JOIN public.enterprise_memberships AS membership
    ON membership.id = task.assignee_membership_id
   AND membership.workspace_id = task.workspace_id
  WHERE membership.status <> 'active'::public.enterprise_membership_status;

  RAISE WARNING
    'HR workflow tenant inventory: instance_template_mismatch=%, instance_membership_mismatch=%, instance_inactive_membership=%, task_instance_mismatch=%, task_assignee_mismatch=%, task_inactive_assignee=%',
    v_instance_template_mismatch,
    v_instance_membership_mismatch,
    v_instance_inactive_membership,
    v_task_instance_mismatch,
    v_task_assignee_mismatch,
    v_task_inactive_assignee;
END;
$inventory$;

CREATE OR REPLACE FUNCTION public.guard_hr_workflow_tenant_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'enterprise_hr_workflow_templates' THEN
    IF TG_OP = 'UPDATE' AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'HR workflow template workspace is immutable'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'enterprise_hr_workflow_instances' THEN
    IF TG_OP = 'UPDATE' AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'HR workflow instance workspace is immutable'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.template_id IS NOT NULL THEN
      PERFORM 1
      FROM public.enterprise_hr_workflow_templates AS template
      WHERE template.id = NEW.template_id
        AND template.workspace_id = NEW.workspace_id
        AND template.is_active
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'HR workflow template must be active in the same workspace'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW.membership_id IS NOT NULL THEN
      PERFORM 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = NEW.membership_id
        AND membership.workspace_id = NEW.workspace_id
        AND membership.status = 'active'::public.enterprise_membership_status
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'HR workflow membership must be active in the same workspace'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'enterprise_hr_workflow_tasks' THEN
    IF TG_OP = 'UPDATE' AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'HR workflow task workspace is immutable'
        USING ERRCODE = '23514';
    END IF;

    PERFORM 1
    FROM public.enterprise_hr_workflow_instances AS instance
    WHERE instance.id = NEW.instance_id
      AND instance.workspace_id = NEW.workspace_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'HR workflow task instance must belong to the same workspace'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.assignee_membership_id IS NOT NULL THEN
      PERFORM 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = NEW.assignee_membership_id
        AND membership.workspace_id = NEW.workspace_id
        AND membership.status = 'active'::public.enterprise_membership_status
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'HR workflow assignee must be active in the same workspace'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unsupported HR workflow tenant guard target'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_hr_workflow_tenant_references()
  FROM PUBLIC, anon, authenticated, service_role;

-- Historical global UUID foreign keys can otherwise cascade or SET NULL across
-- tenants when malformed legacy rows exist. Preserve normal same-workspace FK
-- behavior, but fail closed before a parent operation can mutate another
-- workspace's workflow row. The aggregate inventory above identifies the rows
-- that must be reconciled before those parent deletes can proceed.
CREATE OR REPLACE FUNCTION public.guard_hr_workflow_cross_tenant_parent_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'enterprise_hr_workflow_templates' THEN
    IF EXISTS (
      SELECT 1
      FROM public.enterprise_hr_workflow_instances AS instance
      WHERE instance.template_id = OLD.id
        AND instance.workspace_id <> OLD.workspace_id
    ) THEN
      RAISE EXCEPTION 'Cannot delete HR workflow template with cross-workspace legacy references'
        USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME = 'enterprise_hr_workflow_instances' THEN
    IF EXISTS (
      SELECT 1
      FROM public.enterprise_hr_workflow_tasks AS task
      WHERE task.instance_id = OLD.id
        AND task.workspace_id <> OLD.workspace_id
    ) THEN
      RAISE EXCEPTION 'Cannot delete HR workflow instance with cross-workspace legacy references'
        USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME = 'enterprise_memberships' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
         AND (
           EXISTS (
             SELECT 1
             FROM public.enterprise_hr_workflow_instances AS instance
             WHERE instance.membership_id = OLD.id
           )
           OR EXISTS (
             SELECT 1
             FROM public.enterprise_hr_workflow_tasks AS task
             WHERE task.assignee_membership_id = OLD.id
           )
         ) THEN
        RAISE EXCEPTION 'Referenced HR workflow membership workspace is immutable'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.enterprise_hr_workflow_instances AS instance
      WHERE instance.membership_id = OLD.id
        AND instance.workspace_id <> OLD.workspace_id
    ) OR EXISTS (
      SELECT 1
      FROM public.enterprise_hr_workflow_tasks AS task
      WHERE task.assignee_membership_id = OLD.id
        AND task.workspace_id <> OLD.workspace_id
    ) THEN
      RAISE EXCEPTION 'Cannot delete HR workflow membership with cross-workspace legacy references'
        USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Unsupported HR workflow parent guard target'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_hr_workflow_cross_tenant_parent_change()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS hr_wf_templates_tenant_guard
  ON public.enterprise_hr_workflow_templates;
CREATE TRIGGER hr_wf_templates_tenant_guard
  BEFORE UPDATE OF workspace_id ON public.enterprise_hr_workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.guard_hr_workflow_tenant_references();

DROP TRIGGER IF EXISTS hr_wf_instances_tenant_guard
  ON public.enterprise_hr_workflow_instances;
CREATE TRIGGER hr_wf_instances_tenant_guard
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, membership_id
  ON public.enterprise_hr_workflow_instances
  FOR EACH ROW EXECUTE FUNCTION public.guard_hr_workflow_tenant_references();

DROP TRIGGER IF EXISTS hr_wf_tasks_tenant_guard
  ON public.enterprise_hr_workflow_tasks;
CREATE TRIGGER hr_wf_tasks_tenant_guard
  BEFORE INSERT OR UPDATE OF workspace_id, instance_id, assignee_membership_id
  ON public.enterprise_hr_workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_hr_workflow_tenant_references();

DROP TRIGGER IF EXISTS hr_wf_templates_parent_delete_guard
  ON public.enterprise_hr_workflow_templates;
CREATE TRIGGER hr_wf_templates_parent_delete_guard
  BEFORE DELETE ON public.enterprise_hr_workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.guard_hr_workflow_cross_tenant_parent_change();

DROP TRIGGER IF EXISTS hr_wf_instances_parent_delete_guard
  ON public.enterprise_hr_workflow_instances;
CREATE TRIGGER hr_wf_instances_parent_delete_guard
  BEFORE DELETE ON public.enterprise_hr_workflow_instances
  FOR EACH ROW EXECUTE FUNCTION public.guard_hr_workflow_cross_tenant_parent_change();

DROP TRIGGER IF EXISTS hr_wf_memberships_parent_change_guard
  ON public.enterprise_memberships;
CREATE TRIGGER hr_wf_memberships_parent_change_guard
  BEFORE DELETE OR UPDATE OF workspace_id ON public.enterprise_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_hr_workflow_cross_tenant_parent_change();

DROP POLICY IF EXISTS hr_wf_instances_admin_all
  ON public.enterprise_hr_workflow_instances;
CREATE POLICY hr_wf_instances_admin_all
  ON public.enterprise_hr_workflow_instances
  FOR ALL
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

DROP POLICY IF EXISTS hr_wf_instances_member_read
  ON public.enterprise_hr_workflow_instances;
CREATE POLICY hr_wf_instances_member_read
  ON public.enterprise_hr_workflow_instances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS membership
      WHERE membership.id = enterprise_hr_workflow_instances.membership_id
        AND membership.workspace_id = enterprise_hr_workflow_instances.workspace_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'::public.enterprise_membership_status
    )
  );

DROP POLICY IF EXISTS hr_wf_tasks_admin_all
  ON public.enterprise_hr_workflow_tasks;
CREATE POLICY hr_wf_tasks_admin_all
  ON public.enterprise_hr_workflow_tasks
  FOR ALL
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

-- Keep the RLS-only helper outside PostgREST's exposed public schema. The
-- authenticated role receives USAGE, never CREATE, and can only ask whether its
-- own JWT may read one task.
CREATE SCHEMA IF NOT EXISTS effectime_private;
REVOKE ALL ON SCHEMA effectime_private
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA effectime_private TO authenticated;

-- Evaluate the complete assignee path under the migration owner so the task
-- policy is not accidentally constrained by the parent instance's member-only
-- RLS policy.
CREATE OR REPLACE FUNCTION effectime_private.hr_workflow_can_read_assigned_task(
  p_task_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enterprise_hr_workflow_tasks AS task
    JOIN public.enterprise_hr_workflow_instances AS instance
      ON instance.id = task.instance_id
     AND instance.workspace_id = task.workspace_id
    JOIN public.enterprise_memberships AS membership
      ON membership.id = task.assignee_membership_id
     AND membership.workspace_id = task.workspace_id
    WHERE task.id = p_task_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'::public.enterprise_membership_status
  );
$function$;

REVOKE ALL ON FUNCTION effectime_private.hr_workflow_can_read_assigned_task(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION effectime_private.hr_workflow_can_read_assigned_task(uuid)
  TO authenticated;

DROP POLICY IF EXISTS hr_wf_tasks_assignee_read
  ON public.enterprise_hr_workflow_tasks;
CREATE POLICY hr_wf_tasks_assignee_read
  ON public.enterprise_hr_workflow_tasks
  FOR SELECT
  USING (
    effectime_private.hr_workflow_can_read_assigned_task(id)
  );

CREATE OR REPLACE FUNCTION public.hr_workflow_create_instance(
  p_workspace_id uuid,
  p_template_id uuid DEFAULT NULL,
  p_membership_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_category text DEFAULT 'custom',
  p_due_date date DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_instance_id uuid;
  v_title text;
  v_category text;
  v_steps jsonb;
  v_step jsonb;
  v_sort integer := 0;
  v_due_date date;
BEGIN
  IF NOT public.has_enterprise_role(
    p_workspace_id,
    auth.uid(),
    ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid HR workflow priority' USING ERRCODE = '22023';
  END IF;

  IF p_membership_id IS NOT NULL THEN
    PERFORM 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.id = p_membership_id
      AND membership.workspace_id = p_workspace_id
      AND membership.status = 'active'::public.enterprise_membership_status
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'HR workflow membership must be active in the same workspace'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF p_template_id IS NOT NULL THEN
    SELECT template.name, template.category, template.steps
    INTO v_title, v_category, v_steps
    FROM public.enterprise_hr_workflow_templates AS template
    WHERE template.id = p_template_id
      AND template.workspace_id = p_workspace_id
      AND template.is_active
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'HR workflow template must be active in the same workspace'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    v_title := COALESCE(p_title, 'Névtelen folyamat');
    v_category := p_category;
    v_steps := '[]'::jsonb;
  END IF;

  IF p_title IS NOT NULL THEN
    v_title := p_title;
  END IF;
  IF p_category IS NOT NULL AND p_category <> 'custom' THEN
    v_category := p_category;
  END IF;

  INSERT INTO public.enterprise_hr_workflow_instances (
    workspace_id,
    template_id,
    membership_id,
    title,
    category,
    status,
    priority,
    due_date,
    notes,
    created_by
  ) VALUES (
    p_workspace_id,
    p_template_id,
    p_membership_id,
    v_title,
    v_category,
    'open',
    p_priority,
    p_due_date,
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_instance_id;

  FOR v_step IN SELECT value FROM pg_catalog.jsonb_array_elements(v_steps) LOOP
    v_due_date := CASE
      WHEN p_due_date IS NOT NULL AND (v_step->>'due_offset_days') IS NOT NULL
        THEN p_due_date + (v_step->>'due_offset_days')::integer
      ELSE NULL
    END;

    INSERT INTO public.enterprise_hr_workflow_tasks (
      workspace_id,
      instance_id,
      title,
      description,
      due_date,
      sort_order
    ) VALUES (
      p_workspace_id,
      v_instance_id,
      COALESCE(v_step->>'title', 'Feladat'),
      v_step->>'description',
      v_due_date,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  RETURN v_instance_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hr_workflow_update_task(
  p_task_id uuid,
  p_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_workspace_id uuid;
  v_instance_id uuid;
  v_assignee_membership_id uuid;
  v_current_status text;
BEGIN
  IF p_status NOT IN ('pending', 'in_progress', 'done', 'skipped') THEN
    RAISE EXCEPTION 'Invalid HR workflow task status' USING ERRCODE = '22023';
  END IF;

  SELECT task.workspace_id, task.instance_id, task.assignee_membership_id, task.status
  INTO v_workspace_id, v_instance_id, v_assignee_membership_id, v_current_status
  FROM public.enterprise_hr_workflow_tasks AS task
  WHERE task.id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.enterprise_hr_workflow_instances AS instance
  WHERE instance.id = v_instance_id
    AND instance.workspace_id = v_workspace_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HR workflow task instance must belong to the same workspace'
      USING ERRCODE = '23514';
  END IF;

  IF NOT public.has_enterprise_role(
    v_workspace_id,
    auth.uid(),
    ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
  ) THEN
    PERFORM 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.id = v_assignee_membership_id
      AND membership.workspace_id = v_workspace_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'::public.enterprise_membership_status
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_current_status = p_status THEN
    RETURN;
  END IF;

  UPDATE public.enterprise_hr_workflow_tasks
  SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'done' THEN pg_catalog.now() ELSE NULL END,
    completed_by = CASE WHEN p_status = 'done' THEN auth.uid() ELSE NULL END
  WHERE id = p_task_id;

  UPDATE public.enterprise_hr_workflow_instances
  SET status = 'in_progress'
  WHERE id = v_instance_id
    AND workspace_id = v_workspace_id
    AND status = 'open';
END;
$function$;

CREATE OR REPLACE FUNCTION public.hr_workflow_close_instance(
  p_instance_id uuid,
  p_status text DEFAULT 'completed'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_workspace_id uuid;
  v_current_status text;
BEGIN
  IF p_status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status: use completed or cancelled'
      USING ERRCODE = '22023';
  END IF;

  SELECT instance.workspace_id, instance.status
  INTO v_workspace_id, v_current_status
  FROM public.enterprise_hr_workflow_instances AS instance
  WHERE instance.id = p_instance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instance not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.has_enterprise_role(
    v_workspace_id,
    auth.uid(),
    ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_current_status = p_status THEN
    RETURN;
  END IF;

  UPDATE public.enterprise_hr_workflow_instances
  SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN pg_catalog.now() ELSE NULL END
  WHERE id = p_instance_id
    AND workspace_id = v_workspace_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hr_workflow_list_instances(
  p_workspace_id uuid,
  p_status text DEFAULT NULL,
  p_category text DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  template_id uuid,
  membership_id uuid,
  title text,
  category text,
  status text,
  priority text,
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  member_name text,
  total_tasks bigint,
  done_tasks bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT public.has_enterprise_role(
    p_workspace_id,
    auth.uid(),
    ARRAY['owner'::public.enterprise_role, 'resourceAssistant'::public.enterprise_role]
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    instance.id,
    instance.template_id,
    instance.membership_id,
    instance.title,
    instance.category,
    instance.status,
    instance.priority,
    instance.due_date,
    instance.started_at,
    instance.completed_at,
    instance.notes,
    COALESCE(profile.display_name, account.email::text, 'Ismeretlen') AS member_name,
    count(task.id) AS total_tasks,
    count(task.id) FILTER (WHERE task.status = 'done') AS done_tasks
  FROM public.enterprise_hr_workflow_instances AS instance
  LEFT JOIN public.enterprise_memberships AS membership
    ON membership.id = instance.membership_id
   AND membership.workspace_id = instance.workspace_id
  LEFT JOIN auth.users AS account
    ON account.id = membership.user_id
  LEFT JOIN public.profiles AS profile
    ON profile.user_id = membership.user_id
  LEFT JOIN public.enterprise_hr_workflow_tasks AS task
    ON task.instance_id = instance.id
   AND task.workspace_id = instance.workspace_id
  WHERE instance.workspace_id = p_workspace_id
    AND (p_status IS NULL OR instance.status = p_status)
    AND (p_category IS NULL OR instance.category = p_category)
  GROUP BY
    instance.id,
    instance.template_id,
    instance.membership_id,
    instance.title,
    instance.category,
    instance.status,
    instance.priority,
    instance.due_date,
    instance.started_at,
    instance.completed_at,
    instance.notes,
    profile.display_name,
    account.email
  ORDER BY instance.due_date ASC NULLS LAST, instance.started_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.hr_workflow_create_instance(
  uuid, uuid, uuid, text, text, date, text, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.hr_workflow_create_instance(
  uuid, uuid, uuid, text, text, date, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.hr_workflow_update_task(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.hr_workflow_update_task(uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.hr_workflow_close_instance(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.hr_workflow_close_instance(uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.hr_workflow_list_instances(uuid, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.hr_workflow_list_instances(uuid, text, text)
  TO authenticated;
