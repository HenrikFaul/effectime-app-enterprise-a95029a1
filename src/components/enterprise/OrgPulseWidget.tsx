import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, EyeOff } from 'lucide-react';
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
  // Suppress small-N denominators or numerators below the floor.
  if (anchor < K_FLOOR) return { value: null, suppressed: true };
  if (value > 0 && value < K_FLOOR) return { value: null, suppressed: true };
  return { value, suppressed: false };
}

export function OrgPulseWidget({ workspaceId }: Props) {
  const t = useT();
  const [row, setRow] = useState<PulseRow | null>(null);
  const [openApprovalsOver48h, setOpenApprovalsOver48h] = useState<number>(0);
  const [weeklyLeaveCount, setWeeklyLeaveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // 1. View aggregate
    const { data: pulse } = await (supabase as any)
      .from('enterprise_org_pulse_membership')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    setRow((pulse as PulseRow) || null);

    // 2. Approvals open > 48h
    const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { count: oldApprovals } = await (supabase as any)
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .lte('created_at', cutoff);
    setOpenApprovalsOver48h(oldApprovals ?? 0);

    // 3. Approved leave in last 7 days
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
      { key: 'missing_org_unit', label: t('pulse.missing_org_unit'), raw: row.missing_org_unit, anchor: denom },
      { key: 'missing_manager', label: t('pulse.missing_manager'), raw: row.missing_manager, anchor: denom },
      { key: 'missing_contract', label: t('pulse.missing_contract'), raw: row.missing_contract, anchor: denom },
      { key: 'missing_leadership', label: t('pulse.missing_leadership'), raw: row.missing_leadership, anchor: denom },
      { key: 'open_approvals_long', label: t('pulse.open_approvals_long'), raw: openApprovalsOver48h, anchor: denom },
      { key: 'weekly_leave', label: t('pulse.weekly_leave'), raw: weeklyLeaveCount, anchor: denom },
    ];
    return cells.map((c) => ({ ...c, ...privacy(c.raw, c.anchor) }));
  }, [row, openApprovalsOver48h, weeklyLeaveCount, t]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">{t('pulse.title')}</CardTitle>
            <CardDescription className="text-xs">{t('pulse.subtitle')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !row ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {items.map((i) => (
              <div key={i.key} className="rounded-md border bg-card px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{i.label}</div>
                {i.suppressed ? (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground italic">
                    <EyeOff className="h-3 w-3" /> {t('pulse.suppressed')}
                  </div>
                ) : (
                  <div className="text-base font-semibold leading-none mt-0.5">{i.value}</div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-2">
          <Badge variant="outline" className="text-[10px] font-normal">k ≥ {K_FLOOR}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
