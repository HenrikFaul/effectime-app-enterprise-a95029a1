-- Keep only the most recent anonymous share token per event
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY event_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.event_share_tokens
  WHERE allow_anonymous = true
)
DELETE FROM public.event_share_tokens est
USING ranked r
WHERE est.id = r.id
  AND r.rn > 1;

-- Enforce exactly one anonymous share token per event
CREATE UNIQUE INDEX IF NOT EXISTS event_share_tokens_one_anonymous_per_event_idx
ON public.event_share_tokens (event_id)
WHERE allow_anonymous = true;