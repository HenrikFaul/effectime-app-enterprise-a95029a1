import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Moon, CalendarDays, Phone, Briefcase, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { AttendanceSegment, AttendanceSegmentType, OnCallWindow } from './types';
import { durationHours, isWeekendDate, validateSegment } from './calculations';
import { upsertSegment, deleteSegment } from './api';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodId: string;
  date: Date;
  segments: AttendanceSegment[];
  oncallWindows: OnCallWindow[];
  readOnly: boolean;
  onChanged: () => void;
}

export function DayEditorDialog({ open, onOpenChange, periodId, date, segments, oncallWindows, readOnly, onChanged }: Props) {
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

  useEffect(() => {
    if (open) {
      setEditing({});
      setErrors([]);
    }
  }, [open, dayKey]);

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
      toast.success('Mentve');
      setEditing({});
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt a szegmenst?')) return;
    try {
      await deleteSegment(id);
      toast.success('Törölve');
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Törlés sikertelen');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {format(date, 'yyyy. MM. dd., EEEE')}
            {isWeekendDate(date) && <Badge variant="destructive" className="text-[10px]">Hétvége</Badge>}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              Napi össz: {totalDayHours.toFixed(2)} óra
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Existing segments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Szegmensek</Label>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={() => startEdit()}>
                <Plus className="h-3 w-3 mr-1" /> Új szegmens
              </Button>
            )}
          </div>
          {daySegments.length === 0 && !editing.starts_at ? (
            <p className="text-sm text-muted-foreground">Még nincs szegmens. Kattints az "Új szegmens" gombra.</p>
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
                  {s.is_night && <Moon className="h-3 w-3 text-blue-500" aria-label="Éjszakai" />}
                  {s.is_weekend && <Badge variant="destructive" className="text-[9px] px-1">HV</Badge>}
                  {s.note && <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={s.note}>{s.note}</span>}
                  {!readOnly && (
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(s)}>Szerk.</Button>
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
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Készenlét (on-call)</Label>
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

        {/* Editor */}
        {editing.starts_at && (
          <div className="border rounded-md p-3 space-y-3 bg-card">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kezdés</Label>
                <Input
                  type="datetime-local"
                  value={editing.starts_at?.slice(0, 16)}
                  onChange={e => setEditing(p => ({ ...p, starts_at: e.target.value }))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Vége</Label>
                <Input
                  type="datetime-local"
                  value={editing.ends_at?.slice(0, 16)}
                  onChange={e => setEditing(p => ({ ...p, ends_at: e.target.value }))}
                  className="h-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Típus</Label>
              <Select
                value={editing.segment_type as string}
                onValueChange={v => setEditing(p => ({ ...p, segment_type: v as AttendanceSegmentType }))}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Normál munkaidő</SelectItem>
                  <SelectItem value="overtime">Túlóra</SelectItem>
                  <SelectItem value="break">Szünet / megszakítás</SelectItem>
                  <SelectItem value="oncall_intervention">Készenléti behívás (tényleges munka)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!editing.is_weekend}
                  onCheckedChange={v => setEditing(p => ({ ...p, is_weekend: v }))}
                />
                <Label className="text-xs cursor-pointer">Hétvégi munka</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!editing.is_night}
                  onCheckedChange={v => setEditing(p => ({ ...p, is_night: v }))}
                />
                <Label className="text-xs cursor-pointer">Éjszakai munka</Label>
              </div>
            </div>
            <div>
              <Label className="text-xs">Megjegyzés (opcionális)</Label>
              <Input
                value={editing.note ?? ''}
                onChange={e => setEditing(p => ({ ...p, note: e.target.value }))}
                className="h-8"
                placeholder="Pl. Ügyfél megbeszélés"
              />
            </div>
            {errors.length > 0 && (
              <div className="text-xs text-destructive flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <ul className="space-y-0.5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>Mentés</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing({})}>Mégse</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bezárás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SegmentTypeBadge({ type }: { type: AttendanceSegmentType }) {
  const cfg: Record<AttendanceSegmentType, { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive'; icon?: React.ReactNode }> = {
    regular: { label: 'Normál', variant: 'default', icon: <Briefcase className="h-2.5 w-2.5" /> },
    overtime: { label: 'Túlóra', variant: 'destructive' },
    break: { label: 'Szünet', variant: 'secondary' },
    oncall_intervention: { label: 'Behívás', variant: 'destructive', icon: <Phone className="h-2.5 w-2.5" /> },
  };
  const c = cfg[type];
  return (
    <Badge variant={c.variant} className="text-[10px] gap-1 shrink-0">
      {c.icon}
      {c.label}
    </Badge>
  );
}
