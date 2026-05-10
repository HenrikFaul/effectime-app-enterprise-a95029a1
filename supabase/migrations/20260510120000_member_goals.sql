-- v3.4.0 — enterprise_member_goals: per-member achievement / goal log
-- Backs the new "Bővebb adatok" → "Meghatározott célok" section in the
-- MemberProfileSheet. Goals are typically agreed during one-to-one meetings
-- between the member and their manager and tracked through their lifecycle.

CREATE TABLE IF NOT EXISTS public.enterprise_member_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.enterprise_workspaces(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES public.enterprise_memberships(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'open',
  target_date   date,
  achieved_at   timestamptz,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_member_goals_status_check
    CHECK (status IN ('open', 'in_progress', 'achieved', 'dropped'))
);

CREATE INDEX IF NOT EXISTS idx_member_goals_workspace
  ON public.enterprise_member_goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_member_goals_member
  ON public.enterprise_member_goals(member_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_member_goals_updated') THEN
    CREATE TRIGGER trg_member_goals_updated
      BEFORE UPDATE ON public.enterprise_member_goals
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.enterprise_member_goals ENABLE ROW LEVEL SECURITY;

-- Workspace members can read goals.
CREATE POLICY "Members view member goals"
  ON public.enterprise_member_goals
  FOR SELECT TO authenticated
  USING (is_enterprise_member(workspace_id, auth.uid()));

-- Owners + resourceAssistants can write goals.
CREATE POLICY "Admins insert member goals"
  ON public.enterprise_member_goals
  FOR INSERT TO authenticated
  WITH CHECK (has_enterprise_role(
    workspace_id,
    auth.uid(),
    ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
  ));

CREATE POLICY "Admins update member goals"
  ON public.enterprise_member_goals
  FOR UPDATE TO authenticated
  USING (has_enterprise_role(
    workspace_id,
    auth.uid(),
    ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
  ))
  WITH CHECK (has_enterprise_role(
    workspace_id,
    auth.uid(),
    ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
  ));

CREATE POLICY "Admins delete member goals"
  ON public.enterprise_member_goals
  FOR DELETE TO authenticated
  USING (has_enterprise_role(
    workspace_id,
    auth.uid(),
    ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]
  ));
