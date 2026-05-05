import { useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useHelpRegistry } from '@/lib/help/registry';
import { useI18n } from '@/i18n/I18nProvider';
import { CircleHelp } from 'lucide-react';

interface AnchorCopy {
  title: string;
  summary: string;
  commonTasks?: string[];
  keyboardShortcuts?: { combo: string; description: string }[];
}

function resolveAnchorCopy(t: (k: string) => string, locale: string, id: string | null): AnchorCopy | null {
  if (!id) return null;
  // Look up via simple object access by walking the dotted key.
  // The bundles store anchors at `help.anchors.<id>` as objects.
  // We can't deep-read with t() directly, so we read title/summary keys individually.
  const titleKey = `help.anchors.${id}.title`;
  const summaryKey = `help.anchors.${id}.summary`;
  const title = t(titleKey);
  const summary = t(summaryKey);
  if (title === titleKey || summary === summaryKey) return null;
  // Common tasks: 0..N entries, support up to 6 by convention
  const commonTasks: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const k = `help.anchors.${id}.commonTasks.${i}`;
    const v = t(k);
    if (v && v !== k) commonTasks.push(v);
  }
  void locale;
  return { title, summary, commonTasks };
}

export function HelpDrawer() {
  const { current, drawerOpen, setDrawerOpen, highlight, setHighlight } = useHelpRegistry();
  const { t, locale } = useI18n();

  // Apply / remove highlight ring on the data-help-region matching current anchor
  useEffect(() => {
    if (!current?.id) return;
    if (!drawerOpen || !highlight) return;
    const els = Array.from(document.querySelectorAll(`[data-help-region="${current.id}"]`));
    els.forEach((el) => el.classList.add('help-highlight-ring'));
    const t1 = window.setTimeout(() => {
      els.forEach((el) => el.classList.remove('help-highlight-ring'));
      setHighlight(false);
    }, 1400);
    return () => {
      window.clearTimeout(t1);
      els.forEach((el) => el.classList.remove('help-highlight-ring'));
    };
  }, [current?.id, drawerOpen, highlight, setHighlight]);

  const copy = resolveAnchorCopy(t, locale, current?.id ?? null);

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-primary" />
            <SheetTitle>{t('help.drawer_title')}</SheetTitle>
          </div>
          <SheetDescription>{t('help.drawer_subtitle')}</SheetDescription>
        </SheetHeader>

        {current?.crumbs && current.crumbs.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1">
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
        ) : null}

        <div className="mt-4 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t('help.section_label')}
            </div>
            <h3 className="mt-1 text-base font-semibold">
              {copy?.title ?? t('help.no_anchor_title')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {copy?.summary ?? t('help.no_anchor_summary')}
            </p>
          </div>

          {copy?.commonTasks && copy.commonTasks.length > 0 ? (
            <>
              <Separator />
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('help.common_tasks')}
                </div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                  {copy.commonTasks.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
