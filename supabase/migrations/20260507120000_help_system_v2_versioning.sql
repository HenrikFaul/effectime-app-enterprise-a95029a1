-- Help system v2: adds versioning columns (is_active, archived_at) to
-- help_articles so the regenerator can archive stale articles without
-- deleting them, and the drawer can query only active articles.
-- This migration is purely additive — no existing rows or policies changed.

ALTER TABLE public.help_articles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Index: fast filtering for active-only queries (drawer + search)
CREATE INDEX IF NOT EXISTS help_articles_active_idx
  ON public.help_articles (is_active, anchor_id, locale);

-- Update the search hook to keep updated_at in sync (already exists; no-op if unchanged)
-- The existing trigger already sets updated_at on every INSERT/UPDATE.

-- Backfill: mark all existing rows as active (they pre-date versioning)
UPDATE public.help_articles SET is_active = true WHERE is_active IS NULL OR is_active = false AND archived_at IS NULL;
