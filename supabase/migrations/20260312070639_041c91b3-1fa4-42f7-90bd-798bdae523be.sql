
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temp_access_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS linked_event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.event_share_tokens 
  ADD COLUMN IF NOT EXISTS allow_anonymous boolean NOT NULL DEFAULT false;
