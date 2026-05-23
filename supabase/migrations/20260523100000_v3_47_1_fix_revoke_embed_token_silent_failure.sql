-- v3.47.1 — Fix revoke_embed_token silent failure
-- Previously: non-owner callers got no error; UPDATE silently did nothing.
-- Now: raises P0001 if token not found or caller is not an owner.
-- Verification: SELECT revoke_embed_token(gen_random_uuid()); → raises exception.

CREATE OR REPLACE FUNCTION public.revoke_embed_token(_token_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  UPDATE enterprise_embed_tokens
  SET is_active = false
  WHERE id = _token_id
    AND EXISTS (
      SELECT 1 FROM enterprise_memberships em
      WHERE em.workspace_id = enterprise_embed_tokens.workspace_id
        AND em.user_id = auth.uid()
        AND em.role = 'owner'
        AND em.status = 'active'
    );

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Token not found or you are not authorised to revoke it';
  END IF;
END;
$$;
