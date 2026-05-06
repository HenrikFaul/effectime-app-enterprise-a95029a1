
-- enterprise_member_rates: restrict SELECT to admins
DROP POLICY IF EXISTS "Members view member rates" ON public.enterprise_member_rates;
CREATE POLICY "Admins view member rates" ON public.enterprise_member_rates
  FOR SELECT USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- enterprise_invitations: restrict SELECT to admins or the invited email
DROP POLICY IF EXISTS "Members can view workspace invitations" ON public.enterprise_invitations;
CREATE POLICY "Admins or invitee can view invitations" ON public.enterprise_invitations
  FOR SELECT USING (
    has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role])
    OR email = (auth.jwt() ->> 'email'::text)
  );

-- enterprise_report_schedules: restrict SELECT to admins
DROP POLICY IF EXISTS "Members can view schedules" ON public.enterprise_report_schedules;
CREATE POLICY "Admins can view schedules" ON public.enterprise_report_schedules
  FOR SELECT USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));

-- enterprise_agile_issues: restrict SELECT to admins (contains external emails)
DROP POLICY IF EXISTS "agile_issues_select" ON public.enterprise_agile_issues;
CREATE POLICY "agile_issues_select" ON public.enterprise_agile_issues
  FOR SELECT USING (has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]));
