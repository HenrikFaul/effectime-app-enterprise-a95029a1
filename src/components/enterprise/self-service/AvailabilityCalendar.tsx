import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, CalendarCheck2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';
import {
  useMyAvailability,
  useUpsertAvailability,
  useDeleteAvailability,
  type AvailabilityStatus,
} from '@/hooks/useStaffAvailability';

interface Props {
  workspaceId: string;
  membershipId: string;
  userId: string;
}

const STATUS_CYCLE: (AvailabilityStatus | null)[] = [null, 'available', 'preferred', 'unavailable'];

function nextStatus(current: AvailabilityStatus | null): AvailabilityStatus | null {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

const STATUS_CLASSES: Record<AvailabilityStatus, string> = {
  available: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300',
  preferred: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300',
  unavailable: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400',
};

export function AvailabilityCalendar({ workspaceId, membershipId, userId }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const from = format(month, 'yyyy-MM-dd');
  const to = format(endOfMonth(month), 'yyyy-MM-dd');

  const { data: rows = [], isLoading } = useMyAvailability(workspaceId, userId, from, to);
  const upsert = useUpsertAvailability();
  const remove = useDeleteAvailability();

  const byDate = useMemo(() => {
    const m = new Map<string, { id: string; status: AvailabilityStatus }>();
    rows.forEach(r => m.set(r.availability_date, { id: r.id, status: r.status }));
    return m;
  }, [rows]);

  const days = useMemo(() =>
    eachDayOfInterval({ start: month, end: endOfMonth(month) }),
    [month]
  );

  const toggle = async (iso: string) => {
    const existing = byDate.get(iso) ?? null;
    const next = nextStatus(existing?.status ?? null);

    if (next === null) {
      if (existing) {
        try {
          await remove.mutateAsync({ id: existing.id, workspaceId, userId });
        } catch {
          toast.error(t('availability.save_error'));
        }
      }
      return;
    }

    try {
      await upsert.mutateAsync({
        workspaceId,
        membershipId,
        userId,
        date: iso,
        status: next,
      });
    } catch {
      toast.error(t('availability.save_error'));
    }
  };

  const legendItems: { status: AvailabilityStatus; label: string }[] = [
    { status: 'available', label: t('availability.status_available') },
    { status: 'preferred', label: t('availability.status_preferred') },
    { status: 'unavailable', label: t('availability.status_unavailable') },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck2 className="h-4 w-4" />
            {t('availability.title')}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(m => startOfMonth(new Date(m.getFullYear(), m.getMonth() - 1, 1)))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[130px] text-center">
              {format(month, 'yyyy. MMMM', { locale: dateFnsLocale })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(m => startOfMonth(new Date(m.getFullYear(), m.getMonth() + 1, 1)))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t('availability.hint')}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        ) : (
          <>
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
              ))}
            </div>

            {/* Leading blank cells */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {days.map(day => {
                const iso = format(day, 'yyyy-MM-dd');
                const entry = byDate.get(iso) ?? null;
                const status = entry?.status ?? null;
                const weekend = isWeekend(day);
                const inMonth = isSameMonth(day, month);

                return (
                  <button
                    key={iso}
                    onClick={() => toggle(iso)}
                    disabled={!inMonth}
                    className={cn(
                      'h-10 rounded border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
                      weekend && !status ? 'bg-muted/40 text-muted-foreground' : '',
                      !status && !weekend ? 'bg-background hover:bg-muted border-border text-foreground' : '',
                      !status && weekend ? 'border-muted' : '',
                      status ? STATUS_CLASSES[status] : '',
                      'cursor-pointer'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-3">
              {legendItems.map(({ status, label }) => (
                <Badge
                  key={status}
                  variant="outline"
                  className={cn('text-xs', STATUS_CLASSES[status])}
                >
                  {label}
                </Badge>
              ))}
              <span className="text-xs text-muted-foreground self-center ml-1">
                {t('availability.tap_to_cycle')}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
