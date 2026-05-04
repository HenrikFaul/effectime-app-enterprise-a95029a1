-- Extend enterprise_daily_rules to support: multiple days of week, validity period, multiple business roles
ALTER TABLE public.enterprise_daily_rules
  ADD COLUMN IF NOT EXISTS days_of_week integer[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valid_from date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valid_until date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS role_filters text[] DEFAULT NULL;

-- Backfill: copy single day_of_week into days_of_week array, role_filter into role_filters
UPDATE public.enterprise_daily_rules
SET days_of_week = ARRAY[day_of_week]
WHERE days_of_week IS NULL AND day_of_week IS NOT NULL;

UPDATE public.enterprise_daily_rules
SET role_filters = ARRAY[role_filter]
WHERE role_filters IS NULL AND role_filter IS NOT NULL AND role_filter <> '';

-- Backfill team_filter into role_filters (since we are dropping free-text team filter usage)
UPDATE public.enterprise_daily_rules
SET role_filters = COALESCE(role_filters, ARRAY[]::text[]) || ARRAY[team_filter]
WHERE team_filter IS NOT NULL AND team_filter <> '' AND NOT (COALESCE(role_filters, ARRAY[]::text[]) @> ARRAY[team_filter]);