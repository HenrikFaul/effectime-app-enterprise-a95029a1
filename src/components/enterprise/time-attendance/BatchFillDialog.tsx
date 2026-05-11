import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Zap, Loader2, AlertTriangle } from 'lucide-react';
import { format, eachDayOfInterval, isWeekend as dfIsWeekend, startOfMonth, endOfMonth } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import { upsertSegment, deleteSegment } from './api';
import { nightHoursInRange } from './calculations';
import { AttendanceSegment, AttendanceSegmentType } from './types';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodId: string;
  year: number;
  month: number;
  initialStart?: Date | null;
  initialEnd?: Date | null;
  /** When provided (drag-select mode): show the exact days instead of date pickers. */
  selectedDays?: Date[];
  segments: AttendanceSegment[];
  onSaved: () => void;
}

const toLocalDateStr = (d: Date) => format(d, 'yyyy-MM-dd');

export function BatchFillDialog({
  open, onOpenChange, periodId, year, month,
  initialStart, initialEnd, selectedDays, segments, onSaved,
}: Props) {
  const { t } = useI18n();
  const monthStart = toLocalDateStr(startOfMonth(new Date(year, month - 1)));
  const monthEnd = toLocalDateStr(endOfMonth(new Date(year, month - 1)));

  const isDragMode = !!selectedDays && selectedDays.length > 0;

  const [startDate, setStartDate] = useState<string>(monthStart);
  const [endDate, setEndDate] = useState<string>(monthEnd);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [segmentType, setSegmentType] = useState<AttendanceSegmentType>('regular');
  const [skipWeekend, setSkipWeekend] = useState(true);
  const [autoNight, setAutoNight] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate(initialStart ? toLocalDateStr(initialStart) : monthStart);
    setEndDate(initialEnd ? toLocalDateStr(initialEnd) : monthEnd);
    setStartTime('09:00');
    setEndTime('17:00');
    setSegmentType('regular');
    setSkipWeekend(true);
    setAutoNight(true);
    setOverwriteExisting(false);
  }, [open, initialStart, initialEnd, monthStart, monthEnd]);

  const startDay = new Date(startDate);
  const endDay = new Date(endDate);
  const rangeValid = startDate && endDate && startDate <= endDate;
  const rangeDays = rangeValid ? eachDayOfInterval({ start: startDay, end: endDay }) : [];
  const rangeWorkDays = skipWeekend ? rangeDays.filter(d => !dfIsWeekend(d)) : rangeDays;

  const workDays = isDragMode ? selectedDays : rangeWorkDays;

  const existingHits = workDays.filter(d => {
    const key = toLocalDateStr(d);
    return segments.some(s => s.work_date === key && s.segment_type !== 'break');
  }).length;

  const apply = async () => {
    if (!isDragMode && !rangeValid) { toast.error(t('batch_fill.error_invalid_range')); return; }
    if (workDays.length === 0) { toast.error(t('batch_fill.error_no_days')); return; }
    if (startTime >= endTime) { toast.error(t('batch_fill.error_time_order')); return; }

    setBusy(true);
    let ok = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (const day of workDays) {
        const key = toLocalDateStr(day);
        const starts_at = `${key}T${startTime}:00`;
        const ends_at = `${key}T${endTime}:00`;
        const isWeekend = dfIsWeekend(day);
        const isNight = autoNight && nightHoursInRange(starts_at, ends_at) > 0;

        const existing = segments.filter(s => s.work_date === key && s.segment_type !== 'break');

        if (existing.length > 0 && !overwriteExisting) {
          skipped++;
          continue;
        }

        try {
          if (overwriteExisting) {
            for (const seg of existing) {
              await deleteSegment(seg.id);
            }
          }
          await upsertSegment({
            period_id: periodId,
            starts_at, ends_at,
            segment_type: segmentType,
            is_weekend: isWeekend,
            is_night: isNight,
          });
          ok++;
        } catch {
          failed++;
        }
      }

      if (ok > 0) {
        let msg = t('batch_fill.success', { ok });
        if (skipped > 0) msg += ` (${t('batch_fill.all_skipped', { count: skipped }).split(' — ')[0]})`;
        if (failed > 0) msg += ` (${t('batch_fill.failed_days', { count: failed })})`;
        toast.success(msg);
      } else if (skipped > 0 && failed === 0) {
        toast.info(t('batch_fill.all_skipped', { count: skipped }));
      } else if (failed > 0) {
        toast.error(t('batch_fill.failed_days', { count: failed }));
      }

      onSaved();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const applyDisabled = busy
    || (isDragMode ? workDays.length === 0 : (!rangeValid || rangeWorkDays.length === 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            {t('batch_fill.title')}
          </DialogTitle>
          <DialogDescription>
            {isDragMode ? t('batch_fill.desc_drag') : t('batch_fill.desc_range')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isDragMode ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('batch_fill.selected_days')}</Label>
              <div className="rounded-md border bg-muted/30 p-2 max-h-40 overflow-y-auto space-y-0.5">
                {selectedDays.map(d => (
                  <div key={toLocalDateStr(d)} className="text-xs px-1 py-0.5">
                    {format(d, 'EEEE, MMM d.', { locale: hu })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('batch_fill.start_date')}</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  min={monthStart} max={monthEnd} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('batch_fill.end_date')}</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  min={monthStart} max={monthEnd} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('batch_fill.work_start')}</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('batch_fill.work_end')}</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          {!isDragMode && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('batch_fill.type')}</Label>
              <Select value={segmentType} onValueChange={v => setSegmentType(v as AttendanceSegmentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">{t('attendance.segment_regular')}</SelectItem>
                  <SelectItem value="overtime">{t('attendance.segment_overtime')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 rounded-md border bg-muted/30 p-2">
            {!isDragMode && (
              <div className="flex items-center justify-between">
                <Label className="text-xs flex-1">{t('batch_fill.skip_weekends')}</Label>
                <Switch checked={skipWeekend} onCheckedChange={setSkipWeekend} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-xs flex-1">{t('batch_fill.auto_night')}</Label>
              <Switch checked={autoNight} onCheckedChange={setAutoNight} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs flex-1">{t('batch_fill.overwrite')}</Label>
              <Switch checked={overwriteExisting} onCheckedChange={setOverwriteExisting} />
            </div>
          </div>

          <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-xs">
            <p>
              <strong>{workDays.length}</strong> {t('batch_fill.days_count', { count: workDays.length }).split(' ').slice(1).join(' ')}
              {!isDragMode && skipWeekend && rangeDays.length > rangeWorkDays.length && (
                <span className="text-muted-foreground"> {t('batch_fill.weekends_skipped', { count: rangeDays.length - rangeWorkDays.length })}</span>
              )}
            </p>
            {existingHits > 0 && (
              <p className={`mt-1 flex items-start gap-1 ${overwriteExisting ? 'text-destructive' : 'text-amber-600'}`}>
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {overwriteExisting
                  ? t('batch_fill.existing_overwrite', { count: existingHits })
                  : t('batch_fill.existing_skip', { count: existingHits })
                }
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={apply} disabled={applyDisabled}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Zap className="h-3 w-3 mr-1.5" />}
            {t('batch_fill.apply', { count: workDays.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
