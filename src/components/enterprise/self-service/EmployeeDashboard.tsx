import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AchievementsPanel } from '@/components/engagement/AchievementsPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Clock, CalendarCheck, FileText, ListChecks,
  TrendingUp, ArrowRight, AlertTriangle, CheckCircle2, Circle,
  Hourglass, CalendarDays, Wallet,
} from 'lucide-react';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import { hu } from 'date-fns/locale';
import { AttendancePeriodTotals, STATUS_BADGE_VARIANT, AttendancePeriodStatus } from '../time-attendance/types';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  onNavigateTab: (tab: string) => void;
}

interface QuotaBalance {
  quota_id: string;
  leave_type: string;
  initial_days: number;
  carryover_days: number;
  manual_adjustment_days: number;
  consumed_days: number;
  available_days: number;
}

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface WorkflowTask {
  id: string;
  instance_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  instance_title: string;
}

interface AttendancePeriod {
  id: string;
  year: number;
  month: number;
  status: AttendancePeriodStatus;
  totals: AttendancePeriodTotals | null;
  submitted_at: string | null;
  return_reason: string | null;
}

const LEAVE_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  cancelled: 'outline',
};

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: string;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${accent || 'bg-card'}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-xl font-bold leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function EmployeeDashboard({ workspaceId, userId, isAdmin, onNavigateTab }: Props) {
  const { t } = useI18n();
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [attendance, setAttendance] = useState<AttendancePeriod | null>(null);
  const [quotas, setQuotas] = useState<QuotaBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Resolve membership
    const { data: m } = await supabase
      .from('enterprise_memberships')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (!m) { setLoading(false); return; }
    setMembershipId(m.id);

    // 2. Display name
    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle();
    setDisplayName(prof?.display_name || '');

    // 3. Current month attendance period
    const { data: period } = await (supabase as any)
      .from('enterprise_attendance_periods')
      .select('id, year, month, status, totals, submitted_at, return_reason')
      .eq('workspace_id', workspaceId)
      .eq('membership_id', m.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    setAttendance(period || null);

    // 4. Leave quota balances for this year
    const { data: qb } = await (supabase as any)
      .from('enterprise_leave_quota_balances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('membership_id', m.id)
      .eq('year', year);
    setQuotas((qb as QuotaBalance[]) || []);

    // 5. Recent / open leave requests (last 60 days + future)
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const { data: lr } = await (supabase as any)
      .from('leave_requests')
      .select('id, start_date, end_date, leave_type, status, notes, created_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(8);
    setRequests((lr as LeaveRequest[]) || []);

    // 6. Open workflow tasks assigned to me
    const { data: wt } = await (supabase as any)
      .from('enterprise_hr_workflow_tasks')
      .select('id, instance_id, title, description, due_date, status, enterprise_hr_workflow_instances(title)')
      .eq('workspace_id', workspaceId)
      .eq('assignee_membership_id', m.id)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(10);
    setTasks(((wt as any[]) || []).map((t: any) => ({
      ...t,
      instance_title: t.enterprise_hr_workflow_instances?.title || '',
    })));

    setLoading(false);
  }, [workspaceId, userId, year, month]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground py-6">{t('common.loading')}</p>;
  if (!membershipId) return (
    <p className="text-sm text-muted-foreground py-6">{t('self_service.not_active_member')}</p>
  );

  const totals = attendance?.totals;
  const monthLabel = format(new Date(year, month - 1), 'MMMM', { locale: hu });
  const statusLabel = attendance ? t(`attendance.status_${attendance.status}` as any) : t('attendance.status_no_period');
  const statusVariant = attendance ? STATUS_BADGE_VARIANT[attendance.status] : 'outline';

  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const openTasks = tasks.filter(task => ['pending', 'in_progress'].includes(task.status)).length;
  const overdueTasks = tasks.filter(task =>
    ['pending', 'in_progress'].includes(task.status) && task.due_date && isPast(new Date(task.due_date))
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {t('self_service.greeting', { name: displayName ? `, ${displayName}` : '' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {format(now, 'yyyy. MMMM d., EEEE', { locale: hu })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {pendingRequests > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Hourglass className="h-3 w-3" />
              {t('self_service.pending_badge', { count: pendingRequests })}
            </Badge>
          )}
          {overdueTasks > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('self_service.overdue_badge', { count: overdueTasks })}
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              {t('self_service.attendance_title', { month: monthLabel })}
            </CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => onNavigateTab('time-attendance')}>
                {t('self_service.open_timesheet')} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {attendance?.status === 'returned' && attendance.return_reason && (
            <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              <strong>{t('self_service.returned_prefix')}</strong> {attendance.return_reason}
            </div>
          )}
          {totals ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label={t('self_service.stat_worked')} value={`${(totals.worked_hours || 0).toFixed(1)} h`} icon={TrendingUp} />
              <StatCard label={t('self_service.stat_overtime')} value={`${(totals.overtime_hours || 0).toFixed(1)} h`} icon={Clock}
                accent={(totals.overtime_hours || 0) > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20' : undefined}
              />
              <StatCard label={t('self_service.stat_expected')} value={`${(totals.expected_after_leave || 0).toFixed(1)} h`} icon={CalendarCheck} />
              <StatCard label={t('self_service.stat_payroll')} value={`${(totals.payroll_total_hours || 0).toFixed(1)} h`} icon={Wallet} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {attendance
                ? t('self_service.no_segments')
                : t('self_service.no_period', { month: monthLabel })}
            </p>
          )}
        </CardContent>
      </Card>

      {quotas.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              {t('self_service.quota_title', { year })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {quotas.map(q => {
              const total = q.initial_days + q.carryover_days + q.manual_adjustment_days;
              const usedPct = total > 0 ? Math.round((q.consumed_days / total) * 100) : 0;
              const leaveTypeKey = `self_service.leave_type_${q.leave_type}` as any;
              const leaveLabel = t(leaveTypeKey) !== leaveTypeKey ? t(leaveTypeKey) : q.leave_type;
              return (
                <div key={q.quota_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{leaveLabel}</span>
                    <span className="font-medium">
                      {t('self_service.quota_available', { count: q.available_days })}
                      <span className="text-muted-foreground font-normal"> {t('self_service.quota_total', { total })}</span>
                    </span>
                  </div>
                  <Progress value={usedPct} className="h-1.5" />
                </div>
              );
            })}
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-0 text-xs" onClick={() => onNavigateTab('requests')}>
              {t('self_service.quota_nav')} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {requests.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                {t('self_service.requests_title')}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs shrink-0" onClick={() => onNavigateTab('requests')}>
                {t('self_service.requests_nav')} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2">
              {requests.slice(0, 5).map(req => {
                const variant = LEAVE_STATUS_VARIANTS[req.status] ?? 'secondary';
                const statusKey = `self_service.leave_status_${req.status}` as any;
                const statusLabel = t(statusKey) !== statusKey ? t(statusKey) : req.status;
                const leaveTypeKey = `self_service.leave_type_${req.leave_type}` as any;
                const leaveLabel = t(leaveTypeKey) !== leaveTypeKey ? t(leaveTypeKey) : req.leave_type;
                const start = format(new Date(req.start_date), 'MMM d.', { locale: hu });
                const end = format(new Date(req.end_date), 'MMM d.', { locale: hu });
                return (
                  <div key={req.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">
                      {leaveLabel} · {start}–{end}
                    </span>
                    <Badge variant={variant} className="text-xs shrink-0">{statusLabel}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ListChecks className="h-4 w-4 text-primary" />
                {t('self_service.tasks_title')}
                {openTasks > 0 && <Badge variant="secondary" className="text-xs">{openTasks}</Badge>}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs shrink-0" onClick={() => onNavigateTab('workflows')}>
                {t('self_service.tasks_nav')} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {tasks.map(task => {
              const isOverdue = task.due_date && isPast(new Date(task.due_date));
              const isSoon = task.due_date && !isOverdue &&
                isWithinInterval(new Date(task.due_date), { start: now, end: addDays(now, 3) });
              return (
                <div key={task.id} className="flex items-start gap-2">
                  {task.status === 'done'
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    {task.instance_title && (
                      <p className="text-xs text-muted-foreground truncate">{task.instance_title}</p>
                    )}
                  </div>
                  {task.due_date && (
                    <span className={`text-xs shrink-0 ${isOverdue ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {format(new Date(task.due_date), 'MM.dd')}
                    </span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Gamification (Top-20 Rank 14, v3.18.0). Renders only if the
          membership exists; respects per-workspace + per-member opt-out via
          the engagement_record_event RPC, but the read panel itself is shown
          to encourage mastery (locked badges visible). */}
      {membershipId && (
        <AchievementsPanel workspaceId={workspaceId} membershipId={membershipId} />
      )}

      {tasks.length === 0 && requests.length === 0 && quotas.length === 0 && !attendance && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('self_service.empty_state')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
