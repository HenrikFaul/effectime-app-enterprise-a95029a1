-- v3.0.0 Phase 5 + 6 — Onboarding, External Access, Strategic Capabilities
-- Additive migration; no destructive operations. Safe to run repeatedly.

-- =========================================================================
-- 1. Onboarding domain
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_onboarding_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  scope_org_unit_id     uuid REFERENCES public.enterprise_org_units(id) ON DELETE SET NULL,
  scope_position_id     uuid REFERENCES public.enterprise_workspace_roles(id) ON DELETE SET NULL,
  version         integer NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'draft',
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_onboarding_templates_status_check
    CHECK (status IN ('draft','published','archived'))
);

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_workspace
  ON public.enterprise_onboarding_templates(workspace_id);

CREATE TABLE IF NOT EXISTS public.enterprise_onboarding_template_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       uuid NOT NULL REFERENCES public.enterprise_onboarding_templates(id) ON DELETE CASCADE,
  sort_order        integer NOT NULL DEFAULT 0,
  title             text NOT NULL,
  description       text,
  step_type         text NOT NULL DEFAULT 'task',
  owner_role        text,
  due_offset_days   integer NOT NULL DEFAULT 0,
  mandatory         boolean NOT NULL DEFAULT true,
  escalate_after_days integer,
  content_ref       text,
  access_system_id  uuid,                        -- forward-declared, FK added below
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_onboarding_template_steps_step_type_check
    CHECK (step_type IN ('task','read','acknowledge','training','exam','approval','internal_permission','external_access'))
);

CREATE INDEX IF NOT EXISTS idx_onboarding_template_steps_template
  ON public.enterprise_onboarding_template_steps(template_id);

