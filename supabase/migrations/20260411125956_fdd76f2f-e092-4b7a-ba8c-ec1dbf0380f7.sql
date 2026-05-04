
-- Approval chains
CREATE TABLE public.enterprise_approval_chains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  approver_role public.enterprise_role NOT NULL DEFAULT 'resourceAssistant',
  substitute_user_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, step_order)
);
ALTER TABLE public.enterprise_approval_chains ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_approval_chains_updated_at BEFORE UPDATE ON public.enterprise_approval_chains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view approval chains" ON public.enterprise_approval_chains FOR SELECT TO authenticated USING (public.is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins can manage approval chains" ON public.enterprise_approval_chains FOR INSERT TO authenticated WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));
CREATE POLICY "Admins can update approval chains" ON public.enterprise_approval_chains FOR UPDATE TO authenticated USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));
CREATE POLICY "Admins can delete approval chains" ON public.enterprise_approval_chains FOR DELETE TO authenticated USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

-- Escalation rules
CREATE TABLE public.enterprise_escalation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  escalate_after_hours INTEGER NOT NULL DEFAULT 48,
  escalate_to_role public.enterprise_role NOT NULL DEFAULT 'owner',
  notify_owner BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprise_escalation_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_escalation_rules_updated_at BEFORE UPDATE ON public.enterprise_escalation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view escalation rules" ON public.enterprise_escalation_rules FOR SELECT TO authenticated USING (public.is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Owners can manage escalation rules" ON public.enterprise_escalation_rules FOR INSERT TO authenticated WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));
CREATE POLICY "Owners can update escalation rules" ON public.enterprise_escalation_rules FOR UPDATE TO authenticated USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));
CREATE POLICY "Owners can delete escalation rules" ON public.enterprise_escalation_rules FOR DELETE TO authenticated USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]));

-- Audit events (immutable)
CREATE TABLE public.enterprise_audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  affected_user_id UUID,
  prev_state JSONB,
  new_state JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprise_audit_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_events_workspace ON public.enterprise_audit_events(workspace_id, created_at DESC);

CREATE POLICY "Admins can view audit events" ON public.enterprise_audit_events FOR SELECT TO authenticated USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "System can insert audit events" ON public.enterprise_audit_events FOR INSERT TO authenticated WITH CHECK (public.is_enterprise_member(workspace_id, auth.uid()));

-- Enterprise notifications
CREATE TABLE public.enterprise_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_type TEXT,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprise_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ent_notifications_user ON public.enterprise_notifications(user_id, is_read, created_at DESC);

CREATE POLICY "Users can view own notifications" ON public.enterprise_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Members can create notifications" ON public.enterprise_notifications FOR INSERT TO authenticated WITH CHECK (public.is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Users can update own notifications" ON public.enterprise_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.enterprise_notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Rule templates
CREATE TABLE public.enterprise_rule_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enterprise_rule_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_rule_templates_updated_at BEFORE UPDATE ON public.enterprise_rule_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view rule templates" ON public.enterprise_rule_templates FOR SELECT TO authenticated USING (public.is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins can manage rule templates" ON public.enterprise_rule_templates FOR INSERT TO authenticated WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins can update rule templates" ON public.enterprise_rule_templates FOR UPDATE TO authenticated USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins can delete rule templates" ON public.enterprise_rule_templates FOR DELETE TO authenticated USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- Export jobs
CREATE TABLE public.enterprise_export_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  export_format TEXT NOT NULL DEFAULT 'csv',
  filters JSONB DEFAULT '{}'::jsonb,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.enterprise_export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view export jobs" ON public.enterprise_export_jobs FOR SELECT TO authenticated USING (public.is_enterprise_member(workspace_id, auth.uid()));
CREATE POLICY "Admins can create export jobs" ON public.enterprise_export_jobs FOR INSERT TO authenticated WITH CHECK (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
CREATE POLICY "Admins can update export jobs" ON public.enterprise_export_jobs FOR UPDATE TO authenticated USING (public.has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
