import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/i18n/I18nProvider';
import {
  ONBOARDING_ITEMS,
  useOnboardingProgress,
  type OnboardingItem,
} from '@/hooks/useCustomerSuccess';

interface Props {
  workspaceId: string;
  /** Called when a checklist row is clicked; parent decides what tab to switch to. */
  onJumpToItem?: (key: OnboardingItem) => void;
  /** Persist user's "I hid the widget" preference key. */
  storageKey?: string;
}

/**
 * Floating in-app onboarding checklist (Top-20 Rank 17, v3.19.0).
 *
 * Renders a collapsible widget showing the 7 onboarding items + per-item
 * completion timestamp. Click a row → parent navigates to the matching
 * setup area. When all items are checked, the widget auto-celebrates and
 * persists a dismissal flag in localStorage so it doesn't reappear.
 */
export function OnboardingChecklist({ workspaceId, onJumpToItem, storageKey }: Props) {
  const { t } = useI18n();
  const { data: progress, isLoading } = useOnboardingProgress(workspaceId);
  const sk = storageKey ?? `cs:onboarding:hidden:${workspaceId}`;
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(sk) === '1'; } catch { return false; }
  });

  const completed = useMemo(() => new Set((progress ?? []).map((p) => p.item_key)), [progress]);
  const completionPct = Math.round((completed.size / ONBOARDING_ITEMS.length) * 100);
  const allDone = completed.size === ONBOARDING_ITEMS.length;

  if (isLoading || dismissed || allDone) {
    // If everything is checked, hide entirely (and persist) so it doesn't
    // become permanent UI clutter.
    if (allDone && !dismissed) {
      try { localStorage.setItem(sk, '1'); } catch { /* ignore quota */ }
    }
    return null;
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t('customer_success.checklist_title')}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={t(collapsed ? 'common.expand' : 'common.collapse')}
            >
              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => { setDismissed(true); try { localStorage.setItem(sk, '1'); } catch { /* ignore */ } }}
              aria-label={t('common.dismiss')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Progress value={completionPct} className="h-2" />
          <p className="text-[11px] text-muted-foreground">
            {t('customer_success.checklist_progress', { done: completed.size, total: ONBOARDING_ITEMS.length, pct: completionPct })}
          </p>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-1 pt-1">
          {ONBOARDING_ITEMS.map((item) => {
            const isDone = completed.has(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => !isDone && onJumpToItem?.(item)}
                disabled={isDone}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  isDone
                    ? 'text-muted-foreground line-through cursor-default'
                    : 'hover:bg-primary/10 cursor-pointer'
                }`}
              >
                <span className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${
                  isDone ? 'bg-emerald-500 text-white' : 'border border-muted-foreground/40'
                }`}>
                  {isDone && <Check className="h-2.5 w-2.5" />}
                </span>
                <span className="flex-1">{t(`customer_success.checklist_item_${item}` as 'customer_success.checklist_item_team_invited')}</span>
              </button>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
