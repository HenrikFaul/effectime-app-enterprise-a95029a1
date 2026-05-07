import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useHelpRegistry } from '@/lib/help/registry';
import { useI18n } from '@/i18n/I18nProvider';
import { ArrowLeft, CircleHelp, Search, Sparkles, X } from 'lucide-react';
import { useHelpArticleByAnchor, useHelpSearch } from '@/lib/help/useHelpArticles';

interface AnchorCopy {
  title: string;
  summary: string;
  commonTasks?: string[];
}

function resolveAnchorCopy(
  t: (k: string) => string,
  id: string | null,
): AnchorCopy | null {
  if (!id) return null;
  const titleKey = `help.anchors.${id}.title`;
  const summaryKey = `help.anchors.${id}.summary`;
  const title = t(titleKey);
  const summary = t(summaryKey);
  if (title === titleKey || summary === summaryKey) return null;
  const commonTasks: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const k = `help.anchors.${id}.commonTasks.${i}`;
    const v = t(k);
    if (v && v !== k) commonTasks.push(v);
  }
  return { title, summary, commonTasks };
}

export function HelpDrawer() {
  const {
    current,
    selectedAnchorId,
    setSelectedAnchorId,
    drawerOpen,
    setDrawerOpen,
    highlight,
    setHighlight,
  } = useHelpRegistry();
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');

  // History stack for back-navigation
  const history = useRef<string[]>([]);

  const activeAnchorId = selectedAnchorId ?? current?.id ?? null;

  // Track history when the active anchor changes
  const prevAnchorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = prevAnchorRef.current;
    if (activeAnchorId && activeAnchorId !== prev) {
      if (prev) history.current.push(prev);
      prevAnchorRef.current = activeAnchorId;
    }
  }, [activeAnchorId, drawerOpen]);

  const canGoBack = history.current.length > 0;

  const goBack = useCallback(() => {
    const prev = history.current.pop();
    if (prev) {
      prevAnchorRef.current = prev;
      setSelectedAnchorId(prev);
    }
  }, [setSelectedAnchorId]);

  const { article, loading } = useHelpArticleByAnchor(activeAnchorId, locale);
  const { results, loading: searching } = useHelpSearch(query, locale);
  const fallbackCopy = useMemo(() => resolveAnchorCopy(t, activeAnchorId), [t, activeAnchorId]);

  // Soft highlight on the active region when drawer opens
  useEffect(() => {
    if (!activeAnchorId || !drawerOpen || !highlight) return;
    const els = Array.from(
      document.querySelectorAll(`[data-help-region="${activeAnchorId}"]`),
    );
    els.forEach((el) => el.classList.add('help-highlight-ring'));
    const t1 = window.setTimeout(() => {
      els.forEach((el) => el.classList.remove('help-highlight-ring'));
      setHighlight(false);
    }, 1400);
    return () => {
      window.clearTimeout(t1);
      els.forEach((el) => el.classList.remove('help-highlight-ring'));
    };
  }, [activeAnchorId, drawerOpen, highlight, setHighlight]);

  // Reset on close
  useEffect(() => {
    if (!drawerOpen) {
      setQuery('');
      history.current = [];
      prevAnchorRef.current = null;
    }
  }, [drawerOpen]);

  return (
    <Sheet
      open={drawerOpen}
      onOpenChange={(o) => {
        setDrawerOpen(o);
        if (!o) setSelectedAnchorId(null);
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto bg-background/95 backdrop-blur-xl border-l border-primary/20"
      >
        <SheetHeader>
          <div className="flex items-center gap-2">
            {canGoBack && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={goBack}
                aria-label={t('common.back')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <CircleHelp className="h-4 w-4 text-primary" />
            </div>
            <SheetTitle className="text-lg">{t('help.drawer_title')}</SheetTitle>
          </div>
          <SheetDescription>{t('help.drawer_subtitle')}</SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search')}
            className="pl-9 pr-9 bg-muted/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search results */}
        {query.trim().length >= 2 && (
          <div className="mt-3 rounded-lg border bg-card/50 max-h-72 overflow-y-auto">
            {searching && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t('common.loading')}
              </div>
            )}
            {!searching && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t('common.empty')}
              </div>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  if (r.anchor_id) setSelectedAnchorId(r.anchor_id);
                  setQuery('');
                }}
                className="w-full text-left px-3 py-2 hover:bg-accent/50 border-b last:border-b-0"
              >
                <div className="text-sm font-medium">{r.title}</div>
                {r.summary && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {r.summary}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Crumbs */}
        {current?.crumbs && current.crumbs.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1">
            {current.crumbs.map((c, i) => (
              <Badge
                key={`${c}-${i}`}
                variant={i === current.crumbs!.length - 1 ? 'default' : 'secondary'}
                className="text-[11px] font-normal"
              >
                {c}
              </Badge>
            ))}
          </div>
        )}

        {/* Article body */}
        <div className="mt-5 space-y-4">
          {loading && (
            <div className="text-xs text-muted-foreground">{t('common.loading')}</div>
          )}

          {!loading && article && (
            <article>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('help.section_label')}
              </div>
              <h3 className="mt-1 text-base font-semibold">{article.title}</h3>
              {article.summary && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {article.summary}
                </p>
              )}
              <Separator className="my-3" />
              <div className="prose prose-sm prose-invert max-w-none [&_h2]:text-sm [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_ul]:my-2 [&_p]:text-sm [&_p]:leading-relaxed">
                <ReactMarkdown>{article.body_md}</ReactMarkdown>
              </div>
              {article.source_release_tag && (
                <div className="mt-4 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  <span>
                    {t('help.section_label')} · {article.source_release_tag}
                  </span>
                </div>
              )}
            </article>
          )}

          {!loading && !article && fallbackCopy && (
            <article>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('help.section_label')}
              </div>
              <h3 className="mt-1 text-base font-semibold">{fallbackCopy.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {fallbackCopy.summary}
              </p>
              {fallbackCopy.commonTasks && fallbackCopy.commonTasks.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t('help.common_tasks')}
                  </div>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                    {fallbackCopy.commonTasks.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          )}

          {!loading && !article && !fallbackCopy && (
            <div>
              <h3 className="text-base font-semibold">{t('help.no_anchor_title')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('help.no_anchor_summary')}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
