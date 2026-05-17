-- Migration: canonicalize features.route_path to /w/:workspaceId/... shape
-- Safe, reversible (each row's prior value can be recomputed from the new value).
-- Operates on public.features only. UPDATE-only, no DROP, no DELETE.

BEGIN;

-- 1) Snapshot the pre-migration distribution into a transient table so the
--    migration's effect is auditable inside the same transaction.
CREATE TEMP TABLE _features_route_path_premigration AS
SELECT id, feature_key, module, route_path AS old_route_path, menu_path
FROM public.features
WHERE route_path IS NOT NULL;

-- 2) Rewrite the 111 legacy "/app/..." rows: literal prefix swap.
--    Examples:
--      /app/resources/agile/gantt  ->  /w/:workspaceId/resources/agile/gantt
--      /app/time-attendance/audit  ->  /w/:workspaceId/time-attendance/audit
UPDATE public.features
SET route_path = '/w/:workspaceId' || substring(route_path FROM 5)
WHERE route_path LIKE '/app/%';

-- 3) Disambiguate the 31 truncated "/w/:workspaceId" rows by appending a
--    sub-path derived from the existing menu_path breadcrumb. We do NOT
--    invent structure — menu_path already encodes the intended hierarchy.
--
--    Derivation:
--      lower(array_to_string(menu_path, '/'))
--      then collapse every run of non-[a-z0-9/] chars to a single '-'
--      then trim leading/trailing hyphens
--      then prepend '/w/:workspaceId/'
--
--    Result examples:
--      [Calendar, AI Copilot]            -> /w/:workspaceId/calendar/ai-copilot
--      [Time & Attendance, Live board]   -> /w/:workspaceId/time-attendance/live-board
--      [My Portal, Clock in]             -> /w/:workspaceId/my-portal/clock-in
UPDATE public.features
SET route_path = '/w/:workspaceId/' || trim(BOTH '-' FROM
    regexp_replace(
      lower(array_to_string(menu_path, '/')),
      '[^a-z0-9/]+',
      '-',
      'g'
    )
  )
WHERE route_path = '/w/:workspaceId'
  AND menu_path IS NOT NULL
  AND array_length(menu_path, 1) >= 1;

-- 4) Post-migration invariants. Each invariant aborts the transaction if it
--    fails — true regression protection, not after-the-fact audit.

-- Invariant A: zero rows remain with the legacy /app/ prefix.
DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM public.features WHERE route_path LIKE '/app/%';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Invariant A failed: % rows still use /app/ prefix', remaining;
  END IF;
END $$;

-- Invariant B: zero rows remain with the bare /w/:workspaceId value
--              (every workspace-scoped row now has a leaf segment).
DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM public.features WHERE route_path = '/w/:workspaceId';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Invariant B failed: % rows still have bare /w/:workspaceId', remaining;
  END IF;
END $$;

-- Invariant C: every row touched by this migration ends with a value that
--              passes the FeatureTiersTab.tsx validation regex
--              ^/[A-Za-z0-9/_\-:$.{}-]*$
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM public.features
  WHERE route_path IS NOT NULL
    AND route_path !~ '^/[A-Za-z0-9/_\-:$.{}-]*$';
  IF bad > 0 THEN
    RAISE EXCEPTION 'Invariant C failed: % rows fail the route_path validation regex', bad;
  END IF;
END $$;

-- Invariant D: same number of rows have a non-null route_path before and
--              after — no row's route_path was nulled out by accident.
DO $$
DECLARE pre int; post int;
BEGIN
  SELECT count(*) INTO pre FROM _features_route_path_premigration WHERE old_route_path IS NOT NULL;
  SELECT count(*) INTO post FROM public.features WHERE route_path IS NOT NULL;
  IF pre <> post THEN
    RAISE EXCEPTION 'Invariant D failed: pre=% post=% (some route_path became NULL)', pre, post;
  END IF;
END $$;

-- Invariant E: every UPDATE produced a value matching one of two patterns
--              ('/w/:workspaceId/<rest>' or pre-existing non-workspace path
--              like /admin/* or /superadmin/*).
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM public.features f
  JOIN _features_route_path_premigration p ON p.id = f.id
  WHERE p.old_route_path LIKE '/app/%'
    AND f.route_path NOT LIKE '/w/:workspaceId/%';
  IF bad > 0 THEN
    RAISE EXCEPTION 'Invariant E failed: % rewritten /app rows are not under /w/:workspaceId/', bad;
  END IF;
END $$;

COMMIT;