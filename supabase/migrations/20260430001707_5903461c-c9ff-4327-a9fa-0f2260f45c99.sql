ALTER TABLE public.enterprise_invitations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_enterprise_invitations_metadata
  ON public.enterprise_invitations USING GIN (metadata);