-- v3.46.3 — Fix create_embed_token: can_write was missing from INSERT
-- Both old overloads saved the _can_write param but never wrote it to the DB.
-- Drop both, recreate as a single correct function.

DROP FUNCTION IF EXISTS public.create_embed_token(uuid, text, text[], timestamptz);
DROP FUNCTION IF EXISTS public.create_embed_token(uuid, text, text[], timestamptz, boolean);

CREATE FUNCTION public.create_embed_token(
  _workspace_id  uuid,
  _label         text,
  _allowed_views text[]      DEFAULT '{capacity_planner}',
  _expires_at    timestamptz DEFAULT NULL,
  _can_write     boolean     DEFAULT false
)
RETURNS TABLE (id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_id    uuid;
BEGIN
  IF NOT has_enterprise_role(_workspace_id, auth.uid(), ARRAY['owner'::enterprise_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO enterprise_embed_tokens
    (workspace_id, created_by, label, token, allowed_views, expires_at, can_write)
  VALUES
    (_workspace_id, auth.uid(), _label, v_token, _allowed_views, _expires_at, _can_write)
  RETURNING enterprise_embed_tokens.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_embed_token(uuid, text, text[], timestamptz, boolean) TO authenticated;
