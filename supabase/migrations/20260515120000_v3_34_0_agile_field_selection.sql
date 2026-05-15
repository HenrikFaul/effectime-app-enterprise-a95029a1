-- Add selected_field_ids to persist which fields users want in the board
ALTER TABLE public.enterprise_workspace_integrations
  ADD COLUMN IF NOT EXISTS selected_field_ids text[] NOT NULL DEFAULT '{}';
