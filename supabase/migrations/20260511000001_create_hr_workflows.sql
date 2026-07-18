-- HR Workflow Automation — templates, instances, tasks
-- v3.7.0 — Groups 2 (HR Workflow Automation) + 4 (Employee Self-Service)

-- ─── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enterprise_hr_workflow_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES enterprise_workspaces(id) ON DELETE CASCADE,
  name           text NOT NULL,
  category       text NOT NULL DEFAULT 'custom',
  -- category ∈ 'medical_exam'|'salary_advance'|'contract_amendment'|'probation_review'|'fixed_term_expiry'|'offboarding'|'custom'
  description    text,
  steps          jsonb NOT NULL DEFAULT '[]',
  -- steps = [{id, title, description, due_offset_days, assignee_role, is_required}]
  is_active      boolean NOT NULL DEFAULT true,
  recurrence_months integer,   -- NULL = one-off, 12 = annual, 6 = biannual
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enterprise_hr_workflow_instances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES enterprise_workspaces(id) ON DELETE CASCADE,
  template_id    uuid REFERENCES enterprise_hr_workflow_templates(id) ON DELETE SET NULL,
  membership_id  uuid REFERENCES enterprise_memberships(id) ON DELETE CASCADE,
  title          text NOT NULL,
  category       text NOT NULL DEFAULT 'custom',
  status         text NOT NULL DEFAULT 'open',
  -- status ∈ 'open'|'in_progress'|'completed'|'cancelled'
  priority       text NOT NULL DEFAULT 'normal',
  -- priority ∈ 'low'|'normal'|'high'|'urgent'
  due_date       date,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  created_by     uuid,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enterprise_hr_workflow_tasks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES enterprise_workspaces(id) ON DELETE CASCADE,
  instance_id             uuid NOT NULL REFERENCES enterprise_hr_workflow_instances(id) ON DELETE CASCADE,
  title                   text NOT NULL,
  description             text,
  assignee_membership_id  uuid REFERENCES enterprise_memberships(id) ON DELETE SET NULL,
  due_date                date,
  status                  text NOT NULL DEFAULT 'pending',
  -- status ∈ 'pending'|'in_progress'|'done'|'skipped'
  completed_at            timestamptz,
  completed_by            uuid,
  sort_order              integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hr_workflow_templates_ws
  ON enterprise_hr_workflow_templates (workspace_id);

CREATE INDEX IF NOT EXISTS idx_hr_workflow_instances_ws
  ON enterprise_hr_workflow_instances (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_hr_workflow_instances_member
  ON enterprise_hr_workflow_instances (membership_id);

CREATE INDEX IF NOT EXISTS idx_hr_workflow_tasks_instance
  ON enterprise_hr_workflow_tasks (instance_id);

CREATE INDEX IF NOT EXISTS idx_hr_workflow_tasks_assignee
  ON enterprise_hr_workflow_tasks (assignee_membership_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE enterprise_hr_workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_hr_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_hr_workflow_tasks     ENABLE ROW LEVEL SECURITY;

-- Templates: admins read/write; members read active
CREATE POLICY hr_wf_templates_admin_all ON enterprise_hr_workflow_templates
  FOR ALL
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY hr_wf_templates_member_read ON enterprise_hr_workflow_templates
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM enterprise_memberships em
      WHERE em.workspace_id = enterprise_hr_workflow_templates.workspace_id
        AND em.user_id = auth.uid()
        AND em.status = 'active'
    )
  );

-- Instances: admins all; members see their own
CREATE POLICY hr_wf_instances_admin_all ON enterprise_hr_workflow_instances
  FOR ALL
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY hr_wf_instances_member_read ON enterprise_hr_workflow_instances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enterprise_memberships em
      WHERE em.id = enterprise_hr_workflow_instances.membership_id
        AND em.user_id = auth.uid()
        AND em.status = 'active'
    )
  );

-- Tasks: admins all; assignees read + update own
CREATE POLICY hr_wf_tasks_admin_all ON enterprise_hr_workflow_tasks
  FOR ALL
  USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));

CREATE POLICY hr_wf_tasks_assignee_read ON enterprise_hr_workflow_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enterprise_memberships em
      WHERE em.id = enterprise_hr_workflow_tasks.assignee_membership_id
        AND em.user_id = auth.uid()
        AND em.status = 'active'
    )
  );

-- ─── updated_at triggers ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_hr_workflow_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hr_wf_templates_updated_at
  BEFORE UPDATE ON enterprise_hr_workflow_templates
  FOR EACH ROW EXECUTE FUNCTION set_hr_workflow_updated_at();

CREATE TRIGGER trg_hr_wf_instances_updated_at
  BEFORE UPDATE ON enterprise_hr_workflow_instances
  FOR EACH ROW EXECUTE FUNCTION set_hr_workflow_updated_at();

CREATE TRIGGER trg_hr_wf_tasks_updated_at
  BEFORE UPDATE ON enterprise_hr_workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION set_hr_workflow_updated_at();

-- ─── RPCs ──────────────────────────────────────────────────────────────────

