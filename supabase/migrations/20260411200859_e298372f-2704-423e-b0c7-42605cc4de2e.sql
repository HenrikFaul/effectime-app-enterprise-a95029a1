DROP POLICY IF EXISTS "Members can view workspace invitations" ON public.enterprise_invitations;

CREATE POLICY "Members can view workspace invitations"
ON public.enterprise_invitations
FOR SELECT
TO authenticated
USING (
  is_enterprise_member(workspace_id, auth.uid())
  OR email = (auth.jwt() ->> 'email')
);