
ALTER TABLE public.enterprise_agile_issues
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS team_name text;
