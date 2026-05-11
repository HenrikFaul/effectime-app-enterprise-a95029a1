import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Activity, EyeOff, AlertTriangle } from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

interface PulseRow {
  workspace_id: string;
  active_count: number;
  missing_org_unit: number;
  missing_manager: number;
  missing_contract: number;
  missing_leadership: number;
  employer_rights_count: number;
}

const K_FLOOR = 5;

function privacy(value: number, anchor: number): { value: number | null; suppressed: boolean } {
  if (anchor < K_FLOOR) return { value: null, suppressed: true };
  if (value > 0 && value < K_FLOOR) return { value: null, suppressed: true };
  return { value, suppressed: false };
}

export function OrgPulseButton({ workspaceId }: Props) {
  const t = useT();
  const [row, setRow] = useState<PulseRow | null>(null);
  const [openApprovalsOver48h, setOpenApprovalsOver48h] = useState(0);
  const [weeklyLeaveCount, setWeeklyLeaveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: pulse } = await (supabase as any)
      .from('enterprise_org_pulse_membership')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    setRow((pulse as PulseRow) || null);

    const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { count: oldApprovals } = await (supabase as any)
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .lte('created_at', cutoff);
    setOpenApprovalsOver48h(oldApprovals ?? 0);

    const sevenDays = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { count: recentLeave } = await (supabase as any)
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'approved')
      .gte('updated_at', sevenDays);
    setWeeklyLeaveCount(recentLeave ?? 0);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5 * 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const items = useMemo(() => {
    if (!row) return [];
    const denom = row.active_count;
    const cells = [
      { key: 'active_members', label: t('pulse.active_members'), raw: row.active_count, anchor: row.active_count },
      { key: 'employer_rights', label: t('pulse.employer_rights'), raw: row.employer_rights_count, anchor: denom },
      { key: 'missing_org_unit', label: t('pulse.missing_org_unit'), raw: row.missing_org_unit, anchor: denom, alert: true },
      { key: 'missing_manager', label: t('pulse.missing_manager'), raw: row.missing_manager, anchor: denom, alert: true },
      { key: 'missing_contract', label: t('pulse.missing_contract'), raw: row.missing_contract, anchor: denom, alert: true },
      { key: 'missing_leadership', label: t('pulse.missing_leadership'), raw: row.missing_leadership, anchor: denom, alert: true },
      { key: 'open_approvals_long', label: t('pulse.open_approvals_long'), raw: openApprovalsOver48h, anchor: denom, alert: true },
      { key: 'weekly_leave', label: t('pulse.weekly_leave'), raw: weeklyLeaveCount, anchor: denom },
    ];
    return cells.map((c) => ({ ...c, ...privacy(c.raw, c.anchor) }));
  }, [row, openApprovalsOver48h, weeklyLeaveCount, t]);

  const alertCount = useMemo(
    () => items.filter((i) => i.alert && !i.suppressed && (i.value ?? 0) > 0).length,
    [items],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative gap-1.5"
          aria-label={t('ws_nav.org_pulse')}
        >
          <Activity className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">{t('ws_nav.org_pulse')}</span>
          {alertCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center"
            >
              {alertCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">{t('pulse.title')}</div>
            {alertCount > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px] gap-1">
                <AlertTriangle className="h-3 w-3" /> {alertCount}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{t('pulse.subtitle')}</div>
        </div>
        <div className="p-3">
          {loading && !row ? (
            <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {items.map((i) => {
                const isAlert = i.alert && !i.suppressed && (i.value ?? 0) > 0;
                return (
                  <div
                    key={i.key}
                    className={`rounded-md border bg-card px-2.5 py-2 ${isAlert ? 'border-destructive/40 bg-destructive/5' : ''}`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                      {i.label}
                    </div>
                    {i.suppressed ? (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground italic">
                        <EyeOff className="h-3 w-3" /> {t('pulse.suppressed')}
                      </div>
                    ) : (
                      <div className={`text-base font-semibold leading-none mt-0.5 ${isAlert ? 'text-destructive' : ''}`}>
                        {i.value}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <Badge variant="outline" className="text-[10px] font-normal">k ≥ {K_FLOOR}</Badge>
            <button
              onClick={load}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t('ws_nav.refresh')}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
