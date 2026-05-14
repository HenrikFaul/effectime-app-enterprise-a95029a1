import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { useComplianceViolations, useComplianceRuleset, runComplianceCheck } from '@/hooks/useCompliance';

interface Props {
  workspaceId: string;
}

/**
 * ComplianceDashboard — Top-20 Rank 13, shipped v3.20.0.
 *
 * Owner / resourceAssistant view: pick a period, run the EU WTD / DE ArbZG
 * / HU Mt. compliance check, see violations grouped by severity. Each run
 * inserts/updates rows in compliance_violations; the table below shows the
 * unresolved set.
 */
export function ComplianceDashboard({ workspaceId }: Props) {
  const { t } = useI18n();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [start, setStart] = useState(firstOfMonth);
  const [end, setEnd] = useState(lastOfMonth);
  const [running, setRunning] = useState(false);
  const [lastSummary, setLastSummary] = useState<{ violations: number; warnings: number } | null>(null);

  const { data: ruleset } = useComplianceRuleset(workspaceId);
  const { data: violations, isLoading, refetch } = useComplianceViolations(workspaceId);

  const violationCount = (violations ?? []).filter((v) => v.severity === 'violation').length;
  const warningCount = (violations ?? []).filter((v) => v.severity === 'warning').length;

  const status: 'green' | 'yellow' | 'red' =
    violationCount > 0 ? 'red' : warningCount > 0 ? 'yellow' : 'green';

  const StatusIcon = status === 'red' ? ShieldX : status === 'yellow' ? ShieldAlert : ShieldCheck;
  const statusColor =
    status === 'red'
      ? 'text-red-600 dark:text-red-400'
      : status === 'yellow'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runComplianceCheck(workspaceId, start, end);
      const newViolations = result.violations.filter((v) => v.severity === 'violation').length;
      const newWarnings = result.violations.filter((v) => v.severity === 'warning').length;
      setLastSummary({ violations: newViolations, warnings: newWarnings });
      toast.success(t('compliance.run_success', { violations: newViolations, warnings: newWarnings }));
      await refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('compliance.run_error') + ': ' + msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <StatusIcon className={`h-4 w-4 ${statusColor}`} />
              {t('compliance.title')}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {ruleset?.jurisdiction ?? 'EU_WTD'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{violationCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('compliance.kpi_violations')}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{warningCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('compliance.kpi_warnings')}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className={`text-2xl font-bold ${statusColor}`}>
                {status === 'green' ? '✓' : status === 'yellow' ? '!' : '×'}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t(`compliance.status_${status}` as 'compliance.status_green')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="comp-start" className="text-xs">{t('compliance.period_start')}</Label>
              <Input id="comp-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="comp-end" className="text-xs">{t('compliance.period_end')}</Label>
              <Input id="comp-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <Button onClick={handleRun} disabled={running || !start || !end}>
              {running ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('compliance.running')}</>
              ) : (
                t('compliance.run_check')
              )}
            </Button>
          </div>

          {lastSummary && (
            <p className="text-xs text-muted-foreground">
              {t('compliance.last_run_summary', { violations: lastSummary.violations, warnings: lastSummary.warnings })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t('compliance.violations_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
          ) : (violations ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('compliance.no_violations')}</p>
          ) : (
            <div className="space-y-1.5">
              {(violations ?? []).map((v) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded border ${
                    v.severity === 'violation'
                      ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
                      : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">
                      {(v.details as { member_name?: string })?.member_name ?? v.membership_id ?? '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t(`compliance.rule_${v.rule_key}` as 'compliance.rule_weekly_max_hours')} · {v.period_start} → {v.period_end}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono">
                      {v.actual_value !== null ? v.actual_value.toFixed(1) : '—'} / {v.limit_value !== null ? v.limit_value.toFixed(1) : '—'}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {t(`compliance.severity_${v.severity}` as 'compliance.severity_violation')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
