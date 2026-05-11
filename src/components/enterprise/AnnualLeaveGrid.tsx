import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  format, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isSameDay, parseISO,
} from 'date-fns';
import { useI18n } from '@/i18n/I18nProvider';

interface MemberOption { id: string; user_id: string; display_name: string }
interface Props {
  workspaceId: string;
  userId: string;
  membershipId?: string;
  allMembers?: MemberOption[];
  isAdmin?: boolean;
}

interface LeaveDay { date: Date; type: string; status: string; color?: string }

export function AnnualLeaveGrid({ workspaceId, userId, membershipId: membershipIdProp, allMembers, isAdmin }: Props) {
  const { t } = useI18n();
  const MONTH_NAMES = t('annual_leave_grid.months_short').split(',');
  const DOW = t('annual_leave_grid.days_short').split(',');
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedUserId, setSelectedUserId] = useState(userId);
  const [resolvedMembershipId, setResolvedMembershipId] = useState<string | undefined>(membershipIdProp);
  const [leaves, setLeaves] = useState<LeaveDay[]>([]);
  const [holidays, setHolidays] = useState<Date[]>([]);
  const [quotas, setQuotas] = useState<{ initial: number; carryover: number; used: number; remaining: number }>({
    initial: 0, carryover: 0, used: 0, remaining: 0,
  });
  const [loading, setLoading] = useState(true);

  // When selectedUserId changes resolve membershipId from allMembers or fetch it
  useEffect(() => {
    if (membershipIdProp && selectedUserId === userId) {
      setResolvedMembershipId(membershipIdProp);
      return;
    }
    // Try allMembers first (fast path)
    const found = allMembers?.find(m => m.user_id === selectedUserId);
    if (found) {
      setResolvedMembershipId(found.id);
      return;
    }
    // Fallback: fetch from DB
    (async () => {
      const { data } = await (supabase as any)
        .from('enterprise_memberships')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', selectedUserId)
        .eq('status', 'active')
        .maybeSingle();
      setResolvedMembershipId(data?.id ?? undefined);
    })();
  }, [selectedUserId, workspaceId, membershipIdProp, userId, allMembers]);

  // Fallback colors for standard leave_type enum values (when no matching enterprise_leave_type name found)
  const LEAVE_TYPE_FALLBACK_COLORS: Record<string, string> = {
    vacation: '#10b981',
    sick_leave: '#f43f5e',
    unpaid_leave: '#f59e0b',
    other: '#8b5cf6',
    parental_leave: '#3b82f6',
  };

  const load = async () => {
    setLoading(true);
    const yStart = `${year}-01-01`;
    const yEnd = `${year}-12-31`;

    const [{ data: lr }, { data: hd }, { data: types }] = await Promise.all([
      (supabase as any).from('leave_requests')
        .select('start_date,end_date,status,leave_type')
        .eq('workspace_id', workspaceId)
        .eq('user_id', selectedUserId)
        // Overlap query: any leave that intersects with the year
        .lte('start_date', yEnd)
        .gte('end_date', yStart)
        .in('status', ['pending', 'approved']),
      (supabase as any).from('enterprise_holidays')
        .select('holiday_date,is_recurring')
        .eq('workspace_id', workspaceId),
      (supabase as any).from('enterprise_leave_types')
        .select('name,color')
        .eq('workspace_id', workspaceId),
    ]);

    // Build color map: custom type name (lowercased) -> color
    const colorMap = new Map<string, string>();
    (types || []).forEach((t: any) => colorMap.set(t.name?.toLowerCase() || '', t.color));

    const days: LeaveDay[] = [];
    (lr || []).forEach((r: any) => {
      // Clamp leave range to the current year for display purposes
      const clampedStart = r.start_date < yStart ? yStart : r.start_date;
      const clampedEnd = r.end_date > yEnd ? yEnd : r.end_date;
      const interval = eachDayOfInterval({ start: parseISO(clampedStart), end: parseISO(clampedEnd) });
      // Resolve color: try custom name match first, then fallback to enum colors
      const typeKey = r.leave_type?.toLowerCase() || '';
      const color = colorMap.get(typeKey) || LEAVE_TYPE_FALLBACK_COLORS[r.leave_type] || undefined;
      interval.forEach(d => days.push({
        date: d,
        type: r.leave_type,
        status: r.status,
        color,
      }));
    });
    setLeaves(days);

    const hDates: Date[] = [];
    (hd || []).forEach((h: any) => {
      const d = parseISO(h.holiday_date);
      if (h.is_recurring) hDates.push(new Date(year, d.getMonth(), d.getDate()));
      else if (d.getFullYear() === year) hDates.push(d);
    });
    setHolidays(hDates);

    // Quotas — needs resolvedMembershipId; if unavailable show fallback used count
    let initial = 0, carry = 0, adj = 0, used = 0;
    if (resolvedMembershipId) {
      const { data: q } = await (supabase as any)
        .from('enterprise_leave_quotas')
        .select('id,initial_days,carryover_days,manual_adjustment_days')
        .eq('workspace_id', workspaceId)
        .eq('membership_id', resolvedMembershipId)
        .eq('year', year)
        .eq('leave_type', 'vacation')
        .maybeSingle();

      if (q?.id) {
        // Aggregate ONLY this quota's TX-ek (workspace + év + típus már kötött a quota_id-n keresztül)
        const { data: tx } = await (supabase as any)
          .from('enterprise_quota_transactions')
          .select('amount_days,transaction_type')
          .eq('workspace_id', workspaceId)
          .eq('quota_id', q.id);
        const net = (tx || []).reduce((s: number, t: any) => s + Number(t.amount_days || 0), 0);
        used = Math.max(-net, 0);
        initial = Number(q.initial_days || 0);
        carry = Number(q.carryover_days || 0);
        adj = Number(q.manual_adjustment_days || 0);
      }

      // Fallback: if no quota row exists yet, derive USED from approved vacation
      // leave_requests in this year (so the user sees real consumption even without
      // an admin-configured allowance).
      if (!q?.id) {
        const approvedVacation = (lr || []).filter((r: any) => r.status === 'approved' && r.leave_type === 'vacation');
        let totalDays = 0;
        approvedVacation.forEach((r: any) => {
          const cs = r.start_date < yStart ? yStart : r.start_date;
          const ce = r.end_date > yEnd ? yEnd : r.end_date;
          const interval = eachDayOfInterval({ start: parseISO(cs), end: parseISO(ce) });
          // Count working days only (Mon-Fri), excluding holidays
          interval.forEach(d => {
            const dow = d.getDay();
            if (dow === 0 || dow === 6) return;
            const iso = format(d, 'yyyy-MM-dd');
            if ((hd || []).some((h: any) => h.holiday_date === iso || (h.is_recurring && h.holiday_date.slice(5) === iso.slice(5)))) return;
            totalDays += 1;
          });
        });
        used = totalDays;
      }
    }
    setQuotas({ initial, carryover: carry, used, remaining: Math.max(initial + carry + adj - used, 0) });

    setLoading(false);
  };

  useEffect(() => { load(); }, [year, workspaceId, selectedUserId, resolvedMembershipId]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const start = startOfMonth(new Date(year, m, 1));
      const end = endOfMonth(start);
      const days = eachDayOfInterval({ start, end });
      return { month: m, days };
    });
  }, [year]);

  const dayInfo = (d: Date) => {
    const leave = leaves.find(l => isSameDay(l.date, d));
    const isHoliday = holidays.some(h => isSameDay(h, d));
    const dow = getDay(d);
    const isWeekend = dow === 0 || dow === 6;
    return { leave, isHoliday, isWeekend };
  };

  const selectedMemberName = allMembers?.find(m => m.user_id === selectedUserId)?.display_name ?? t('member_profile.self_label');

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {t('annual_leave_grid.title')}
            <Badge variant="outline" className="text-[10px]">{year}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* User selector — visible to admins or when allMembers list provided */}
            {isAdmin && allMembers && allMembers.length > 0 && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder={t('annual_leave_grid.member_select_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.user_id === userId ? `${m.display_name} ${t('member_profile.me_indicator')}` : m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <YearPicker year={year} onChange={setYear} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Allowance summary */}
        {quotas.initial === 0 && quotas.carryover === 0 && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/40 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
            {t('annual_leave_grid.quota_missing_warning')}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-md border p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t('annual_leave_grid.allowance_label')}</p>
            <p className="text-lg font-semibold">{quotas.initial}</p>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t('annual_leave_grid.carryover_label')}</p>
            <p className="text-lg font-semibold">{quotas.carryover}</p>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t('annual_leave_grid.used_label')}</p>
            <p className="text-lg font-semibold">{quotas.used}</p>
          </div>
          <div className="rounded-md border p-2 text-center bg-primary/5">
            <p className="text-[10px] uppercase text-muted-foreground">{t('annual_leave_grid.remaining_label')}</p>
            <p className="text-lg font-semibold text-primary">{quotas.remaining}</p>
          </div>
        </div>

        {/* 12-month grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {months.map(({ month, days }) => {
            const firstDow = (getDay(days[0]) + 6) % 7;
            return (
              <div key={month} className="border rounded-md p-2">
                <p className="text-xs font-semibold mb-1">{MONTH_NAMES[month]}</p>
                <div className="grid grid-cols-7 gap-0.5 text-[9px] text-muted-foreground mb-1">
                  {DOW.map((d, i) => <div key={i} className="text-center">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
                  {days.map(d => {
                    const { leave, isHoliday, isWeekend } = dayInfo(d);
                    return (
                      <div
                        key={d.toISOString()}
                        title={
                          leave
                            ? `${leave.type} (${leave.status})`
                            : isHoliday
                            ? t('annual_leave_grid.holiday_tooltip')
                            : ''
                        }
                        className={cn(
                          'h-5 w-full rounded-sm flex items-center justify-center text-[9px]',
                          isWeekend && 'text-muted-foreground/60',
                          isHoliday && 'bg-destructive/15 text-destructive font-semibold',
                          leave && leave.status === 'approved' && 'text-white font-semibold',
                          leave && leave.status === 'pending' && 'ring-1 ring-inset',
                          !leave && !isHoliday && 'hover:bg-muted',
                        )}
                        style={leave ? { backgroundColor: leave.color || 'hsl(var(--primary))' } : undefined}
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-primary" /> {t('annual_leave_grid.legend_approved')}
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm ring-1 ring-primary" /> {t('annual_leave_grid.legend_pending')}
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-destructive/15" /> {t('annual_leave_grid.legend_holiday')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function YearPicker({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const { t } = useI18n();
  const [input, setInput] = useState(String(year));
  const [open, setOpen] = useState(false);
  const [decadeStart, setDecadeStart] = useState(Math.floor(year / 10) * 10);

  useEffect(() => { setInput(String(year)); }, [year]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1900 && n <= 2200) {
      onChange(n);
      setDecadeStart(Math.floor(n / 10) * 10);
    } else {
      setInput(String(year));
    }
  };

  const years = Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i);

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(year - 1)} aria-label={t('annual_leave_grid.prev_year_label')}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
          <Input
            type="number"
            min={1900}
            max={2200}
            value={input}
            onChange={e => setInput(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                commit((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-24 h-8 pr-7 text-xs text-center"
          />
          <PopoverTrigger asChild>
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
              aria-label={t('annual_leave_grid.year_picker_label')}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-56 p-2" align="end">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDecadeStart(d => d - 10)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-semibold">{decadeStart} – {decadeStart + 9}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDecadeStart(d => d + 10)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {years.map(y => (
              <Button
                key={y}
                size="sm"
                variant={y === year ? 'default' : 'ghost'}
                className={cn('h-8 text-xs', (y < decadeStart || y > decadeStart + 9) && 'text-muted-foreground/60')}
                onClick={() => { onChange(y); setOpen(false); }}
              >
                {y}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(year + 1)} aria-label={t('annual_leave_grid.next_year_label')}>
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