CREATE TABLE IF NOT EXISTS public.enterprise_onboarding_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES public.enterprise_onboarding_templates(id) ON DELETE SET NULL,
  template_version integer,
  status          text NOT NULL DEFAULT 'in_progress',
  started_at      timestamptz NOT NULL DEFAULT now(),
  due_at          timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_onboarding_instances_status_check
    CHECK (status IN ('in_progress','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_onboarding_instances_workspace
  ON public.enterprise_onboarding_instances(workspace_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_instances_member
  ON public.enterprise_onboarding_instances(member_id);

CREATE TABLE IF NOT EXISTS public.enterprise_onboarding_step_completions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES public.enterprise_onboarding_instances(id) ON DELETE CASCADE,
  step_id       uuid NOT NULL REFERENCES public.enterprise_onboarding_template_steps(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending',
  completed_by  uuid,
  completed_at  timestamptz,
  evidence_ref  text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_onboarding_step_completions_status_check
    CHECK (status IN ('pending','in_progress','completed','blocked','skipped')),
  UNIQUE(instance_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_step_completions_instance
  ON public.enterprise_onboarding_step_completions(instance_id);

-- =========================================================================
-- 2. External Access Request matrix
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_access_systems (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  kind                  text NOT NULL DEFAULT 'external',
  default_owner_role    text,
  default_approver_role text,
  description           text,
  archived_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_access_systems_kind_check
    CHECK (kind IN ('internal','external')),
  UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_access_systems_workspace
  ON public.enterprise_access_systems(workspace_id);

-- Add the FK from onboarding step → access_system after the table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_onboarding_template_steps_access_system_fk'
  ) THEN
    ALTER TABLE public.enterprise_onboarding_template_steps
      ADD CONSTRAINT enterprise_onboarding_template_steps_access_system_fk
      FOREIGN KEY (access_system_id)
      REFERENCES public.enterprise_access_systems(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.enterprise_access_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name                text NOT NULL,
  scope_position_id   uuid REFERENCES public.enterprise_workspace_roles(id) ON DELETE SET NULL,
  scope_org_unit_id   uuid REFERENCES public.enterprise_org_units(id) ON DELETE SET NULL,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_templates_workspace
  ON public.enterprise_access_templates(workspace_id);

CREATE TABLE IF NOT EXISTS public.enterprise_access_template_systems (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES public.enterprise_access_templates(id) ON DELETE CASCADE,
  system_id     uuid NOT NULL REFERENCES public.enterprise_access_systems(id) ON DELETE CASCADE,
  mandatory     boolean NOT NULL DEFAULT true,
  optional      boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, system_id)
);

CREATE TABLE IF NOT EXISTS public.enterprise_access_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  system_id       uuid NOT NULL REFERENCES public.enterprise_access_systems(id) ON DELETE RESTRICT,
  template_id     uuid REFERENCES public.enterprise_access_templates(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending',
  reason          text,
  requested_by    uuid,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  decided_by      uuid,
  decided_at      timestamptz,
  owner_id        uuid,
  approver_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_access_requests_status_check
    CHECK (status IN ('pending','approved','provisioning','granted','rejected','revoked','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_access_requests_workspace
  ON public.enterprise_access_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_member
  ON public.enterprise_access_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status
  ON public.enterprise_access_requests(workspace_id, status);

CREATE TABLE IF NOT EXISTS public.enterprise_access_decisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES public.enterprise_access_requests(id) ON DELETE CASCADE,
  action        text NOT NULL,
  actor_id      uuid,
  rationale     text,
  expected_outcome text,
  observed_outcome text,
  at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_access_decisions_action_check
    CHECK (action IN ('submit','approve','reject','revoke','cancel','comment'))
);

CREATE INDEX IF NOT EXISTS idx_access_decisions_request
  ON public.enterprise_access_decisions(request_id);

-- =========================================================================
-- 3. Strategic capabilities — capacity snapshots, recovery mode, decision memory
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_capacity_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  snapshot_date   date NOT NULL,
  baseline_fte    numeric(10,2),
  effective_fte   numeric(10,2),
  committed_fte   numeric(10,2),
  available_fte   numeric(10,2),
  shortage_score  numeric(6,3),
  overload_score  numeric(6,3),
  payload         jsonb,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_workspace_date
  ON public.enterprise_capacity_snapshots(workspace_id, snapshot_date DESC);

ALTER TABLE public.enterprise_workspaces
  ADD COLUMN IF NOT EXISTS recovery_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_mode_reason text,
  ADD COLUMN IF NOT EXISTS recovery_mode_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_mode_activated_by uuid;

-- Decision Memory — annotation for any decision (leave approval, access, scenario, etc.)
CREATE TABLE IF NOT EXISTS public.enterprise_decision_memory (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  subject_type      text NOT NULL,
  subject_id        uuid NOT NULL,
  rationale         text,
  expected_outcome  text,
  observed_outcome  text,
  authored_by       uuid,
  authored_at       timestamptz NOT NULL DEFAULT now(),
  observed_at       timestamptz,
  UNIQUE(workspace_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_memory_workspace_subject
  ON public.enterprise_decision_memory(workspace_id, subject_type, subject_id);

-- =========================================================================
-- 4. updated_at triggers
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_onboarding_templates_updated') THEN
    CREATE TRIGGER trg_onboarding_templates_updated BEFORE UPDATE ON public.enterprise_onboarding_templates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_onboarding_template_steps_updated') THEN
    CREATE TRIGGER trg_onboarding_template_steps_updated BEFORE UPDATE ON public.enterprise_onboarding_template_steps
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_onboarding_instances_updated') THEN
    CREATE TRIGGER trg_onboarding_instances_updated BEFORE UPDATE ON public.enterprise_onboarding_instances
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_onboarding_step_completions_updated') THEN
    CREATE TRIGGER trg_onboarding_step_completions_updated BEFORE UPDATE ON public.enterprise_onboarding_step_completions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_access_systems_updated') THEN
    CREATE TRIGGER trg_access_systems_updated BEFORE UPDATE ON public.enterprise_access_systems
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_access_templates_updated') THEN
    CREATE TRIGGER trg_access_templates_updated BEFORE UPDATE ON public.enterprise_access_templates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_access_requests_updated') THEN
    CREATE TRIGGER trg_access_requests_updated BEFORE UPDATE ON public.enterprise_access_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- =========================================================================
-- 5. RLS
-- =========================================================================

ALTER TABLE public.enterprise_onboarding_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_onboarding_template_steps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_onboarding_instances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_onboarding_step_completions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_access_systems                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_access_templates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_access_template_systems        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_access_requests                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_access_decisions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_capacity_snapshots             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_decision_memory                ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- onboarding_templates
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view onboarding templates' AND tablename = 'enterprise_onboarding_templates') THEN
    CREATE POLICY "Members view onboarding templates" ON public.enterprise_onboarding_templates
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage onboarding templates' AND tablename = 'enterprise_onboarding_templates') THEN
    CREATE POLICY "Admins manage onboarding templates" ON public.enterprise_onboarding_templates
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- onboarding_template_steps (gated through template's workspace)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view onboarding template steps' AND tablename = 'enterprise_onboarding_template_steps') THEN
    CREATE POLICY "Members view onboarding template steps" ON public.enterprise_onboarding_template_steps
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.enterprise_onboarding_templates t
                WHERE t.id = template_id AND is_enterprise_member(t.workspace_id, auth.uid()))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage onboarding template steps' AND tablename = 'enterprise_onboarding_template_steps') THEN
    CREATE POLICY "Admins manage onboarding template steps" ON public.enterprise_onboarding_template_steps
      FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.enterprise_onboarding_templates t
                WHERE t.id = template_id AND has_enterprise_role(t.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.enterprise_onboarding_templates t
                WHERE t.id = template_id AND has_enterprise_role(t.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      );
  END IF;

  -- onboarding_instances
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view onboarding instances' AND tablename = 'enterprise_onboarding_instances') THEN
    CREATE POLICY "Members view onboarding instances" ON public.enterprise_onboarding_instances
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage onboarding instances' AND tablename = 'enterprise_onboarding_instances') THEN
    CREATE POLICY "Admins manage onboarding instances" ON public.enterprise_onboarding_instances
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- step_completions (gated through instance)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view onboarding step completions' AND tablename = 'enterprise_onboarding_step_completions') THEN
    CREATE POLICY "Members view onboarding step completions" ON public.enterprise_onboarding_step_completions
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.enterprise_onboarding_instances i
                WHERE i.id = instance_id AND is_enterprise_member(i.workspace_id, auth.uid()))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage onboarding step completions' AND tablename = 'enterprise_onboarding_step_completions') THEN
    CREATE POLICY "Admins manage onboarding step completions" ON public.enterprise_onboarding_step_completions
      FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.enterprise_onboarding_instances i
                WHERE i.id = instance_id AND has_enterprise_role(i.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.enterprise_onboarding_instances i
                WHERE i.id = instance_id AND has_enterprise_role(i.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      );
  END IF;

  -- access_systems
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view access systems' AND tablename = 'enterprise_access_systems') THEN
    CREATE POLICY "Members view access systems" ON public.enterprise_access_systems
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage access systems' AND tablename = 'enterprise_access_systems') THEN
    CREATE POLICY "Admins manage access systems" ON public.enterprise_access_systems
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- access_templates
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view access templates' AND tablename = 'enterprise_access_templates') THEN
    CREATE POLICY "Members view access templates" ON public.enterprise_access_templates
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage access templates' AND tablename = 'enterprise_access_templates') THEN
    CREATE POLICY "Admins manage access templates" ON public.enterprise_access_templates
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- access_template_systems (gated through template)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view access template systems' AND tablename = 'enterprise_access_template_systems') THEN
    CREATE POLICY "Members view access template systems" ON public.enterprise_access_template_systems
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.enterprise_access_templates t
                WHERE t.id = template_id AND is_enterprise_member(t.workspace_id, auth.uid()))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage access template systems' AND tablename = 'enterprise_access_template_systems') THEN
    CREATE POLICY "Admins manage access template systems" ON public.enterprise_access_template_systems
      FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.enterprise_access_templates t
                WHERE t.id = template_id AND has_enterprise_role(t.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.enterprise_access_templates t
                WHERE t.id = template_id AND has_enterprise_role(t.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      );
  END IF;

  -- access_requests
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view access requests' AND tablename = 'enterprise_access_requests') THEN
    CREATE POLICY "Members view access requests" ON public.enterprise_access_requests
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members create access requests' AND tablename = 'enterprise_access_requests') THEN
    CREATE POLICY "Members create access requests" ON public.enterprise_access_requests
      FOR INSERT TO authenticated WITH CHECK (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage access requests' AND tablename = 'enterprise_access_requests') THEN
    CREATE POLICY "Admins manage access requests" ON public.enterprise_access_requests
      FOR UPDATE TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- access_decisions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view access decisions' AND tablename = 'enterprise_access_decisions') THEN
    CREATE POLICY "Members view access decisions" ON public.enterprise_access_decisions
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.enterprise_access_requests r
                WHERE r.id = request_id AND is_enterprise_member(r.workspace_id, auth.uid()))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins write access decisions' AND tablename = 'enterprise_access_decisions') THEN
    CREATE POLICY "Admins write access decisions" ON public.enterprise_access_decisions
      FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.enterprise_access_requests r
                WHERE r.id = request_id AND has_enterprise_role(r.workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      );
  END IF;

  -- capacity_snapshots
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view capacity snapshots' AND tablename = 'enterprise_capacity_snapshots') THEN
    CREATE POLICY "Members view capacity snapshots" ON public.enterprise_capacity_snapshots
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage capacity snapshots' AND tablename = 'enterprise_capacity_snapshots') THEN
    CREATE POLICY "Admins manage capacity snapshots" ON public.enterprise_capacity_snapshots
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;

  -- decision_memory
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members view decision memory' AND tablename = 'enterprise_decision_memory') THEN
    CREATE POLICY "Members view decision memory" ON public.enterprise_decision_memory
      FOR SELECT TO authenticated USING (is_enterprise_member(workspace_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage decision memory' AND tablename = 'enterprise_decision_memory') THEN
    CREATE POLICY "Admins manage decision memory" ON public.enterprise_decision_memory
      FOR ALL TO authenticated
      USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]))
      WITH CHECK (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role,'resourceAssistant'::enterprise_role]));
  END IF;
END$$;

-- =========================================================================
-- 6. Default access systems seeder (idempotent)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.seed_default_access_systems(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.enterprise_access_systems (workspace_id, name, kind)
  VALUES
    (p_workspace_id, 'Jira',         'external'),
    (p_workspace_id, 'Confluence',   'external'),
    (p_workspace_id, 'Outlook',      'external'),
    (p_workspace_id, 'Dynatrace',    'external'),
    (p_workspace_id, 'ERP',          'external'),
    (p_workspace_id, 'Billing',      'external'),
    (p_workspace_id, 'Entry Control','internal')
  ON CONFLICT (workspace_id, name) DO NOTHING;
END$$;
