-- Migration: fix broken feature dependencies in the seed catalog.
--
-- Two real issues caught by featureTiering.test.ts:
--
-- 1. Four features have their multi-deps stored as a single comma-joined
--    string instead of a proper text[]. e.g. site_assignment had
--    ARRAY['offices,attendance_log'] (one element, broken) instead of
--    ARRAY['offices','attendance_log']. This breaks tenant_enabled_features
--    dependency resolution and the FeatureTiersTab "missing prereq" badge.
--
-- 2. leave_conflict_check ↔ leave_daily_rules form a 2-cycle. The rules
--    table is the source-of-truth used by the conflict check; the rules
--    themselves do not require the conflict check to exist. Break the cycle
--    by removing leave_conflict_check from leave_daily_rules' deps.
--    (leave_conflict_check still depends on leave_daily_rules.)

-- Fix 1 — split comma-joined dependency strings
UPDATE public.features
   SET dependencies = ARRAY['offices','attendance_log']::text[]
 WHERE feature_key = 'site_assignment';

UPDATE public.features
   SET dependencies = ARRAY['calendar_monthly','leave_quotas']::text[]
 WHERE feature_key = 'ai_smart_schedule';

UPDATE public.features
   SET dependencies = ARRAY['attendance_log','leave_my_view']::text[]
 WHERE feature_key = 'ai_burnout_predict';

UPDATE public.features
   SET dependencies = ARRAY['leave_my_view','attendance_log']::text[]
 WHERE feature_key = 'burnout_engine';

-- Fix 2 — break the leave_conflict_check ↔ leave_daily_rules cycle.
-- leave_daily_rules existed before conflict-checking was introduced and is
-- the data source for the check, not the other way around.
UPDATE public.features
   SET dependencies = ARRAY[]::text[]
 WHERE feature_key = 'leave_daily_rules';
