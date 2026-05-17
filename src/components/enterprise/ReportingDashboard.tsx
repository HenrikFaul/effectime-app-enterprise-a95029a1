import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, eachDayOfInterval, differenceInHours } from 'date-fns';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  cancelled: '#94a3b8',
};

export function ReportingDashboard({ workspaceId }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();

  const TYPE_LABELS: Record<string, string> = {
    vacation: t('attendance.leave_type_vacation'),
    sick_leave: t('attendance.leave_type_sick_leave'),
    unpaid_leave: t('attendance.leave_type_unpaid_leave'),
    other: t('attendance.leave_type_other'),
  };
  const [requests, setRequests] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [dailyRules, setDailyRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const fetchData = async () => {
    setLoading(true);
    const since = format(subDays(new Date(), parseInt(period)), 'yyyy-MM-dd');
    const [reqRes, memRes, rulesRes] = await Promise.all([
      supabase.from('leave_requests').select('*').eq('workspace_id', workspaceId).gte('created_at', since).order('created_at', { ascending: true }),
      supabase.from('enterprise_memberships').select('user_id, team, business_role').eq('workspace_id', workspaceId).eq('status', 'active' as any),
      supabase.from('enterprise_daily_rules').select('*').eq('workspace_id', workspaceId),
    ]);
    setRequests((reqRes.data as any[]) || []);
    setMembers((memRes.data as any[]) || []);
    setDailyRules((rulesRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [workspaceId, period]);

  // Basic KPIs
  const total = requests.length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;
  const pending = requests.filter(r => r.status === 'pending').length;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Advanced KPIs
  const avgApprovalTime = useMemo(() => {
    const reviewed = requests.filter(r => r.reviewed_at && r.created_at);
    if (reviewed.length === 0) return null;
    const totalHours = reviewed.reduce((acc, r) => {
      return acc + differenceInHours(new Date(r.reviewed_at), new Date(r.created_at));
    }, 0);
    return Math.round(totalHours / reviewed.length);
  }, [requests]);

  // Coverage breach calculation
  const coverageBreaches = useMemo(() => {
    if (dailyRules.length === 0) return { count: 0, shortStaffedDays: 0 };
    const days = eachDayOfInterval({ start: subDays(new Date(), Math.min(parseInt(period), 90)), end: new Date() });
    let breachCount = 0;
    let shortStaffedCount = 0;

    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
      const dayApproved = requests.filter(r => r.status === 'approved' && dateStr >= r.start_date && dateStr <= r.end_date);

      let dayHasBreach = false;
      for (const rule of dailyRules) {
        if (rule.rule_date && rule.rule_date !== dateStr) continue;
        if (rule.day_of_week !== null && rule.day_of_week !== dayOfWeek && !rule.rule_date) continue;

        let filtered = dayApproved;
        let filteredMembers = members;
        if (rule.team_filter) { filtered = filtered.filter((l: any) => { const m = members.find((m: any) => m.user_id === l.user_id); return m?.team === rule.team_filter; }); filteredMembers = filteredMembers.filter((m: any) => m.team === rule.team_filter); }
        if (rule.role_filter) { filtered = filtered.filter((l: any) => { const m = members.find((m: any) => m.user_id === l.user_id); return m?.business_role === rule.role_filter; }); filteredMembers = filteredMembers.filter((m: any) => m.business_role === rule.role_filter); }

        if (rule.max_off !== null && filtered.length > rule.max_off) { dayHasBreach = true; breachCount++; }
        if (rule.min_coverage !== null && (filteredMembers.length - filtered.length) < rule.min_coverage) { dayHasBreach = true; breachCount++; }
      }
      if (dayHasBreach) shortStaffedCount++;
    }
    return { count: breachCount, shortStaffedDays: shortStaffedCount };
  }, [requests, dailyRules, members, period]);

  // Team breakdown
  const teamBreakdown = useMemo(() => {
    const memberMap = new Map(members.map((m: any) => [m.user_id, m]));
    const teamCounts: Record<string, { approved: number; pending: number; total: number }> = {};
    for (const r of requests) {
      const m = memberMap.get(r.user_id);
      const team = m?.team || t('reporting.no_team_label');
      if (!teamCounts[team]) teamCounts[team] = { approved: 0, pending: 0, total: 0 };
      teamCounts[team].total++;
      if (r.status === 'approved') teamCounts[team].approved++;
      if (r.status === 'pending') teamCounts[team].pending++;
    }
    return Object.entries(teamCounts).map(([name, counts]) => ({ name, ...counts }));
  }, [requests, members]);

  // Role breakdown
  const roleBreakdown = useMemo(() => {
    const memberMap = new Map(members.map((m: any) => [m.user_id, m]));
    const roleCounts: Record<string, number> = {};
    for (const r of requests.filter(r => r.status === 'approved')) {
      const m = memberMap.get(r.user_id);
      const role = m?.business_role || t('reporting.no_role_label');
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }
    return Object.entries(roleCounts).map(([name, count]) => ({ name, count }));
  }, [requests, members]);

  // Status pie
  const statusData = [
    { name: t('reporting.status_approved'), value: approved, color: STATUS_COLORS.approved },
    { name: t('reporting.status_rejected'), value: rejected, color: STATUS_COLORS.rejected },
    { name: t('reporting.status_pending'), value: pending, color: STATUS_COLORS.pending },
    { name: t('reporting.status_cancelled'), value: requests.filter(r => r.status === 'cancelled').length, color: STATUS_COLORS.cancelled },
  ].filter(d => d.value > 0);

  // Type breakdown
  const typeData = Object.entries(
    requests.reduce((acc: Record<string, number>, r) => {
      acc[r.leave_type] = (acc[r.leave_type] || 0) + 1;
      return acc;
    }, {})
  ).map(([type, count]) => ({ name: TYPE_LABELS[type] || type, count }));

  // Daily chart
  const days = eachDayOfInterval({ start: subDays(new Date(), Math.min(parseInt(period), 30)), end: new Date() });
  const dailyData = days.map(d => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayRequests = requests.filter(r => r.start_date <= dateStr && r.end_date >= dateStr && r.status === 'approved');
    return { date: format(d, 'MM.dd'), off: dayRequests.length };
  });

  // Half-day stats
  const halfDayCount = requests.filter(r => r.is_half_day).length;

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('ws_nav.section_reports')}</h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t('reporting.period_7days')}</SelectItem>
            <SelectItem value="30">{t('reporting.period_30days')}</SelectItem>
            <SelectItem value="90">{t('reporting.period_90days')}</SelectItem>
            <SelectItem value="180">{t('reporting.period_180days')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards - row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">{t('reporting.total_requests')}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{approved}</p>
          <p className="text-xs text-muted-foreground">{t('reporting.approved_label')}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pending}</p>
          <p className="text-xs text-muted-foreground">{t('reporting.pending_label')}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{approvalRate}%</p>
          <p className="text-xs text-muted-foreground">{t('reporting.approval_rate_label')}</p>
        </CardContent></Card>
      </div>

      {/* KPI cards - row 2 (new advanced KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{avgApprovalTime !== null ? `${avgApprovalTime}h` : '–'}</p>
          <p className="text-xs text-muted-foreground">{t('reporting.avg_approval_time_label')}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-red-600">{coverageBreaches.count}</p>
          <p className="text-xs text-muted-foreground">{t('reporting.rule_breaches_label')}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{coverageBreaches.shortStaffedDays}</p>
          <p className="text-xs text-muted-foreground">{t('reporting.understaffed_days_label')}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-violet-600">{halfDayCount}</p>
          <p className="text-xs text-muted-foreground">{t('reporting.half_day_requests_label')}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {statusData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('reporting.status_distribution_title')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {typeData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('reporting.by_type_title')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Team breakdown */}
      {teamBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('reporting.by_team_title')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={teamBreakdown}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="approved" stackId="a" fill="#22c55e" name={t('reporting.approved_legend')} radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" stackId="a" fill="#f59e0b" name={t('reporting.pending_legend')} radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Role breakdown */}
      {roleBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('reporting.by_role_approved_title')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={roleBreakdown} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={t('reporting.approved_days_bar')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily off chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t('reporting.daily_absent_title')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(dailyData.length / 10))} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="off" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name={t('reporting.absent_employees_bar')} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
