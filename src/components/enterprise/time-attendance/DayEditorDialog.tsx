import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Moon, CalendarDays, Phone, Briefcase, AlertTriangle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { AttendanceSegment, AttendanceSegmentType, OnCallWindow } from './types';
import { durationHours, isWeekendDate, validateSegment } from './calculations';
import { upsertSegment, deleteSegment, upsertSiteAssignment, removeSiteAssignment } from './api';
import type { OfficeOption, SiteAssignment } from './api';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodId: string;
  date: Date;
  segments: AttendanceSegment[];
  oncallWindows: OnCallWindow[];
  readOnly: boolean;
  onChanged: () => void;
  // Site-assignment props (optional — omit to hide the site section)
  workspaceId?: string;
  membershipId?: string | null;
  userId?: string;
  offices?: OfficeOption[];
  siteAssignment?: SiteAssignment | null;
  onSiteChanged?: () => void;
}

export function DayEditorDialog({
  open, onOpenChange, periodId, date, segments, oncallWindows, readOnly, onChanged,
  workspaceId, membershipId, userId, offices, siteAssignment, onSiteChanged,
}: Props) {
  const { t } = useI18n();
  const dayKey = format(date, 'yyyy-MM-dd');
  const daySegments = useMemo(
    () => segments.filter(s => s.work_date === dayKey).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [segments, dayKey]
  );
  const dayWindows = useMemo(
    () => oncallWindows.filter(w => w.starts_at.slice(0, 10) === dayKey),
    [oncallWindows, dayKey]
  );

  const [editing, setEditing] = useState<Partial<AttendanceSegment> & { _isNew?: boolean }>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Site picker local state
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [savingSite, setSavingSite] = useState(false);

  useEffect(() => {
    if (open) {
      setEditing({});
      setErrors([]);
      setSelectedOfficeId(siteAssignment?.office_id ?? '');
    }
  }, [open, dayKey, siteAssignment?.office_id]);

  const totalDayHours = useMemo(
    () => daySegments
      .filter(s => s.segment_type !== 'break')
      .reduce((sum, s) => sum + durationHours(s.starts_at, s.ends_at), 0),
    [daySegments]
  );

  const startEdit = (segment?: AttendanceSegment) => {
    if (segment) {
      setEditing({ ...segment });
    } else {
      const isWeekend = isWeekendDate(date);
      setEditing({
        _isNew: true,
        starts_at: `${dayKey}T09:00`,
        ends_at: `${dayKey}T17:00`,
        segment_type: 'regular',
        is_weekend: isWeekend,
        is_night: false,
      });
    }
    setErrors([]);
  };

  const handleSave = async () => {
    if (!editing.starts_at || !editing.ends_at || !editing.segment_type) return;
    const startsIso = new Date(editing.starts_at).toISOString();
    const endsIso = new Date(editing.ends_at).toISOString();
    const errs = validateSegment({ starts_at: startsIso, ends_at: endsIso }, daySegments, editing.id);
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await upsertSegment({
        id: editing.id ?? null,
        period_id: periodId,
        starts_at: startsIso,
        ends_at: endsIso,
        segment_type: editing.segment_type as AttendanceSegmentType,
        is_weekend: !!editing.is_weekend,
        is_night: !!editing.is_night,
        oncall_window_id: editing.oncall_window_id ?? null,
        note: editing.note ?? null,
      });
      toast.success(t('common.save'));
      setEditing({});
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || t('day_editor.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('day_editor.delete_confirm'))) return;
    try {
      await deleteSegment(id);
      toast.success(t('day_editor.deleted_success'));
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || t('day_editor.delete_error'));
    }
  };

  const handleSaveSite = async () => {
    if (!workspaceId || !membershipId || !userId || !selectedOfficeId) return;
    setSavingSite(true);
    try {
      await upsertSiteAssignment(workspaceId, membershipId, userId, selectedOfficeId, dayKey);
      toast.success(t('attendance.site_saved'));
      onSiteChanged?.();
    } catch (e: any) {
      toast.error(e?.message || t('day_editor.site_save_error'));
    } finally {
      setSavingSite(false);
    }
  };

  const handleRemoveSite = async () => {
    if (!workspaceId || !membershipId) return;
    setSavingSite(true);
    try {
      await removeSiteAssignment(workspaceId, membershipId, dayKey);
      setSelectedOfficeId('');
      toast.success(t('attendance.site_removed'));
      onSiteChanged?.();
    } catch (e: any) {
      toast.error(e?.message || t('day_editor.site_delete_error'));
    } finally {
      setSavingSite(false);
    }
  };

  const showSiteSection = !!(workspaceId && membershipId && userId && offices && offices.length > 0);
  const siteChanged = selectedOfficeId !== (siteAssignment?.office_id ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {format(date, 'yyyy. MM. dd., EEEE')}
            {isWeekendDate(date) && <Badge variant="destructive" className="text-[10px]">{t('day_editor.weekend_badge')}</Badge>}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {t('day_editor.daily_total', { hours: totalDayHours.toFixed(2) })}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Existing segments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('day_editor.segments_label')}</Label>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={() => startEdit()}>
                <Plus className="h-3 w-3 mr-1" /> {t('day_editor.new_segment_btn')}
              </Button>
            )}
          </div>
          {daySegments.length === 0 && !editing.starts_at ? (
            <p className="text-sm text-muted-foreground">{t('day_editor.no_segments')}</p>
          ) : (
            <div className="space-y-1.5">
              {daySegments.map(s => (
                <div key={s.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30 text-sm">
                  <SegmentTypeBadge type={s.segment_type} />
                  <span className="font-mono text-xs">
                    {s.starts_at.slice(11, 16)} – {s.ends_at.slice(11, 16)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({durationHours(s.starts_at, s.ends_at).toFixed(2)}h)
                  </span>
                  {s.is_night && <Moon className="h-3 w-3 text-blue-500" aria-label={t('day_editor.night_aria')} />}
                  {s.is_weekend && <Badge variant="destructive" className="text-[9px] px-1">HV</Badge>}
                  {s.note && <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={s.note}>{s.note}</span>}
                  {!readOnly && (
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(s)}>{t('day_editor.edit_btn')}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {dayWindows.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('day_editor.oncall_section_label')}</Label>
              {dayWindows.map(w => (
                <div key={w.id} className="flex items-center gap-2 p-2 border rounded-md bg-amber-50 dark:bg-amber-900/20 text-sm">
                  <Phone className="h-3 w-3 text-amber-600" />
                  <span className="font-mono text-xs">
                    {w.starts_at.slice(11, 16)} – {w.ends_at.slice(11, 16)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({durationHours(w.starts_at, w.ends_at).toFixed(2)}h × {w.standby_multiplier})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Site picker */}
        {showSiteSection && (
          <div className="border rounded-md p-3 space-y-2 bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <Label className="text-xs font-medium text-sky-700 dark:text-sky-300">
                {t('attendance.site_picker_label')}
              </Label>
              {siteAssignment && !readOnly && (
                <Button
                  size="sm" variant="ghost"
                  className="ml-auto h-6 px-1.5 text-[10px] text-destructive"
                  onClick={handleRemoveSite} disabled={savingSite}
                >
                  <Trash2 className="h-2.5 w-2.5 mr-1" />{t('common.delete')}
                </Button>
              )}
            </div>
            {readOnly ? (
              <p className="text-xs text-muted-foreground">
                {siteAssignment
                  ? offices?.find(o => o.id === siteAssignment.office_id)?.name ?? siteAssignment.office_id
                  : t('attendance.no_site')}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder={t('attendance.select_site_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {offices?.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}{o.city ? ` (${o.city})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" onClick={handleSaveSite}
                  disabled={savingSite || !selectedOfficeId || !siteChanged}
                  className="h-8"
                >
                  {t('common.save')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Editor */}
        {editing.starts_at && (
          <div className="border rounded-md p-3 space-y-3 bg-card">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('day_editor.start_label')}</Label>
                <Input
                  type="datetime-local"
                  value={editing.starts_at?.slice(0, 16)}
                  onChange={e => setEditing(p => ({ ...p, starts_at: e.target.value }))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">{t('day_editor.end_label')}</Label>
                <Input
                  type="datetime-local"
                  value={editing.ends_at?.slice(0, 16)}
                  onChange={e => setEditing(p => ({ ...p, ends_at: e.target.value }))}
                  className="h-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('day_editor.type_label')}</Label>
              <Select
                value={editing.segment_type as string}
                onValueChange={v => setEditing(p => ({ ...p, segment_type: v as AttendanceSegmentType }))}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">{t('day_editor.type_regular')}</SelectItem>
                  <SelectItem value="overtime">{t('day_editor.type_overtime')}</SelectItem>
                  <SelectItem value="break">{t('day_editor.type_break')}</SelectItem>
                  <SelectItem value="oncall_intervention">{t('day_editor.type_oncall')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!editing.is_weekend}
                  onCheckedChange={v => setEditing(p => ({ ...p, is_weekend: v }))}
                />
                <Label className="text-xs cursor-pointer">{t('day_editor.weekend_work_label')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!editing.is_night}
                  onCheckedChange={v => setEditing(p => ({ ...p, is_night: v }))}
                />
                <Label className="text-xs cursor-pointer">{t('day_editor.night_work_label')}</Label>
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('day_editor.note_label')}</Label>
              <Input
                value={editing.note ?? ''}
                onChange={e => setEditing(p => ({ ...p, note: e.target.value }))}
                className="h-8"
                placeholder={t('day_editor.note_placeholder')}
              />
            </div>
            {errors.length > 0 && (
              <div className="text-xs text-destructive flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <ul className="space-y-0.5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>{t('common.save')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing({})}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SegmentTypeBadge({ type }: { type: AttendanceSegmentType }) {
  const { t } = useI18n();
  const cfg: Record<AttendanceSegmentType, { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive'; icon?: React.ReactNode }> = {
    regular: { label: t('day_editor.badge_regular'), variant: 'default', icon: <Briefcase className="h-2.5 w-2.5" /> },
    overtime: { label: t('day_editor.badge_overtime'), variant: 'destructive' },
    break: { label: t('day_editor.badge_break'), variant: 'secondary' },
    oncall_intervention: { label: t('day_editor.badge_oncall'), variant: 'destructive', icon: <Phone className="h-2.5 w-2.5" /> },
  };
  const c = cfg[type];
  return (
    <Badge variant={c.variant} className="text-[10px] gap-1 shrink-0">
      {c.icon}
      {c.label}
    </Badge>
  );
}
