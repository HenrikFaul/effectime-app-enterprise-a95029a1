import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { WellbeingRecalculateCard } from '@/components/wellbeing/WellbeingRecalculateCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Heart,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
} from 'lucide-react';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface MemberRaw {
  id: string;
  user_id: string;
  business_role: string | null;
  display_name: string;
}

interface AttendancePeriod {
  membership_id: string;
  year: number;
  month: number;
  totals: { overtime_hours?: number; regular_hours?: number } | null;
}

interface ShiftAssignment {
  membership_id: string;
  shift_date: string;
}

interface LeaveRequest {
  user_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface WellbeingComponents {
  overtime_score: number;
  leave_utilization_score: number;
  weekend_density_score: number;
  schedule_stability_score: number;
  recovery_score: number;
}

interface WellbeingScore {
  id?: string;
  membership_id: string;
  score: number;
  components: WellbeingComponents;
  display_name: string;
  business_role: string | null;
}

interface WellbeingAlert {
  id: string;
  membership_id: string;
  alert_type: 'burnout_risk' | 'high_overtime' | 'low_leave_usage' | 'weekend_overload';
  severity: 'low' | 'medium' | 'high';
  message: string;
  triggered_at: string;
  resolved_at: string | null;
  display_name?: string;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function calculateWellbeingScore(
  member: MemberRaw,
  periods: AttendancePeriod[],
  shifts: ShiftAssignment[],
  leaves: LeaveRequest[],
): { score: number; components: WellbeingComponents } {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10);

  // --- overtime_score (weight 0.30) ---
  const memberPeriods = periods.filter((p) => p.membership_id === member.id);
  let overtimeHours90d = 0;
  let regularHours90d = 0;
  for (const p of memberPeriods) {
    // Approximate: include periods whose month/year overlaps the last 90 days
    const periodDate = new Date(p.year, p.month - 1, 1);
    if (periodDate >= new Date(ninetyDaysAgo.getFullYear(), ninetyDaysAgo.getMonth(), 1)) {
      overtimeHours90d += p.totals?.overtime_hours ?? 0;
      regularHours90d += p.totals?.regular_hours ?? 0;
    }
  }
  const expectedHours = Math.max(1, regularHours90d || 480); // fallback ~3 months × 160h
  const overtimeRatio = overtimeHours90d / expectedHours;
  const overtimeScore = Math.max(0, 100 - Math.min(100, overtimeRatio * 300));

  // --- leave_utilization_score (weight 0.20) ---
  const memberLeaves = leaves.filter((l) => l.user_id === member.user_id && l.status === 'approved');
  let leaveDaysTaken = 0;
  for (const l of memberLeaves) {
    leaveDaysTaken += daysBetween(l.start_date, l.end_date);
  }
  const leaveDaysAccrued = Math.max(1, 25); // sensible default; quota table not joined here
  const leaveUtilizationScore = Math.min(100, (leaveDaysTaken / leaveDaysAccrued) * 100);

  // --- weekend_density_score (weight 0.25) ---
  const memberShifts = shifts.filter(
    (s) => s.membership_id === member.id && s.shift_date >= ninetyDaysAgoStr,
  );
  const weekendDaysWorked = memberShifts.filter((s) => isWeekend(s.shift_date)).length;
  const weekendDensityScore = Math.max(0, 100 - Math.min(100, weekendDaysWorked * 3));

  // --- placeholders ---
  const scheduleStabilityScore = 100;
  const recoveryScore = 100;

  const score = Math.max(
    0,
    Math.min(
      100,
      overtimeScore * 0.3 +
        leaveUtilizationScore * 0.2 +
        weekendDensityScore * 0.25 +
        scheduleStabilityScore * 0.15 +
        recoveryScore * 0.1,
    ),
  );