-- Create a workflow instance from a template (or ad-hoc), creating task rows
CREATE OR REPLACE FUNCTION hr_workflow_create_instance(
  p_workspace_id  uuid,
  p_template_id   uuid DEFAULT NULL,
  p_membership_id uuid DEFAULT NULL,
  p_title         text DEFAULT NULL,
  p_category      text DEFAULT 'custom',
  p_due_date      date DEFAULT NULL,
  p_priority      text DEFAULT 'normal',
  p_notes         text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance_id uuid;
  v_title       text;
  v_category    text;
  v_steps       jsonb;
  v_step        jsonb;
  v_sort        integer := 0;
  v_due_date    date;
BEGIN
  -- Authorization
  IF NOT has_enterprise_role(p_workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Resolve from template if given
  IF p_template_id IS NOT NULL THEN
    SELECT name, category, steps
    INTO v_title, v_category, v_steps
    FROM enterprise_hr_workflow_templates
    WHERE id = p_template_id AND workspace_id = p_workspace_id;

    IF v_title IS NULL THEN
      RAISE EXCEPTION 'Template not found';
    END IF;
  ELSE
    v_title    := COALESCE(p_title, 'Névtelen folyamat');
    v_category := p_category;
    v_steps    := '[]'::jsonb;
  END IF;

  -- Override with explicit values when provided
  IF p_title IS NOT NULL THEN v_title := p_title; END IF;
  IF p_category IS NOT NULL AND p_category <> 'custom' THEN v_category := p_category; END IF;

  -- Insert instance
  INSERT INTO enterprise_hr_workflow_instances (
    workspace_id, template_id, membership_id,
    title, category, status, priority,
    due_date, notes, created_by
  ) VALUES (
    p_workspace_id, p_template_id, p_membership_id,
    v_title, v_category, 'open', p_priority,
    p_due_date, p_notes, auth.uid()
  ) RETURNING id INTO v_instance_id;

  -- Create tasks from template steps
  FOR v_step IN SELECT * FROM jsonb_array_elements(v_steps) LOOP
    v_due_date := CASE
      WHEN p_due_date IS NOT NULL AND (v_step->>'due_offset_days') IS NOT NULL
      THEN p_due_date + (v_step->>'due_offset_days')::integer
      ELSE NULL
    END;

    INSERT INTO enterprise_hr_workflow_tasks (
      workspace_id, instance_id, title, description,
      due_date, sort_order
    ) VALUES (
      p_workspace_id, v_instance_id,
      COALESCE(v_step->>'title', 'Feladat'),
      v_step->>'description',
      v_due_date,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  RETURN v_instance_id;
END;
$$;

-- Update task status
CREATE OR REPLACE FUNCTION hr_workflow_update_task(
  p_task_id uuid,
  p_status  text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_instance_id  uuid;
BEGIN
  SELECT workspace_id, instance_id
  INTO v_workspace_id, v_instance_id
  FROM enterprise_hr_workflow_tasks
  WHERE id = p_task_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- Allow admin OR the task's assignee
  IF NOT has_enterprise_role(v_workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]) THEN
    IF NOT EXISTS (
      SELECT 1 FROM enterprise_hr_workflow_tasks t
      JOIN enterprise_memberships em ON em.id = t.assignee_membership_id
      WHERE t.id = p_task_id AND em.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  UPDATE enterprise_hr_workflow_tasks
  SET
    status       = p_status,
    completed_at = CASE WHEN p_status = 'done' THEN now() ELSE NULL END,
    completed_by = CASE WHEN p_status = 'done' THEN auth.uid() ELSE NULL END
  WHERE id = p_task_id;

  -- Auto-advance instance to in_progress when first task is touched
  UPDATE enterprise_hr_workflow_instances
  SET status = 'in_progress'
  WHERE id = v_instance_id AND status = 'open';
END;
$$;

-- Close (complete or cancel) a workflow instance
CREATE OR REPLACE FUNCTION hr_workflow_close_instance(
  p_instance_id uuid,
  p_status      text DEFAULT 'completed'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM enterprise_hr_workflow_instances
  WHERE id = p_instance_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Instance not found';
  END IF;

  IF NOT has_enterprise_role(v_workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status: use completed or cancelled';
  END IF;

  UPDATE enterprise_hr_workflow_instances
  SET
    status       = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE NULL END
  WHERE id = p_instance_id;
END;
$$;

-- List workspace instances with member display names (admin view)
CREATE OR REPLACE FUNCTION hr_workflow_list_instances(
  p_workspace_id uuid,
  p_status       text DEFAULT NULL,
  p_category     text DEFAULT NULL
) RETURNS TABLE (
  id             uuid,
  template_id    uuid,
  membership_id  uuid,
  title          text,
  category       text,
  status         text,
  priority       text,
  due_date       date,
  started_at     timestamptz,
  completed_at   timestamptz,
  notes          text,
  member_name    text,
  total_tasks    bigint,
  done_tasks     bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.template_id,
    i.membership_id,
    i.title,
    i.category,
    i.status,
    i.priority,
    i.due_date,
    i.started_at,
    i.completed_at,
    i.notes,
    COALESCE(pr.display_name, u.email::text, 'Ismeretlen') AS member_name,
    COUNT(t.id)                                             AS total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'done')           AS done_tasks
  FROM enterprise_hr_workflow_instances i
  LEFT JOIN enterprise_memberships em ON em.id = i.membership_id
  LEFT JOIN auth.users u              ON u.id  = em.user_id
  LEFT JOIN profiles pr               ON pr.user_id = em.user_id
  LEFT JOIN enterprise_hr_workflow_tasks t ON t.instance_id = i.id
  WHERE i.workspace_id = p_workspace_id
    AND has_enterprise_role(p_workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role])
    AND (p_status   IS NULL OR i.status   = p_status)
    AND (p_category IS NULL OR i.category = p_category)
  GROUP BY i.id, pr.display_name, u.email
  ORDER BY i.due_date ASC NULLS LAST, i.started_at DESC;
$$;
