import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  format, addMonths, startOfMonth, subDays, parseISO, isWeekend, isToday,
  eachDayOfInterval,
} from 'date-fns';
import {
  TrendingUp, Users, DollarSign, Shield, Calendar, AlertTriangle, Activity,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

type RiskLevel = 'red' | 'yellow' | 'green';

interface MemberRisk {
  userId: string;
  name: string;
  sickDays: number;
  overtimeHours: number;
  risk: RiskLevel;
}

interface ForecastPoint {
  month: string;
  cost: number;
}

function countWorkingDays(year: number, month: number): number {
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (!isWeekend(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function riskBadge(level: RiskLevel) {
  if (level === 'red') return <Badge variant="destructive">🔴</Badge>;
  if (level === 'yellow') return <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-400">🟡</Badge>;
  return <Badge className="bg-green-500 text-white hover:bg-green-500">🟢</Badge>;
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map(i => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AnalyticsDashboard({ workspaceId, isAdmin }: Props) {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [attendancePeriods, setAttendancePeriods] = useState<any[]>([]);
  const [coverageRules, setCoverageRules] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const threeMonthsAgo = format(addMonths(now, -3), 'yyyy-MM-dd');
    const thirtyDaysAhead = format(addMonths(now, 1), 'yyyy-MM-dd');

    const load = async () => {
      setLoading(true);
      const [memRes, rateRes, leaveRes, attendRes, covRes] = await Promise.all([
        (supabase as any)
          .from('enterprise_memberships')
          .select('id, user_id, workspace_id, status, business_role, weekly_capacity_hours, base_working_hours')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),
        (supabase as any)
          .from('enterprise_member_rates')
          .select('id, membership_id, cost_rate, currency, effective_from, effective_to')
          .order('effective_from', { ascending: false }),
        (supabase as any)
          .from('leave_requests')
          .select('id, workspace_id, user_id, start_date, end_date, status, leave_type')
          .eq('workspace_id', workspaceId)
          .gte('start_date', threeMonthsAgo)
          .lte('start_date', thirtyDaysAhead),
        (supabase as any)
          .from('enterprise_attendance_periods')
          .select('id, workspace_id, membership_id, year, month, status, totals')
          .eq('workspace_id', workspaceId)
          .eq('year', currentYear)
          .eq('month', currentMonth)
          .in('status', ['submitted', 'approved']),
        (supabase as any)
          .from('enterprise_coverage_rules')
          .select('id, workspace_id, office_id, applies_to, min_headcount, business_role, skill_id')
          .eq('workspace_id', workspaceId),
      ]);

      const activeMembers: any[] = (memRes.data as any[]) || [];
      setMembers(activeMembers);
      setRates((rateRes.data as any[]) || []);
      setLeaveRequests((leaveRes.data as any[]) || []);
      setAttendancePeriods((attendRes.data as any[]) || []);
      setCoverageRules((covRes.data as any[]) || []);

      if (activeMembers.length > 0) {
        const userIds = activeMembers.map((m: any) => m.user_id);
        const { data: profData } = await (supabase as any)
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        setProfiles((profData as any[]) || []);
      }

      setLoading(false);
    };

    load();
  }, [workspaceId]);

  // Most recent rate per membership
  const latestRateByMembership = useMemo(() => {
    const map = new Map<string, any>();
    for (const rate of rates) {
      const existing = map.get(rate.membership_id);
      if (!existing || rate.effective_from > existing.effective_from) {
        map.set(rate.membership_id, rate);
      }
    }
    return map;
  }, [rates]);

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach(p => m.set(p.user_id, p.display_name || p.user_id));
    return m;
  }, [profiles]);

  // KPI 1: Total scheduled hours (current month)
  const totalScheduledHours = useMemo(
    () => attendancePeriods.reduce((sum: number, p: any) => sum + (p.totals?.regular_hours ?? 0), 0),
    [attendancePeriods],
  );

  // KPI 2: Labor cost MTD — members × rate × worked hours this month so far
  const laborCostMTD = useMemo(() => {
    const now = new Date();
    const workingDaysSoFar = countWorkingDays(now.getFullYear(), now.getMonth());
    let total = 0;
    let currency = 'EUR';
    for (const member of members) {
      const rate = latestRateByMembership.get(member.id);
      if (!rate) continue;
      const dailyHours = (member.weekly_capacity_hours || 40) / 5;
      total += dailyHours * workingDaysSoFar * (rate.cost_rate || 0);
      if (rate.currency) currency = rate.currency;
    }
    return { total, currency };
  }, [members, latestRateByMembership]);

  // KPI 3: Absence rate — approved leaves last 30 days / (active_members × 20 working days)
  const absenceRate = useMemo(() => {
    const now = new Date();
    const thirtyAgoStr = format(subDays(now, 30), 'yyyy-MM-dd');
    const todayStr = format(now, 'yyyy-MM-dd');

    const approvedLeaves = leaveRequests.filter(
      r => r.status === 'approved' && r.end_date >= thirtyAgoStr && r.start_date <= todayStr,
    );

    let leaveDays = 0;
    for (const r of approvedLeaves) {
      try {
        const start = parseISO(r.start_date < thirtyAgoStr ? thirtyAgoStr : r.start_date);
        const end = parseISO(r.end_date > todayStr ? todayStr : r.end_date);
        leaveDays += eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
      } catch { /* invalid interval */ }
    }

    const totalCapacity = members.length * 20;
    return totalCapacity > 0 ? Math.min(100, Math.round((leaveDays / totalCapacity) * 100)) : 0;
  }, [members, leaveRequests]);

  // KPI 4: Coverage score — available working days / 30 next days
  const coverageScore = useMemo(() => {
    const now = new Date();
    const endDate = addMonths(now, 1);
    const days = eachDayOfInterval({ start: now, end: endDate }).filter(d => !isWeekend(d));
    if (days.length === 0) return 100;

    const fullTeamLeaveDays = days.filter(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = leaveRequests.filter(
        r => r.status === 'approved' && r.start_date <= dateStr && r.end_date >= dateStr,
      ).length;
      return count >= members.length && members.length > 0;
    }).length;

    return Math.round(((days.length - fullTeamLeaveDays) / days.length) * 100);
  }, [members, leaveRequests]);

  // Coverage risk heatmap — next 13 weeks Mon→Sun grid
  const heatmapData = useMemo(() => {
    const now = new Date();
    const minHeadcount = coverageRules.length > 0
      ? Math.min(...coverageRules.map(r => r.min_headcount || 1))
      : Math.max(1, Math.ceil(members.length / 2));

    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);

    const weeks: { date: Date; leaves: number; isToday: boolean; weekend: boolean }[][] = [];
    for (let w = 0; w < 13; w++) {
      const week: typeof weeks[0] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + w * 7 + d);
        const dateStr = format(day, 'yyyy-MM-dd');
        const leavesOnDay = leaveRequests.filter(
          r => r.status === 'approved' && r.start_date <= dateStr && r.end_date >= dateStr,
        ).length;
        week.push({ date: day, leaves: leavesOnDay, isToday: isToday(day), weekend: isWeekend(day) });
      }
      weeks.push(week);
    }

    return { weeks, minHeadcount };
  }, [leaveRequests, coverageRules, members.length]);

  function cellColor(leaves: number, minHeadcount: number, weekend: boolean): string {
    if (weekend) return 'bg-muted/40 text-muted-foreground';
    if (leaves === 0) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    if (leaves >= minHeadcount) return 'bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-300';
    if (leaves >= 3) return 'bg-orange-200 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300';
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
  }

  // Labor cost forecast — current month + 5 ahead
  const forecastData = useMemo((): ForecastPoint[] => {
    const now = new Date();
    const threeMonthsAgo = addMonths(now, -3);

    const recentApproved = leaveRequests.filter(
      r => r.status === 'approved' && parseISO(r.start_date) >= threeMonthsAgo,
    );
    const totalLeaveDays = recentApproved.reduce((sum, r) => {
      try {
        return sum + eachDayOfInterval({ start: parseISO(r.start_date), end: parseISO(r.end_date) })
          .filter(d => !isWeekend(d)).length;
      } catch { return sum; }
    }, 0);
    const avgLeaveDaysPerMemberPerMonth = members.length > 0 ? totalLeaveDays / (members.length * 3) : 0;

    return Array.from({ length: 6 }, (_, i) => {
      const target = addMonths(startOfMonth(now), i);
      const workingDays = countWorkingDays(target.getFullYear(), target.getMonth());
      let cost = 0;
      for (const member of members) {
        const rate = latestRateByMembership.get(member.id);
        if (!rate) continue;
        const dailyHours = (member.weekly_capacity_hours || 40) / 5;
        const leaveDeduction = avgLeaveDaysPerMemberPerMonth * (member.base_working_hours || 8);
        const estimatedHours = Math.max(0, dailyHours * workingDays - leaveDeduction);
        cost += estimatedHours * (rate.cost_rate || 0);
      }
      return { month: format(target, 'MMM yyyy'), cost: Math.round(cost) };
    });
  }, [members, leaveRequests, latestRateByMembership]);

  // Absence & burnout risk table
  const memberRisks = useMemo((): MemberRisk[] => {
    const now = new Date();
    const ninetyAgoStr = format(subDays(now, 90), 'yyyy-MM-dd');
    const todayStr = format(now, 'yyyy-MM-dd');

    const risks: MemberRisk[] = members.map(member => {
      const sickLeaves = leaveRequests.filter(
        r => r.user_id === member.user_id &&
          r.leave_type === 'sick_leave' &&
          r.status === 'approved' &&
          r.start_date >= ninetyAgoStr,
      );
      let sickDays = 0;
      for (const r of sickLeaves) {
        try {
          const start = parseISO(r.start_date < ninetyAgoStr ? ninetyAgoStr : r.start_date);
          const end = parseISO(r.end_date > todayStr ? todayStr : r.end_date);
          sickDays += eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
        } catch { /* skip */ }
      }

      const overtimeHours = attendancePeriods
        .filter(p => p.membership_id === member.id)
        .reduce((sum: number, p: any) => sum + (p.totals?.overtime_hours ?? 0), 0);

      const risk: RiskLevel =
        sickDays > 5 || overtimeHours > 40 ? 'red'
          : sickDays > 2 || overtimeHours > 20 ? 'yellow'
            : 'green';

      return {
        userId: member.user_id,
        name: profileMap.get(member.user_id) || member.user_id,
        sickDays,
        overtimeHours,
        risk,
      };
    });

    return risks.sort((a, b) => {
      const order: Record<RiskLevel, number> = { red: 0, yellow: 1, green: 2 };
      return order[a.risk] - order[b.risk];
    });
  }, [members, leaveRequests, attendancePeriods, profileMap]);

  const coverageColor =
    coverageScore >= 80 ? 'text-green-600 dark:text-green-400'
      : coverageScore >= 60 ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

  const weekDayHeaders = [
    t('analytics.day_mon'), t('analytics.day_tue'), t('analytics.day_wed'), t('analytics.day_thu'),
    t('analytics.day_fri'), t('analytics.day_sat'), t('analytics.day_sun'),
  ];

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <KpiSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardContent className="pt-6"><Skeleton className="h-52 w-full" /></CardContent></Card>
          <Card><CardContent className="pt-6"><Skeleton className="h-52 w-full" /></CardContent></Card>
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-36 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('analytics.kpi_scheduled_hours')}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalScheduledHours.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t('analytics.kpi_hours_unit')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics.kpi_scheduled_hours_sub')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('analytics.kpi_labor_cost')}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {laborCostMTD.currency}&nbsp;{laborCostMTD.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics.kpi_labor_cost_sub')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('analytics.kpi_absence_rate')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absenceRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics.kpi_absence_rate_sub')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('analytics.kpi_coverage_score')}
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${coverageColor}`}>{coverageScore}%</div>
            <p className="text-xs text-muted-foreground mt-1">{t('analytics.kpi_coverage_score_sub')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Labor cost forecast */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{t('analytics.forecast_title')}</CardTitle>
            </div>
            <CardDescription>{t('analytics.forecast_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {forecastData.every(p => p.cost === 0) ? (
              <div className="flex items-center justify-center h-44 text-muted-foreground text-sm">
                {t('analytics.no_data')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={forecastData} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} width={40} />
                  <Tooltip
                    formatter={(val: number) => [
                      `${laborCostMTD.currency} ${val.toLocaleString()}`,
                      t('analytics.forecast_cost_label', { currency: laborCostMTD.currency }),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#analyticsGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Coverage risk heatmap */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{t('analytics.heatmap_title')}</CardTitle>
            </div>
            <CardDescription>{t('analytics.heatmap_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <div className="grid grid-cols-7 gap-px text-center min-w-[280px]">
                {weekDayHeaders.map(h => (
                  <div key={h} className="text-[10px] font-semibold text-muted-foreground py-1 select-none">{h}</div>
                ))}
                {heatmapData.weeks.map((week, wi) =>
                  week.map((cell, di) => (
                    <div
                      key={`${wi}-${di}`}
                      title={format(cell.date, 'yyyy-MM-dd')}
                      className={[
                        'rounded text-[11px] font-medium py-1 leading-tight select-none transition-colors',
                        cellColor(cell.leaves, heatmapData.minHeadcount, cell.weekend),
                        cell.isToday ? 'ring-2 ring-primary ring-offset-1' : '',
                      ].join(' ')}
                    >
                      {cell.date.getDate()}
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-3 mt-3 flex-wrap text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 inline-block" />
                  {t('analytics.heatmap_legend_safe')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 inline-block" />
                  {t('analytics.heatmap_legend_low')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-orange-200 dark:bg-orange-900/40 inline-block" />
                  {t('analytics.heatmap_legend_medium')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/40 inline-block" />
                  {t('analytics.heatmap_legend_high')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Absence & burnout risk table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{t('analytics.absence_title')}</CardTitle>
          </div>
          <CardDescription>{t('analytics.absence_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {memberRisks.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
              {t('analytics.absence_empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('analytics.absence_col_name')}</TableHead>
                  <TableHead className="text-right">{t('analytics.absence_col_sick')}</TableHead>
                  <TableHead className="text-right">{t('analytics.absence_col_overtime')}</TableHead>
                  <TableHead className="text-center">{t('analytics.absence_col_risk')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberRisks.map(m => (
                  <TableRow key={m.userId}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">{m.sickDays}</TableCell>
                    <TableCell className="text-right">{m.overtimeHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-center">{riskBadge(m.risk)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
