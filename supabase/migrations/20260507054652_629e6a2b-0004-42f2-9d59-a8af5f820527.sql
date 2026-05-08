
-- Help system schema
CREATE TABLE IF NOT EXISTS public.help_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_tag text NOT NULL,
  commit_sha text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed')),
  summary text,
  changed_files jsonb,
  error text,
  triggered_by text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS help_releases_version_idx ON public.help_releases(version_tag);

CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_key text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en','hu')),
  title text NOT NULL,
  summary text,
  body_md text NOT NULL,
  route text,
  anchor_id text,
  taxonomy text NOT NULL DEFAULT 'page',
  tags text[] NOT NULL DEFAULT '{}',
  synonyms text[] NOT NULL DEFAULT '{}',
  related_topics text[] NOT NULL DEFAULT '{}',
  release_id uuid REFERENCES public.help_releases(id) ON DELETE SET NULL,
  source_release_tag text,
  content_hash text,
  is_system_generated boolean NOT NULL DEFAULT true,
  search_tokens tsvector,
  last_generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_key, locale)
);
CREATE INDEX IF NOT EXISTS help_articles_anchor_idx ON public.help_articles(anchor_id, locale);
CREATE INDEX IF NOT EXISTS help_articles_route_idx ON public.help_articles(route, locale);
CREATE INDEX IF NOT EXISTS help_articles_tags_idx ON public.help_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS help_articles_search_idx ON public.help_articles USING GIN(search_tokens);

CREATE OR REPLACE FUNCTION public.help_articles_search_trigger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  NEW.search_tokens :=
    setweight(to_tsvector('simple', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.summary,'')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(NEW.tags,' ')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(NEW.synonyms,' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.body_md,'')), 'C');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS help_articles_search_trg ON public.help_articles;
CREATE TRIGGER help_articles_search_trg
  BEFORE INSERT OR UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.help_articles_search_trigger();

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "help_articles read all" ON public.help_articles;
CREATE POLICY "help_articles read all" ON public.help_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "help_releases read all" ON public.help_releases;
CREATE POLICY "help_releases read all" ON public.help_releases FOR SELECT USING (true);
-- writes restricted to service role only (no policy = denied)