  return {
    score: Math.round(score),
    components: {
      overtime_score: Math.round(overtimeScore),
      leave_utilization_score: Math.round(leaveUtilizationScore),
      weekend_density_score: Math.round(weekendDensityScore),
      schedule_stability_score: scheduleStabilityScore,
      recovery_score: recoveryScore,
    },
  };
}

function scoreColorClasses(score: number): { card: string; badge: string } {
  if (score >= 70) return { card: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800' };
  if (score >= 40) return { card: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800' };
  return { card: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800' };
}

function severityVariant(severity: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (severity === 'high') return 'destructive';
  if (severity === 'medium') return 'secondary';
  return 'outline';
}

export function WellbeingDashboard({ workspaceId, isAdmin }: Props) {
  const { t } = useI18n();

  const [scores, setScores] = useState<WellbeingScore[]>([]);
  const [alerts, setAlerts] = useState<WellbeingAlert[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const loadScores = useCallback(async () => {
    setLoadingScores(true);
    const { data: members } = await supabase
      .from('enterprise_memberships')
      .select('id, user_id, business_role')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    if (!members || members.length === 0) {
      setScores([]);
      setLoadingScores(false);
      return;
    }

    const userIds = members.map((m: any) => m.user_id);
    const memberIds = members.map((m: any) => m.id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);

    const profileMap: Record<string, string> = {};
    for (const p of profiles || []) {
      profileMap[(p as any).user_id] = (p as any).display_name || (p as any).user_id.slice(0, 8);
    }

    const { data: wellbeingData } = await (supabase as any)
      .from('wellbeing_scores')
      .select('id, membership_id, score, components, calculated_at')
      .eq('workspace_id', workspaceId)
      .in('membership_id', memberIds);

    const scoreMap: Record<string, any> = {};
    for (const w of wellbeingData || []) {
      scoreMap[w.membership_id] = w;
    }

    const merged: WellbeingScore[] = members.map((m: any) => {
      const ws = scoreMap[m.id];
      return {
        id: ws?.id,
        membership_id: m.id,
        score: ws?.score ?? 0,
        components: ws?.components ?? {
          overtime_score: 0,
          leave_utilization_score: 0,
          weekend_density_score: 0,
          schedule_stability_score: 100,
          recovery_score: 100,
        },
        display_name: profileMap[m.user_id] || m.user_id.slice(0, 8),
        business_role: m.business_role,
      };
    });

    setScores(merged);
    setLoadingScores(false);
  }, [workspaceId]);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    const { data: rawAlerts } = await (supabase as any)
      .from('wellbeing_alerts')
      .select('id, membership_id, alert_type, severity, message, triggered_at, resolved_at')
      .eq('workspace_id', workspaceId)
      .is('resolved_at', null)
      .order('triggered_at', { ascending: false });

    if (!rawAlerts || rawAlerts.length === 0) {
      setAlerts([]);
      setLoadingAlerts(false);
      return;
    }

    const memberIds = Array.from(new Set(rawAlerts.map((a: any) => a.membership_id)));
    const { data: memberships } = await supabase
      .from('enterprise_memberships')
      .select('id, user_id')
      .in('id', memberIds as string[]);

    const memberUserIdMap: Record<string, string> = {};
    for (const m of memberships || []) {
      memberUserIdMap[(m as any).id] = (m as any).user_id;
    }

    const userIds = Object.values(memberUserIdMap);
    let nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);
      for (const p of profiles || []) {
        nameMap[(p as any).user_id] = (p as any).display_name || (p as any).user_id.slice(0, 8);
      }
    }

    const enriched: WellbeingAlert[] = rawAlerts.map((a: any) => ({
      ...a,
      display_name: nameMap[memberUserIdMap[a.membership_id]] || a.membership_id.slice(0, 8),
    }));

    setAlerts(enriched);
    setLoadingAlerts(false);
  }, [workspaceId]);

  useEffect(() => {
    loadScores();
    loadAlerts();
  }, [loadScores, loadAlerts]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const { data: members } = await supabase
        .from('enterprise_memberships')
        .select('id, user_id, business_role')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      if (!members || members.length === 0) {
        toast.info(t('wellbeing.no_members'));
        setRecalculating(false);
        return;
      }

      const memberIds = members.map((m: any) => m.id);
      const userIds = members.map((m: any) => m.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap: Record<string, string> = {};
      for (const p of profiles || []) {
        profileMap[(p as any).user_id] = (p as any).display_name || (p as any).user_id.slice(0, 8);
      }

      const { data: periods } = await (supabase as any)
        .from('enterprise_attendance_periods')
        .select('membership_id, year, month, totals')
        .eq('workspace_id', workspaceId)
        .in('membership_id', memberIds);

      const { data: shifts } = await (supabase as any)
        .from('enterprise_shift_assignments')
        .select('membership_id, shift_date')
        .eq('workspace_id', workspaceId)
        .in('membership_id', memberIds);

      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('user_id, start_date, end_date, status, leave_type')
        .eq('workspace_id', workspaceId)
        .in('user_id', userIds)
        .eq('status', 'approved');

      const now = new Date().toISOString();
      const upsertPayloads: any[] = [];
      const newAlerts: any[] = [];

      for (const m of members as any[]) {
        const member: MemberRaw = {
          id: m.id,
          user_id: m.user_id,
          business_role: m.business_role,
          display_name: profileMap[m.user_id] || m.user_id.slice(0, 8),
        };

        const { score, components } = calculateWellbeingScore(
          member,
          (periods || []) as AttendancePeriod[],
          (shifts || []) as ShiftAssignment[],
          (leaves || []) as LeaveRequest[],
        );

        upsertPayloads.push({
          workspace_id: workspaceId,
          membership_id: m.id,
          score,
          components,
          calculated_at: now,
        });

        if (score < 40) {
          newAlerts.push({
            workspace_id: workspaceId,
            membership_id: m.id,
            alert_type: 'burnout_risk',
            severity: score < 20 ? 'high' : 'medium',
            message: t('wellbeing.alert_burnout_message'),
            triggered_at: now,
            resolved_at: null,
          });
        }

        if (components.overtime_score < 40) {
          newAlerts.push({
            workspace_id: workspaceId,
            membership_id: m.id,
            alert_type: 'high_overtime',
            severity: components.overtime_score < 20 ? 'high' : 'medium',
            message: t('wellbeing.alert_overtime_message'),
            triggered_at: now,
            resolved_at: null,
          });
        }

        if (components.weekend_density_score < 40) {
          newAlerts.push({
            workspace_id: workspaceId,
            membership_id: m.id,
            alert_type: 'weekend_overload',
            severity: 'medium',
            message: t('wellbeing.alert_weekend_message'),
            triggered_at: now,
            resolved_at: null,
          });
        }

        if (components.leave_utilization_score < 25) {
          newAlerts.push({
            workspace_id: workspaceId,
            membership_id: m.id,
            alert_type: 'low_leave_usage',
            severity: 'low',
            message: t('wellbeing.alert_leave_message'),
            triggered_at: now,
            resolved_at: null,
          });
        }
      }

      const { error: upsertError } = await (supabase as any)
        .from('wellbeing_scores')
        .upsert(upsertPayloads, { onConflict: 'workspace_id,membership_id' });

      if (upsertError) {
        toast.error(t('wellbeing.recalculate_error'));
        setRecalculating(false);
        return;
      }

      if (newAlerts.length > 0) {
        await (supabase as any).from('wellbeing_alerts').insert(newAlerts);
      }

      toast.success(t('wellbeing.recalculate_success'));
      await loadScores();
      await loadAlerts();
    } catch {
      toast.error(t('wellbeing.recalculate_error'));
    } finally {
      setRecalculating(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await (supabase as any)
      .from('wellbeing_alerts')
      .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('id', alertId);

    if (error) {
      toast.error(t('wellbeing.resolve_error'));
    } else {
      toast.success(t('wellbeing.resolve_success'));
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
  };

  const atRisk = scores.filter((s) => s.score < 40).length;
  const monitoring = scores.filter((s) => s.score >= 40 && s.score < 70).length;
  const healthy = scores.filter((s) => s.score >= 70).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500" />
          <h2 className="text-xl font-semibold">{t('wellbeing.dashboard_title')}</h2>
        </div>
        {isAdmin && (
          <Button
            onClick={handleRecalculate}
            disabled={recalculating}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? t('wellbeing.recalculating') : t('wellbeing.recalculate_btn')}
          </Button>
        )}
      </div>

      {/* New v3.23.0 engine card: distribution + recalculate + open-alerts.
          Provides a faster "run now" path than the legacy button above. */}
      <WellbeingRecalculateCard workspaceId={workspaceId} />

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-700">{healthy}</div>
            <div className="text-sm text-green-600">{t('wellbeing.status_healthy')}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-yellow-700">{monitoring}</div>
            <div className="text-sm text-yellow-600">{t('wellbeing.status_monitor')}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-700">{atRisk}</div>
            <div className="text-sm text-red-600">{t('wellbeing.status_at_risk')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('wellbeing.heatmap_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingScores ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : scores.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <User className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t('wellbeing.no_scores')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {scores.map((s) => {
                const colors = scoreColorClasses(s.score);
                return (
                  <div
                    key={s.membership_id}
                    className={`rounded-lg border p-3 flex flex-col gap-1 ${colors.card}`}
                  >
                    <div className={`text-2xl font-bold ${colors.badge.split(' ')[1]}`}>
                      {s.score}
                    </div>
                    <div className="text-sm font-medium truncate leading-tight">
                      {s.display_name}
                    </div>
                    {s.business_role && (
                      <div className="text-xs text-muted-foreground truncate">{s.business_role}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert inbox */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t('wellbeing.alerts_title')}
            {alerts.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAlerts ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 opacity-40 text-green-500" />
              <p className="text-sm">{t('wellbeing.no_alerts')}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-3 pr-2">
                {alerts.map((alert, idx) => (
                  <div key={alert.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{alert.display_name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {t(`wellbeing.alert_type_${alert.alert_type}`)}
                          </Badge>
                          <Badge variant={severityVariant(alert.severity)} className="text-xs shrink-0">
                            {t(`wellbeing.severity_${alert.severity}`)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.triggered_at).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs shrink-0"
                        onClick={() => handleResolve(alert.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        {t('wellbeing.resolve_btn')}
                      </Button>
                    </div>
                    {idx < alerts.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
