import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Ban, Users, ArrowUpRight, X } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  isWeekend,
  parseISO,
} from 'date-fns';
import { CoverageConflictSummary } from './CoverageConflictSummary';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  status: string;
  start_date: string;
  end_date: string;
  comment: string | null;
  display_name?: string;
  team?: string | null;
  business_role?: string | null;
}

interface Holiday { id: string; name: string; holiday_date: string; }
interface BlockedDate { id: string; blocked_date: string; reason: string | null; }
interface DailyRule { id: string; day_of_week: number | null; rule_date: string | null; max_off: number | null; min_coverage: number | null; team_filter: string | null; role_filter: string | null; }
interface Member { user_id: string; team: string | null; role: string; business_role: string | null; }

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  approved: { dot: 'bg-emerald-500', label: 'Approved' },
  pending: { dot: 'bg-amber-500', label: 'Pending' },
  rejected: { dot: 'bg-rose-500', label: 'Rejected' },
};


interface Props {
  workspaceId: string;
  onNavigateTab?: (tab: string) => void;
  showLeaveDays?: boolean;
  showCoverage?: boolean;
  showRequests?: boolean;
  showConflicts?: boolean;
}

export function LeaveCalendar({ workspaceId, onNavigateTab, showLeaveDays = true, showCoverage = true, showRequests = true, showConflicts = true }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();

  const weekdayLabels = useMemo(() => [
    t('leave_calendar.weekday_mon'),
    t('leave_calendar.weekday_tue'),
    t('leave_calendar.weekday_wed'),
    t('leave_calendar.weekday_thu'),
    t('leave_calendar.weekday_fri'),
    t('leave_calendar.weekday_sat'),
    t('leave_calendar.weekday_sun'),
  ], [t]);

  const LEAVE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
    vacation: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', label: t('leave_calendar.type_vacation') },
    sick_leave: { bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300', label: t('leave_calendar.type_sick_leave') },
    unpaid_leave: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', label: t('leave_calendar.type_unpaid_leave') },
    other: { bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-violet-300 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-300', label: t('leave_calendar.type_other') },
  };

  const STATUS_CONFIG: Record<string, { label: string }> = {
    approved: { label: t('leave_calendar.status_approved') },
    pending: { label: t('leave_calendar.status_pending') },
    rejected: { label: t('leave_calendar.status_rejected') },
  };

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [dailyRules, setDailyRules] = useState<DailyRule[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [workspaceTeams, setWorkspaceTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [workspaceId]);

  const fetchData = async () => {
    setLoading(true);
    const [leavesRes, holidaysRes, blockedRes, rulesRes, membersRes, teamsRes] = await Promise.all([
      supabase.from('leave_requests').select('id, user_id, leave_type, status, start_date, end_date, comment').eq('workspace_id', workspaceId).in('status', ['approved', 'pending', 'rejected']).neq('status', 'cancelled' as any),
      supabase.from('enterprise_holidays').select('id, name, holiday_date').eq('workspace_id', workspaceId),
      supabase.from('enterprise_blocked_dates').select('id, blocked_date, reason').eq('workspace_id', workspaceId),
      supabase.from('enterprise_daily_rules').select('id, day_of_week, rule_date, max_off, min_coverage, team_filter, role_filter').eq('workspace_id', workspaceId),
      supabase.from('enterprise_memberships').select('user_id, team, role, business_role').eq('workspace_id', workspaceId).eq('status', 'active'),
      (supabase as any).from('enterprise_teams').select('id, name').eq('workspace_id', workspaceId).order('name'),
    ]);

    if (leavesRes.error) console.error('[LeaveCalendar] leaves fetch failed:', leavesRes.error.message);
    if (holidaysRes.error) console.error('[LeaveCalendar] holidays fetch failed:', holidaysRes.error.message);
    if (blockedRes.error) console.error('[LeaveCalendar] blocked dates fetch failed:', blockedRes.error.message);
    if (rulesRes.error) console.error('[LeaveCalendar] daily rules fetch failed:', rulesRes.error.message);
    if (membersRes.error) console.error('[LeaveCalendar] members fetch failed:', membersRes.error.message);

    setWorkspaceTeams((teamsRes.data as any[]) || []);

    const memberData = membersRes.data || [];
    setMembers(memberData as Member[]);
    setDailyRules((rulesRes.data || []) as DailyRule[]);

    const memberMap = new Map(memberData.map((m: any) => [m.user_id, { team: m.team, business_role: m.business_role }]));
    const userIds = [...new Set((leavesRes.data || []).map((l: any) => l.user_id))];

    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesErr } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      if (profilesErr) console.error('[LeaveCalendar] profiles fetch failed:', profilesErr.message);
      profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name || t('leave_calendar.unknown')]));
    }

    setLeaves((leavesRes.data || []).map((l: any) => ({
      ...l,
      display_name: profileMap.get(l.user_id) || t('leave_calendar.unknown'),
      team: memberMap.get(l.user_id)?.team || null,
      business_role: memberMap.get(l.user_id)?.business_role || null,
    })));
    setHolidays((holidaysRes.data || []) as Holiday[]);
    setBlockedDates((blockedRes.data || []) as BlockedDate[]);
    setLoading(false);
  };

  // Single source of truth: team list comes from enterprise_teams (Settings → Csapatok).
  // Falls back to inferred teams from member.team if no teams have been defined yet.
  const teams = useMemo(() => {
    if (workspaceTeams.length > 0) return workspaceTeams.map((t) => t.name).sort();
    const set = new Set(members.map((m) => m.team).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [workspaceTeams, members]);

  // All leaves filtered by team only (no status filter - we show all statuses)
  const teamFilteredLeaves = useMemo(() => {
    if (teamFilter === 'all') return leaves;
    return leaves.filter(l => l.team === teamFilter);
  }, [leaves, teamFilter]);

  // Approved leaves only (for szabadságnapok panel and risk calc)
  const approvedLeaves = useMemo(() => teamFilteredLeaves.filter(l => l.status === 'approved'), [teamFilteredLeaves]);

  // Pending leaves only (for igények panel)
  const pendingLeaves = useMemo(() => teamFilteredLeaves.filter(l => l.status === 'pending'), [teamFilteredLeaves]);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);

  const startDayOffset = useMemo(() => {
    const day = getDay(startOfMonth(currentMonth));
    return day === 0 ? 6 : day - 1;
  }, [currentMonth]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach(h => map.set(h.holiday_date, h.name));
    return map;
  }, [holidays]);

  const blockedMap = useMemo(() => {
    const map = new Map<string, string>();
    blockedDates.forEach(b => map.set(b.blocked_date, b.reason || t('leave_calendar.blocked_date_default')));
    return map;
  }, [blockedDates, t]);

  // Get ALL leaves for a day (for calendar dots - shows all statuses)
  const getAllLeavesForDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return teamFilteredLeaves.filter(l => dateStr >= l.start_date && dateStr <= l.end_date);
  }, [teamFilteredLeaves]);

  const getDayRiskInfo = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

    const dayApproved = leaves.filter(l => l.status === 'approved' && dateStr >= l.start_date && dateStr <= l.end_date);

    let capacityRisk = false;
    let coverageRisk = false;
    const riskDetails: string[] = [];

    const applicableRules = dailyRules.filter(r =>
      (r.rule_date === dateStr) || (r.day_of_week === dayOfWeek && !r.rule_date)
    );

    for (const rule of applicableRules) {
      let teamApproved = dayApproved;
      let teamMembers = members;

      if (rule.team_filter) {
        teamApproved = teamApproved.filter(l => l.team === rule.team_filter);
        teamMembers = teamMembers.filter(m => m.team === rule.team_filter);
      }
      if (rule.role_filter) {
        teamApproved = teamApproved.filter(l => l.business_role === rule.role_filter);
        teamMembers = teamMembers.filter(m => m.business_role === rule.role_filter);
      }

      const teamOff = teamApproved.length;

      if (rule.max_off !== null && teamOff >= rule.max_off) {
        capacityRisk = true;
        riskDetails.push(t('leave_calendar.coverage_exceeded', { scope: rule.role_filter || rule.team_filter || t('leave_calendar.all_scope'), max: rule.max_off, current: teamOff }));
      }
      if (rule.min_coverage !== null) {
        const available = teamMembers.length - teamOff;
        if (available < rule.min_coverage) {
          coverageRisk = true;
          riskDetails.push(t('leave_calendar.coverage_min_required', { scope: rule.role_filter || rule.team_filter || t('leave_calendar.all_scope'), min: rule.min_coverage, available }));
        }
      }
    }

    const offCount = dayApproved.length;
    return { capacityRisk, coverageRisk, offCount, totalMembers: members.length, riskDetails };
  }, [leaves, dailyRules, members]);

  const getDayDetails = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const allDayLeaves = getAllLeavesForDay(date);
    const holiday = holidayMap.get(dateStr);
    const blocked = blockedMap.get(dateStr);
    const weekend = isWeekend(date);
    const risk = getDayRiskInfo(date);
    return { allDayLeaves, holiday, blocked, weekend, ...risk };
  }, [getAllLeavesForDay, holidayMap, blockedMap, getDayRiskInfo]);

  // Approved leaves grouped by day for the month
  const monthApprovedByDay = useMemo(() => {
    const result: { date: string; count: number; leaves: LeaveRequest[] }[] = [];
    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayApproved = approvedLeaves.filter(l => dateStr >= l.start_date && dateStr <= l.end_date);
      if (dayApproved.length > 0) {
        result.push({ date: dateStr, count: dayApproved.length, leaves: dayApproved });
      }
    }
    return result;
  }, [days, approvedLeaves]);

  // Pending leaves grouped by day for the month
  const monthPendingByDay = useMemo(() => {
    const result: { date: string; count: number; leaves: LeaveRequest[] }[] = [];
    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayPending = pendingLeaves.filter(l => dateStr >= l.start_date && dateStr <= l.end_date);
      if (dayPending.length > 0) {
        result.push({ date: dateStr, count: dayPending.length, leaves: dayPending });
      }
    }
    return result;
  }, [days, pendingLeaves]);

  // All conflicts in the month
  const monthConflicts = useMemo(() => {
    const conflicts: { date: string; details: string[] }[] = [];
    for (const day of days) {
      const { riskDetails } = getDayRiskInfo(day);
      if (riskDetails.length > 0) {
        conflicts.push({ date: format(day, 'yyyy-MM-dd'), details: riskDetails });
      }
    }
    return conflicts;
  }, [days, getDayRiskInfo]);

  const handleDayClick = (day: Date) => {
    setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day);
  };

  const handleDateNavigate = (dateStr: string) => {
    const date = parseISO(dateStr);
    setSelectedDay(date);
    if (format(date, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
      setCurrentMonth(startOfMonth(date));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ==================== SIDEBAR PANELS ====================

  // Panel 1: Szabadságnapok - ONLY approved leaves
  const renderLeaveDaysPanel = () => {
    if (selectedDay) {
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      const dayApproved = approvedLeaves.filter(l => dateStr >= l.start_date && dateStr <= l.end_date);
      const risk = getDayRiskInfo(selectedDay);

      return (
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2 px-3 pt-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {t('leave_calendar.panel_leave_days', { date: format(selectedDay, 'MMM d.', { locale: dateFnsLocale }) })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t('leave_calendar.col_headcount')}</span>
              <span className="font-medium text-foreground">{risk.totalMembers - risk.offCount} / {risk.totalMembers}</span>
            </div>
            {getDayDetails(selectedDay).holiday && (
              <Badge variant="secondary" className="bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 text-[10px]">
                🎉 {getDayDetails(selectedDay).holiday}
              </Badge>
            )}
            {getDayDetails(selectedDay).blocked && (
              <Badge variant="destructive" className="text-[10px]">
                <Ban className="h-3 w-3 mr-1" /> {getDayDetails(selectedDay).blocked}
              </Badge>
            )}
            {dayApproved.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('leave_calendar.no_approved_today')}</p>
            ) : (
              <div className="space-y-1">
                {dayApproved.map(l => (
                  <div key={l.id} className="flex items-center gap-1.5 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="truncate">{l.display_name}</span>
                    {l.business_role && <Badge variant="outline" className="text-[9px] h-3.5 ml-auto flex-shrink-0">{l.business_role}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // No day selected: all approved leave days in the month
    return (
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CalendarDays className="h-3.5 w-3.5" />
            {t('leave_calendar.panel_leave_month', { month: format(currentMonth, 'MMMM', { locale: dateFnsLocale }) })}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {monthApprovedByDay.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('leave_calendar.no_approved_month')}</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {monthApprovedByDay.map(d => (
                <button
                  key={d.date}
                  onClick={() => handleDateNavigate(d.date)}
                  className="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors text-left"
                >
                  <span className="font-medium">{format(parseISO(d.date), 'MMM d. (EEE)', { locale: dateFnsLocale })}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 min-w-[24px] justify-center">{t('leave_calendar.persons_unit', { count: d.count })}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Panel 2: Conflicts
  const renderConflictsPanel = () => {
    if (selectedDay) {
      const risk = getDayRiskInfo(selectedDay);
      const hasRisk = risk.capacityRisk || risk.coverageRisk;
      return (
        <Card className={`border-l-4 ${hasRisk ? 'border-l-orange-500' : 'border-l-muted'}`}>
          <CardHeader className="pb-2 px-3 pt-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Konfliktusok — {format(selectedDay, 'MMM d.', { locale: dateFnsLocale })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {!hasRisk ? (
              <p className="text-xs text-muted-foreground">{t('leave_calendar.no_conflict_today')}</p>
            ) : (
              <div className="space-y-1.5">
                {risk.riskDetails.map((detail, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={`border-l-4 ${monthConflicts.length > 0 ? 'border-l-orange-500' : 'border-l-muted'}`}>
        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Konfliktusok — {format(currentMonth, 'MMMM', { locale: dateFnsLocale })}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {monthConflicts.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('leave_calendar.no_conflict_month')}</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {monthConflicts.map(c => (
                <button
                  key={c.date}
                  onClick={() => handleDateNavigate(c.date)}
                  className="w-full text-left rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors"
                >
                  <div className="text-xs font-medium">{format(parseISO(c.date), 'MMM d. (EEE)', { locale: dateFnsLocale })}</div>
                  {c.details.map((d, i) => (
                    <div key={i} className="text-[10px] text-orange-600 dark:text-orange-400 flex items-start gap-1 mt-0.5">
                      <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </div>
                  ))}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Panel 3: Igények - ONLY pending leaves (not yet decided)
  const renderRequestsPanel = () => {
    if (selectedDay) {
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      const dayPending = pendingLeaves.filter(l => dateStr >= l.start_date && dateStr <= l.end_date);

      return (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2 px-3 pt-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-primary">
              <Users className="h-3.5 w-3.5" />
              {t('leave_calendar.panel_requests_today', { date: format(selectedDay, 'MMM d.', { locale: dateFnsLocale }), count: dayPending.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {dayPending.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('leave_calendar.no_pending_today')}</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {dayPending.map(l => {
                  const typeStyle = LEAVE_TYPE_COLORS[l.leave_type] || LEAVE_TYPE_COLORS.other;
                  return (
                    <div key={l.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${typeStyle.bg} ${typeStyle.border}`}>
                      <span className="h-2 w-2 rounded-full flex-shrink-0 bg-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{l.display_name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          {l.business_role && <Badge variant="outline" className="text-[9px] h-3.5">{l.business_role}</Badge>}
                          <span className={typeStyle.text}>{typeStyle.label}</span>
                          <span>{l.start_date} → {l.end_date}</span>
                        </div>
                      </div>
                      {onNavigateTab && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); onNavigateTab('requests'); }}
                          title={t('leave_calendar.go_to_requests_title')}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // No day selected: pending requests grouped by date
    return (
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-primary">
            <Users className="h-3.5 w-3.5" />
            {t('leave_calendar.panel_requests_month', { month: format(currentMonth, 'MMMM', { locale: dateFnsLocale }) })}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {monthPendingByDay.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('leave_calendar.no_pending_month')}</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {monthPendingByDay.map(({ date, count }) => (
                <button
                  key={date}
                  onClick={() => handleDateNavigate(date)}
                  className="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors text-left"
                >
                  <span className="font-medium">{format(parseISO(date), 'MMM d. (EEE)', { locale: dateFnsLocale })}</span>
                  <Badge variant="outline" className="text-[10px] h-4 min-w-[24px] justify-center">{count}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {showCoverage && (
        <CoverageConflictSummary
          workspaceId={workspaceId}
          currentMonth={currentMonth}
          onNavigate={onNavigateTab}
        />
      )}

      {/* Filters + clear selection */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('leave_calendar.all_teams')}</SelectItem>
            {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedDay && (
          <Button variant="outline" size="sm" className="text-xs ml-auto" onClick={() => setSelectedDay(null)}>
            <X className="h-3 w-3 mr-1" />
            {t('leave_calendar.clear_selection')}
          </Button>
        )}
      </div>

      {/* Main layout: sidebar + calendar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left sidebar panels */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-3 order-2 lg:order-1">
          {showLeaveDays && renderLeaveDaysPanel()}
          {showConflicts && renderConflictsPanel()}
          {showRequests && renderRequestsPanel()}
        </div>

        {/* Calendar */}
        <div className="flex-1 order-1 lg:order-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base capitalize">
                  {format(currentMonth, 'yyyy. MMMM', { locale: dateFnsLocale })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3 sm:px-4">
              <div className="grid grid-cols-7 mb-1">
                {weekdayLabels.map((label, i) => (
                  <div key={`${label}-${i}`} className="text-center text-xs font-semibold text-muted-foreground py-1.5">{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-border/50 rounded-lg overflow-hidden">
                {Array.from({ length: startDayOffset }).map((_, i) => (
                  <div key={`e-${i}`} className="aspect-square bg-background/50" />
                ))}

                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const details = getDayDetails(day);
                  const allDayLeaves = details.allDayLeaves;
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const hasLeaves = allDayLeaves.length > 0;

                  let cellBg = 'bg-card';
                  if (details.capacityRisk || details.coverageRisk) cellBg = 'bg-orange-50 dark:bg-orange-950/20';
                  if (details.holiday) cellBg = 'bg-sky-50 dark:bg-sky-950/30';
                  if (details.blocked) cellBg = 'bg-red-50 dark:bg-red-950/20';
                  if (details.weekend) cellBg = 'bg-muted/40';

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className={`
                        relative aspect-square flex flex-col items-center justify-start pt-1 sm:pt-1.5 transition-all
                        ${cellBg}
                        ${isSelected ? 'ring-2 ring-primary ring-inset z-10' : ''}
                        ${isToday ? 'font-bold' : ''}
                        hover:bg-accent/20
                      `}
                    >
                      <span className={`text-xs sm:text-sm leading-none ${isToday ? 'text-primary' : ''} ${details.holiday ? 'text-sky-600 dark:text-sky-400' : ''}`}>
                        {format(day, 'd')}
                      </span>

                      {hasLeaves && (
                        <div className="flex flex-wrap justify-center gap-[2px] mt-0.5 px-0.5">
                          {allDayLeaves.slice(0, 4).map((l, i) => {
                            const statusStyle = STATUS_STYLES[l.status];
                            return (
                              <div
                                key={i}
                                className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${statusStyle?.dot || 'bg-muted-foreground'}`}
                                title={`${l.display_name} - ${LEAVE_TYPE_COLORS[l.leave_type]?.label || l.leave_type} (${STATUS_CONFIG[l.status]?.label || statusStyle?.label || l.status})`}
                              />
                            );
                          })}
                          {allDayLeaves.length > 4 && (
                            <span className="text-[8px] text-muted-foreground leading-none">+{allDayLeaves.length - 4}</span>
                          )}
                        </div>
                      )}

                      {(details.capacityRisk || details.coverageRisk) && !details.holiday && !details.blocked && (
                        <AlertTriangle className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-orange-500" />
                      )}

                      {details.holiday && <div className="absolute bottom-0.5 left-0 right-0 h-0.5 bg-sky-400 dark:bg-sky-600 mx-1 rounded-full" />}
                      {details.blocked && !details.holiday && <div className="absolute bottom-0.5 left-0 right-0 h-0.5 bg-destructive/60 mx-1 rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Legends */}
          <div className="mt-3 space-y-2">
            <Card>
              <CardContent className="py-2.5 px-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
                  <span className="font-semibold text-muted-foreground">{t('leave_calendar.legend_label')}</span>
                  {Object.entries(STATUS_STYLES).map(([key, style]) => (
                    <span key={key} className="inline-flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                      {STATUS_CONFIG[key]?.label || style.label}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-4 rounded bg-sky-200 dark:bg-sky-800 border border-sky-300 dark:border-sky-700" />
                    {t('leave_calendar.legend_holiday')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-4 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" />
                    {t('leave_calendar.legend_blocked')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-4 rounded bg-muted/60 border border-border" />
                    {t('leave_calendar.legend_weekend')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
