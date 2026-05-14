import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { useLatestWellbeingScores, useOpenWellbeingAlerts, recalculateWellbeingScores } from '@/hooks/useWellbeing';

interface Props {
  workspaceId: string;
}

/**
 * WellbeingRecalculateCard — Top-20 Rank 8, v3.23.0.
 *
 * Manager-facing card that fires `wellbeing_calculate_scores` for the
 * workspace and displays the latest score distribution + open alerts.
 * Slots into the existing WellbeingDashboard or any analytics page.
 */
export function WellbeingRecalculateCard({ workspaceId }: Props) {
  const { t } = useI18n();
  const { data: scores, refetch: refetchScores } = useLatestWellbeingScores(workspaceId);
  const { data: alerts, refetch: refetchAlerts } = useOpenWellbeingAlerts(workspaceId);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{ count: number; alerts: number } | null>(null);

  const redCount = (scores ?? []).filter((s) => s.score < 40).length;
  const yellowCount = (scores ?? []).filter((s) => s.score >= 40 && s.score < 70).length;
  const greenCount = (scores ?? []).filter((s) => s.score >= 70).length;
  const total = (scores ?? []).length;
  const avg = total > 0 ? Math.round((scores ?? []).reduce((a, s) => a + s.score, 0) / total) : 0;

  const handleRecalculate = async () => {
    setRunning(true);
    try {
      const res = await recalculateWellbeingScores(workspaceId);
      setLastRun({ count: res.count, alerts: res.alerts_fired });
      toast.success(t('wellbeing.recalculate_success', { count: res.count, alerts: res.alerts_fired }));
      await Promise.all([refetchScores(), refetchAlerts()]);
    } catch (e: unknown) {
      toast.error(t('wellbeing.recalculate_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            {t('wellbeing.engine_title')}
          </span>
          <Button size="sm" variant="outline" onClick={handleRecalculate} disabled={running}>
            {running ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> {t('wellbeing.recalculating')}</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> {t('wellbeing.recalculate_btn')}</>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border p-2 text-center">
            <div className="text-2xl font-bold tabular-nums">{avg}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('wellbeing.avg_score')}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/30 p-2 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{greenCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('wellbeing.bucket_green')}
            </div>
          </div>
          <div className="rounded-lg border border-amber-300 bg-amber-50/40 dark:bg-amber-950/30 p-2 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{yellowCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('wellbeing.bucket_yellow')}
            </div>
          </div>
          <div className="rounded-lg border border-red-300 bg-red-50/40 dark:bg-red-950/30 p-2 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{redCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('wellbeing.bucket_red')}
            </div>
          </div>
        </div>

        {lastRun && (
          <p className="text-xs text-muted-foreground">
            {t('wellbeing.last_run', { count: lastRun.count, alerts: lastRun.alerts })}
          </p>
        )}

        {(alerts ?? []).length > 0 && (
          <div className="pt-1 border-t space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              {t('wellbeing.open_alerts')}
            </p>
            {(alerts ?? []).slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono">{a.membership_id.slice(0, 8)}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    a.severity === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300' :
                    a.severity === 'medium' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-amber-400' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {t(`wellbeing.alert_${a.alert_type}` as 'wellbeing.alert_low_wellbeing_score')}
                </Badge>
              </div>
            ))}
            {alerts && alerts.length > 5 && (
              <p className="text-[10px] text-muted-foreground">+{alerts.length - 5} {t('common.more')}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
