-- Help system workspace settings:
-- help_ai_enabled: toggle for the AI regenerator (default true = enabled)
-- help_last_regenerated_at: tracks when content was last regenerated for this workspace
-- Additive only — no existing columns or policies changed.

ALTER TABLE public.enterprise_workspaces
  ADD COLUMN IF NOT EXISTS help_ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS help_last_regenerated_at timestamptz;
