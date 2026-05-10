import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Send, AlertTriangle, Loader2, Phone, Plus, Lock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend as dfIsWeekend, getYear, getMonth, addMonths, subMonths } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  getOrCreatePeriod, fetchPeriod, fetchSegments, fetchOnCallWindows,
  upsertOnCallWindow, transitionPeriod,
} from './api';
import { durationHours } from './calculations';
import { DayEditorDialog } from './DayEditorDialog';
import {
  AttendancePeriod, AttendanceSegment, OnCallWindow,
  STATUS_LABELS, STATUS_BADGE_VARIANT,
} from './types';
import { TotalsSummary } from './TotalsSummary';
import { OnCallDialog } from './OnCallDialog';

interface Props {
  workspaceId: string;
}

export function EmployeeMonthView({ workspaceId }: Props) {
  const today = new Date();
  const [year, setYear] = useState(getYear(today));
  const [month, setMonth] = useState(getMonth(today) + 1); // 1-12
  const [period, setPeriod] = useState<AttendancePeriod | null>(null);
  const [segments, setSegments] = useState<AttendanceSegment[]>([]);
  const [windows, setWindows] = useState<OnCallWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<Date | null>(null);
  const [oncallOpen, setOncallOpen] = useState(false);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(new Date(year, month - 1, 1)), end: endOfMonth(new Date(year, month - 1, 1)) }),
    [year, month]
  );

  const reload = async () => {
    setLoading(true);
    try {
      const periodId = await getOrCreatePeriod(workspaceId, year, month);
      const [p, segs, ws] = await Promise.all([fetchPeriod(periodId), fetchSegments(periodId), fetchOnCallWindows(periodId)]);
      setPeriod(p);
      setSegments(segs);
      setWindows(ws);
    } catch (e: any) {
      toast.error(e?.message || 'Időszak betöltése sikertelen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [workspaceId, year, month]);

  const segmentsByDay = useMemo(() => {
    const map = new Map<string, AttendanceSegment[]>();
    for (const s of segments) {
      const key = s.work_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [segments]);

  const isReadOnly = !period || ['submitted', 'approved', 'locked', 'exported'].includes(period.status);

  const handleSubmit = async () => {
    if (!period) return;
    const issues = collectSubmissionWarnings(period, segments);
    if (issues.length > 0) {
      const proceed = confirm(`Figyelmeztetések:\n\n${issues.join('\n')}\n\nMégis benyújtod?`);
      if (!proceed) return;
    }
    try {
      await transitionPeriod(period.id, 'submitted');
      toast.success('Időszak benyújtva jóváhagyásra');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Benyújtás sikertelen');
    }
  };

  const handlePrevMonth = () => {
    const d = subMonths(new Date(year, month - 1), 1);
    setYear(getYear(d)); setMonth(getMonth(d) + 1);
  };
  const handleNextMonth = () => {
    const d = addMonths(new Date(year, month - 1), 1);
    setYear(getYear(d)); setMonth(getMonth(d) + 1);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Betöltés...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handlePrevMonth} aria-label="Előző hónap"><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base tabular-nums">
              {format(new Date(year, month - 1, 1), 'yyyy. MMMM', { locale: hu })}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={handleNextMonth} aria-label="Következő hónap"><ChevronRight className="h-4 w-4" /></Button>
            {period && (
              <Badge variant={STATUS_BADGE_VARIANT[period.status]} className="ml-2">
                {STATUS_LABELS[period.status]}
                {period.status === 'locked' && <Lock className="h-3 w-3 ml-1" />}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              {!isReadOnly && period && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setOncallOpen(true)}>
                    <Phone className="h-3 w-3 mr-1" /> Készenlét rögzítése
                  </Button>
                  <Button size="sm" onClick={handleSubmit}>
                    <Send className="h-3 w-3 mr-1" /> Benyújtás
                  </Button>
                </>
              )}
            </div>
          </div>
          {period?.status === 'returned' && period.return_reason && (
            <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <div><strong>Javításra visszaküldve:</strong> {period.return_reason}</div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Totals */}
      {period && <TotalsSummary totals={period.totals} />}

      {/* Day grid */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Napi bontás</CardTitle></CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-7 gap-1.5">
            {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(d => (
              <div key={d} className="text-[10px] uppercase tracking-wide text-muted-foreground text-center pb-1">{d}</div>
            ))}
            {/* Pad to align first day to ISO weekday */}
            {(() => {
              const first = days[0];
              const isoDow = first ? ((first.getDay() + 6) % 7) : 0;
              return Array.from({ length: isoDow }).map((_, i) => <div key={'pad' + i} />);
            })()}
            {days.map(d => {
              const key = format(d, 'yyyy-MM-dd');
              const daySegs = segmentsByDay.get(key) || [];
              const totalH = daySegs.filter(s => s.segment_type !== 'break').reduce((s, x) => s + durationHours(x.starts_at, x.ends_at), 0);
              const isWeekend = dfIsWeekend(d);
              const hasOncall = windows.some(w => w.starts_at.slice(0, 10) === key);
              return (
                <button
                  key={key}
                  onClick={() => setEditingDate(d)}
                  className={`p-2 rounded-md border text-left hover:bg-accent transition-colors min-h-[64px] flex flex-col gap-0.5 ${
                    isWeekend ? 'bg-muted/30 border-muted' : 'bg-card'
                  } ${totalH > 0 ? 'border-primary/40' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono">{format(d, 'd')}</span>
                    {hasOncall && <Phone className="h-2.5 w-2.5 text-amber-600" />}
                  </div>
                  {totalH > 0 ? (
                    <span className="text-[11px] tabular-nums font-medium">{totalH.toFixed(1)}h</span>
                  ) : (
                    !isReadOnly && <Plus className="h-3 w-3 text-muted-foreground/50" />
                  )}
                  {daySegs.some(s => s.segment_type === 'overtime') && (
                    <Badge variant="destructive" className="text-[8px] px-1 py-0 self-start">+TÚL</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day editor */}
      {editingDate && period && (
        <DayEditorDialog
          open={!!editingDate}
          onOpenChange={(v) => { if (!v) setEditingDate(null); }}
          periodId={period.id}
          date={editingDate}
          segments={segments}
          oncallWindows={windows}
          readOnly={isReadOnly}
          onChanged={reload}
        />
      )}
      {oncallOpen && period && (
        <OnCallDialog
          open={oncallOpen}
          onOpenChange={setOncallOpen}
          periodId={period.id}
          year={year}
          month={month}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function collectSubmissionWarnings(period: AttendancePeriod, segments: AttendanceSegment[]): string[] {
  const warnings: string[] = [];
  if (segments.length === 0) warnings.push('• Nincs egyetlen rögzített szegmens sem.');
  const t = period.totals;
  if (t.worked_hours < t.expected_after_leave * 0.5) {
    warnings.push(`• A ledolgozott idő (${t.worked_hours}h) jóval az elvárt alatt van (${t.expected_after_leave}h, levonva a szabadságokat).`);
  }
  return warnings;
}
