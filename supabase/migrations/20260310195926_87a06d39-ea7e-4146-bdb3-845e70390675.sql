ALTER TABLE public.event_share_tokens 
ADD COLUMN IF NOT EXISTS email text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_uses integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.event_share_tokens ALTER COLUMN expires_at DROP DEFAULT;