-- enterprise_seed_config: stores per-owner demo workspace seed quantities
-- Used by seed-demo-workspace edge function and the DemoSeedConfigDialog UI.

CREATE TABLE IF NOT EXISTS public.enterprise_seed_config (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config     jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_seed_config_owner_unique UNIQUE (owner_id)
);

ALTER TABLE public.enterprise_seed_config ENABLE ROW LEVEL SECURITY;

-- Only the owning user can read/write their own config.
CREATE POLICY "seed_config_select_own" ON public.enterprise_seed_config
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "seed_config_insert_own" ON public.enterprise_seed_config
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "seed_config_update_own" ON public.enterprise_seed_config
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "seed_config_delete_own" ON public.enterprise_seed_config
  FOR DELETE USING (auth.uid() = owner_id);

-- Auto-bump updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seed_config_updated_at'
  ) THEN
    CREATE TRIGGER trg_seed_config_updated_at
      BEFORE UPDATE ON public.enterprise_seed_config
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
