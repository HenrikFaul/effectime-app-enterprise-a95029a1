import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Send, AlertTriangle, Loader2, Phone, Plus, Lock,
  Pencil, Save, Zap, Info,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend as dfIsWeekend, getYear, getMonth, addMonths, subMonths } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  getOrCreatePeriod, fetchPeriod, fetchSegments, fetchOnCallWindows,
  transitionPeriod,
} from './api';
import { durationHours } from './calculations';
import { DayEditorDialog } from './DayEditorDialog';
import { BatchFillDialog } from './BatchFillDialog';
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
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchInitialRange, setBatchInitialRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  // Edit-mode gate: the calendar is read-only by default; user must click the
  // pencil to enter edit mode, then save to commit + exit. The server-side
  // status (submitted/approved/locked/exported) overrides this — if the period
  // is not editable on the server, edit mode is unavailable.
  const [editMode, setEditMode] = useState(false);

  // Drag-selection state for multi-day batch fill
  const dragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startDate: string | null;
    hovered: Set<string>;
    moved: boolean;
  }>({ active: false, pointerId: null, startDate: null, hovered: new Set(), moved: false });
  const [dragPreview, setDragPreview] = useState<Set<string>>(new Set());

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

  // Leaving edit mode whenever month changes or status flips to non-editable
  useEffect(() => { setEditMode(false); }, [year, month]);
  useEffect(() => {
    if (period && ['submitted', 'approved', 'locked', 'exported'].includes(period.status)) {
      setEditMode(false);
    }
  }, [period?.status]);

  const segmentsByDay = useMemo(() => {
    const map = new Map<string, AttendanceSegment[]>();
    for (const s of segments) {
      const key = s.work_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [segments]);

  // Server-side read-only (the state machine forbids edits)
  const serverReadOnly = !period || ['submitted', 'approved', 'locked', 'exported'].includes(period.status);
  // Effective read-only: edit mode must also be ON to actually edit
  const canEdit = !serverReadOnly && editMode;

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
      setEditMode(false);
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

  // ─── Drag-select handlers ──────────────────────────────────────────────────

  const resetDrag = useCallback(() => {
    dragRef.current = { active: false, pointerId: null, startDate: null, hovered: new Set(), moved: false };
    setDragPreview(new Set());
  }, []);

  // Global cleanup so we don't get stuck in drag state if pointer leaves the grid
  useEffect(() => {
    const cancel = () => {
      if (dragRef.current.active) resetDrag();
    };
    window.addEventListener('pointercancel', cancel);
    return () => window.removeEventListener('pointercancel', cancel);
  }, [resetDrag]);

  const getDateFromPoint = useCallback((clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY);
    const cell = el?.closest('[data-day-cell]') as HTMLElement | null;
    return cell?.dataset.date || null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>, dateStr: string) => {
    if (!canEdit) return;
    // Only respond to primary button / touch / pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = {
      active: true, pointerId: e.pointerId, startDate: dateStr,
      hovered: new Set([dateStr]), moved: false,
    };
    setDragPreview(new Set([dateStr]));
  }, [canEdit]);

  const handleGridPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.pointerId !== null && e.pointerId !== dragRef.current.pointerId) return;

    const dateStr = getDateFromPoint(e.clientX, e.clientY);
    if (!dateStr) return;

    if (dateStr !== dragRef.current.startDate) dragRef.current.moved = true;

    if (!dragRef.current.hovered.has(dateStr)) {
      dragRef.current.hovered.add(dateStr);
      setDragPreview(new Set(dragRef.current.hovered));
    }
  }, [getDateFromPoint]);

  const handlePointerUpOnDay = useCallback((dateStr: string) => {
    if (!dragRef.current.active) return;
    const moved = dragRef.current.moved;
    const hovered = Array.from(dragRef.current.hovered).sort();
    resetDrag();

    if (!moved || hovered.length <= 1) {
      // Plain click → open day editor
      setEditingDate(new Date(dateStr));
      return;
    }

    // Drag across multiple days → open batch dialog with range
    const start = new Date(hovered[0]);
    const end = new Date(hovered[hovered.length - 1]);
    setBatchInitialRange({ start, end });
    setBatchOpen(true);
  }, [resetDrag]);

  // ─── Render ────────────────────────────────────────────────────────────────

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
            {canEdit && (
              <Badge variant="default" className="ml-1 gap-1 bg-amber-500 hover:bg-amber-500/90 text-amber-50">
                <Pencil className="h-3 w-3" />
                Szerkesztésre megnyitva
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {!serverReadOnly && !editMode && (
                <Button size="sm" variant="default" onClick={() => setEditMode(true)} title="Időnyilvántartás szerkesztése">
                  <Pencil className="h-3 w-3 mr-1" /> Szerkesztés
                </Button>
              )}
              {canEdit && (
                <>
                  <Button size="sm" variant="outline" onClick={() => {
                    setBatchInitialRange({ start: null, end: null });
                    setBatchOpen(true);
                  }} title="Időszak kitöltése egyetlen művelettel">
                    <Zap className="h-3 w-3 mr-1 text-amber-500" /> Batch kitöltés
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOncallOpen(true)}>
                    <Phone className="h-3 w-3 mr-1" /> Készenlét rögzítése
                  </Button>
                  <Button size="sm" variant="default" onClick={() => setEditMode(false)} title="Módosítások mentése és a szerkesztés bezárása">
                    <Save className="h-3 w-3 mr-1" /> Módosítások mentése
                  </Button>
                </>
              )}
              {!serverReadOnly && !editMode && period && segments.length > 0 && (
                <Button size="sm" onClick={handleSubmit}>
                  <Send className="h-3 w-3 mr-1" /> Benyújtás
                </Button>
              )}
            </div>
          </div>

          {/* Status banners */}
          {period?.status === 'returned' && period.return_reason && (
            <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <div><strong>Javításra visszaküldve:</strong> {period.return_reason}</div>
            </div>
          )}
          {canEdit && (
            <div className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs flex items-start gap-2">
              <Info className="h-3 w-3 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
              <div className="text-amber-800 dark:text-amber-200">
                A naptár szerkesztésre meg van nyitva. Egy napra kattintva napi szerkesztő nyílik. Több napon át húzva (egér/érintő) batch kitöltés indul. A „Módosítások mentése" gombra kattintva zárod a szerkesztést.
              </div>
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
          <div
            className="grid grid-cols-7 gap-1.5 select-none"
            onPointerMove={handleGridPointerMove}
            style={{ touchAction: canEdit ? 'none' : 'auto' }}
          >
            {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(d => (
              <div key={d} className="text-[10px] uppercase tracking-wide text-muted-foreground text-center pb-1">{d}</div>
            ))}
            {/* Pad to align first day to ISO weekday (Mon-first) */}
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
              const inDragPreview = dragPreview.has(key);

              return (
                <button
                  key={key}
                  data-day-cell
                  data-date={key}
                  type="button"
                  onPointerDown={(e) => handlePointerDown(e, key)}
                  onPointerUp={() => handlePointerUpOnDay(key)}
                  onClick={(e) => {
                    // Block legacy click when drag was active (covered by pointerup)
                    if (canEdit) { e.preventDefault(); return; }
                  }}
                  disabled={!canEdit && !daySegs.length && !hasOncall}
                  className={`p-2 rounded-md border text-left transition-colors min-h-[64px] flex flex-col gap-0.5 touch-none ${
                    isWeekend ? 'bg-muted/30 border-muted' : 'bg-card'
                  } ${totalH > 0 ? 'border-primary/40' : ''} ${
                    inDragPreview ? 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/30' : ''
                  } ${canEdit ? 'cursor-pointer hover:bg-accent' : 'cursor-default'}`}
                  title={canEdit ? 'Kattints szerkesztéshez vagy húzd több napra batch kitöltéshez' : (totalH > 0 || hasOncall ? 'Megtekintés (csak olvasható)' : '')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono">{format(d, 'd')}</span>
                    {hasOncall && <Phone className="h-2.5 w-2.5 text-amber-600" />}
                  </div>
                  {totalH > 0 ? (
                    <span className="text-[11px] tabular-nums font-medium">{totalH.toFixed(1)}h</span>
                  ) : (
                    canEdit && <Plus className="h-3 w-3 text-muted-foreground/50" />
                  )}
                  {daySegs.some(s => s.segment_type === 'overtime') && (
                    <Badge variant="destructive" className="text-[8px] px-1 py-0 self-start">+TÚL</Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Read-only hint */}
          {!serverReadOnly && !editMode && (
            <p className="mt-3 text-xs text-muted-foreground">
              A szerkesztéshez kattints a fenti <strong>Szerkesztés</strong> gombra. A naptárt addig csak olvashatod.
            </p>
          )}
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
          readOnly={!canEdit}
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
      {batchOpen && period && (
        <BatchFillDialog
          open={batchOpen}
          onOpenChange={setBatchOpen}
          periodId={period.id}
          year={year}
          month={month}
          initialStart={batchInitialRange.start}
          initialEnd={batchInitialRange.end}
          segments={segments}
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
