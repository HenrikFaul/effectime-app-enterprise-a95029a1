import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, CalendarHeart, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import {
  useLaborCostForecast,
  useAbsenceRiskScores,
  useCoverageRiskHeatmap,
} from '@/hooks/usePredictiveAnalytics';

interface Props {
  workspaceId: string;
}

/**
 * PredictiveAnalyticsPanel — Top-20 Rank 3, v3.29.0.
 *
 * Three sections:
 *   - Labor cost forecast (6 months of projected EUR cost as compact bar chart)
 *   - Absence risk table (top 10 highest-risk members, sortable by score)
 *   - Coverage risk heatmap (90 days, color-coded green/yellow/red)
 */
export function PredictiveAnalyticsPanel({ workspaceId }: Props) {
  const { t } = useI18n();
  const { data: forecast, isLoading: loadingForecast } = useLaborCostForecast(workspaceId, 6);
  const { data: absence, isLoading: loadingAbsence } = useAbsenceRiskScores(workspaceId);
  const { data: coverage, isLoading: loadingCoverage } = useCoverageRiskHeatmap(workspaceId, 90);

  const forecastMax = Math.max(1, ...(forecast?.forecast ?? []).map((m) => m.projected_cost_eur));
  const topAbsence = (absence?.results ?? []).slice(0, 10);

  // Group coverage days by ISO week for visual grid (rows = weeks, cols = days of week)
  const heatmapWeeks: Array<Array<typeof coverage.days[number] | null>> = [];
  if (coverage?.days) {
    let currentWeek: Array<typeof coverage.days[number] | null> = [];
    const first = coverage.days[0];
    const offset = (first?.dow ?? 1) - 1; // Mon=0
    for (let i = 0; i < offset; i++) currentWeek.push(null);
    for (const d of coverage.days) {
      currentWeek.push(d);
      if (d.dow === 7) {
        heatmapWeeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) heatmapWeeks.push(currentWeek);
  }

  const cellClass = (color: 'green' | 'yellow' | 'red') =>
    color === 'red'
      ? 'bg-red-200 dark:bg-red-900/40 border-red-300'
      : color === 'yellow'
      ? 'bg-amber-200 dark:bg-amber-900/40 border-amber-300'
      : 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300';

  return (
    <div className="space-y-4">
      {/* Labor cost forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t('analytics.labor_cost_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingForecast ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="space-y-1.5">
              {(forecast?.forecast ?? []).map((m) => {
                const pct = Math.round((m.projected_cost_eur / forecastMax) * 100);
                return (
                  <div key={m.month_start} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-muted-foreground tabular-nums">{m.month_start}</span>
                    <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-24 text-right tabular-nums font-medium">
                      €{m.projected_cost_eur.toLocaleString()}
                    </span>
                  </div>
                );
              })}
              <p className="text-[10px] text-muted-foreground pt-1">{t('analytics.labor_cost_hint')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Absence risk */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t('analytics.absence_risk_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAbsence ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : topAbsence.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('analytics.absence_risk_empty')}</p>
          ) : (
            <div className="space-y-1">
              {topAbsence.map((r) => {
                const badgeClass =
                  r.risk_score >= 70
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300'
                    : r.risk_score >= 40
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-amber-400'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300';
                return (
                  <div key={r.membership_id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate flex-1">{r.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {t('analytics.absence_risk_180d', { count: r.recent_approved_180d })}
                    </span>
                    <Badge variant="outline" className={`text-[10px] font-mono ${badgeClass}`}>
                      {r.risk_score}/100
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarHeart className="h-4 w-4 text-primary" />
            {t('analytics.coverage_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCoverage ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground">
                {t('analytics.coverage_legend', { total: coverage?.total_members ?? 0 })}
              </p>
              <div className="space-y-1">
                {heatmapWeeks.slice(0, 13).map((week, wi) => (
                  <div key={wi} className="flex gap-1">
                    {week.map((d, di) => (
                      <div
                        key={di}
                        className={`h-5 w-5 rounded border ${
                          d ? cellClass(d.color) : 'bg-transparent border-transparent'
                        }`}
                        title={
                          d
                            ? `${d.date}: ${d.on_leave}/${d.total} (${d.pct_out}%)`
                            : ''
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-900/40 border border-emerald-300" />
                  {t('analytics.coverage_green')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-900/40 border border-amber-300" />
                  {t('analytics.coverage_yellow')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-red-200 dark:bg-red-900/40 border border-red-300" />
                  {t('analytics.coverage_red')}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
