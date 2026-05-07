import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HelpArticle {
  id: string;
  topic_key: string;
  locale: string;
  title: string;
  summary: string | null;
  body_md: string;
  route: string | null;
  anchor_id: string | null;
  taxonomy: string;
  tags: string[];
  synonyms: string[];
  related_topics: string[];
  source_release_tag: string | null;
  last_generated_at: string;
}

/**
 * Fetch the best article for a given anchorId.
 * Multiple topics can share one anchor_id (e.g. workspace.settings has several).
 * We pick the most-recently generated active article for the requested locale,
 * falling back to EN when no locale-specific article exists.
 *
 * Uses .limit(1) to guarantee .maybeSingle() never throws a multi-row error.
 */
export function useHelpArticleByAnchor(anchorId: string | null, locale: string) {
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!anchorId) {
      setArticle(null);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        // Active locale first — most recent active article for this anchor
        const { data: primary } = await (supabase as any)
          .from('help_articles')
          .select('*')
          .eq('anchor_id', anchorId)
          .eq('locale', locale)
          .eq('is_active', true)
          .order('last_generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (primary) {
          setArticle(primary as HelpArticle);
          return;
        }
        // Fallback to EN
        const { data: fallback } = await (supabase as any)
          .from('help_articles')
          .select('*')
          .eq('anchor_id', anchorId)
          .eq('locale', 'en')
          .eq('is_active', true)
          .order('last_generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setArticle((fallback as HelpArticle) ?? null);
      } catch {
        if (!cancelled) setArticle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [anchorId, locale]);

  return { article, loading };
}

/** Live autocomplete search across help_articles. */
export function useHelpSearch(query: string, locale: string) {
  const [results, setResults] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const pat = `%${trimmed}%`;
        const { data } = await (supabase as any)
          .from('help_articles')
          .select('*')
          .eq('is_active', true)
          .in('locale', [locale, 'en'])
          .or(`title.ilike.${pat},summary.ilike.${pat},body_md.ilike.${pat}`)
          .order('last_generated_at', { ascending: false })
          .limit(20);
        if (cancelled) return;
        // Dedupe by topic_key, prefer active locale
        const seen = new Map<string, HelpArticle>();
        ((data as HelpArticle[]) || []).forEach((row) => {
          const existing = seen.get(row.topic_key);
          if (!existing || row.locale === locale) seen.set(row.topic_key, row);
        });
        setResults(Array.from(seen.values()).slice(0, 10));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, locale]);

  return { results, loading };
}
