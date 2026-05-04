
-- Function to atomically create workspace + owner membership
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  _name text,
  _description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id uuid;
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.enterprise_workspaces (name, description, created_by)
  VALUES (_name, _description, _user_id)
  RETURNING id INTO _workspace_id;

  INSERT INTO public.enterprise_memberships (workspace_id, user_id, role, status, joined_at)
  VALUES (_workspace_id, _user_id, 'owner', 'active', now());

  RETURN _workspace_id;
END;
$$;

-- Also fix: allow workspace creator to view their memberships even as first member
-- The SELECT policy uses is_enterprise_member which checks for active membership,
-- so once inserted via the function above, it should work.
-- But we need the workspace list to also show workspaces where user is created_by
-- Let's add a policy for the creator to always be able to read their membership
CREATE POLICY "Creators can view own memberships"
ON public.enterprise_memberships
FOR SELECT
USING (user_id = auth.uid());
