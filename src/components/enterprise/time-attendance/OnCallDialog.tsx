import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { upsertOnCallWindow } from './api';
import { format, lastDayOfMonth } from 'date-fns';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodId: string;
  year: number;
  month: number;
  onSaved: () => void;
}

export function OnCallDialog({ open, onOpenChange, periodId, year, month, onSaved }: Props) {
  const { t } = useI18n();
  const monthStart = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const monthEnd = format(lastDayOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

  const [startsAt, setStartsAt] = useState(`${monthStart}T08:00`);
  const [endsAt, setEndsAt] = useState(`${monthStart}T20:00`);
  const [isWeekend, setIsWeekend] = useState(true);
  const [isNight, setIsNight] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (new Date(endsAt) <= new Date(startsAt)) {
      toast.error(t('oncall.error_time_order'));
      return;
    }
    setSaving(true);
    try {
      await upsertOnCallWindow({
        period_id: periodId,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        is_weekend: isWeekend,
        is_night: isNight,
        note: note || null,
      });
      toast.success(t('oncall.saved'));
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || t('oncall.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('oncall.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t('oncall.description')}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('oncall.start')}</Label>
              <Input
                type="datetime-local" min={`${monthStart}T00:00`} max={`${monthEnd}T23:59`}
                value={startsAt} onChange={e => setStartsAt(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">{t('oncall.end')}</Label>
              <Input
                type="datetime-local" min={`${monthStart}T00:00`} max={`${monthEnd}T23:59`}
                value={endsAt} onChange={e => setEndsAt(e.target.value)} className="h-8" />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={isWeekend} onCheckedChange={setIsWeekend} />
              <Label className="text-xs cursor-pointer">{t('oncall.weekend')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isNight} onCheckedChange={setIsNight} />
              <Label className="text-xs cursor-pointer">{t('oncall.night')}</Label>
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('oncall.note')}</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} className="h-8" placeholder={t('oncall.note_placeholder')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
