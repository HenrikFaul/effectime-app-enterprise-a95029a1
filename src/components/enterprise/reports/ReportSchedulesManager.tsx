import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Mail, Trash2, CalendarClock, Loader2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SavedReport } from './ReportLibrary';

interface Schedule {
  id: string;
  report_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  hour_of_day: number;
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
}

interface Props {
  workspaceId: string;
  userId: string;
  reports: SavedReport[];
}

export function ReportSchedulesManager({ workspaceId, userId, reports }: Props) {
  const { t } = useI18n();
  const DOW = t('export_center.dow').split(',');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Schedule>>({
    frequency: 'weekly',
    day_of_week: 1,
    hour_of_day: 8,
    recipients: [],
    is_active: true,
  });
  const [reportId, setReportId] = useState<string>('');
  const [recipientInput, setRecipientInput] = useState('');

  const fetchSchedules = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_report_schedules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    setSchedules((data as Schedule[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, [workspaceId]);

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t('report_schedules.toast_invalid_email'));
      return;
    }
    if ((form.recipients || []).includes(email)) return;
    setForm({ ...form, recipients: [...(form.recipients || []), email] });
    setRecipientInput('');
  };

  const removeRecipient = (email: string) => {
    setForm({ ...form, recipients: (form.recipients || []).filter(r => r !== email) });
  };

  const handleSave = async () => {
    if (!reportId) return toast.error(t('report_schedules.toast_no_report'));
    if (!form.recipients?.length) return toast.error(t('report_schedules.toast_no_recipients'));

    const payload = {
      workspace_id: workspaceId,
      report_id: reportId,
      created_by: userId,
      frequency: form.frequency,
      day_of_week: form.frequency === 'weekly' ? form.day_of_week : null,
      day_of_month: form.frequency === 'monthly' ? form.day_of_month : null,
      hour_of_day: form.hour_of_day,
      recipients: form.recipients,
      is_active: form.is_active ?? true,
    };

    const { error } = await (supabase as any)
      .from('enterprise_report_schedules')
      .insert(payload);

    if (error) {
      toast.error(t('report_schedules.toast_save_error', { msg: error.message }));
    } else {
      toast.success(t('report_schedules.toast_saved'));
      setOpen(false);
      setForm({ frequency: 'weekly', day_of_week: 1, hour_of_day: 8, recipients: [], is_active: true });
      setReportId('');
      fetchSchedules();
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await (supabase as any).from('enterprise_report_schedules').update({ is_active: active }).eq('id', id);
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('report_schedules.confirm_delete'))) return;
    await (supabase as any).from('enterprise_report_schedules').delete().eq('id', id);
    toast.success(t('report_schedules.toast_deleted'));
    fetchSchedules();
  };

  const reportName = (id: string) => reports.find(r => r.id === id)?.name || t('report_schedules.unknown_report');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" />
            {t('report_schedules.title')}
          </CardTitle>
          <CardDescription>{t('report_schedules.description')}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t('report_schedules.btn_new')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('report_schedules.dialog_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t('report_schedules.label_report')}</Label>
                <Select value={reportId} onValueChange={setReportId}>
                  <SelectTrigger><SelectValue placeholder={t('report_schedules.placeholder_report')} /></SelectTrigger>
                  <SelectContent>
                    {reports.length === 0 && <SelectItem value="__none__" disabled>{t('report_schedules.no_saved_reports')}</SelectItem>}
                    {reports.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t('report_schedules.label_frequency')}</Label>
                  <Select value={form.frequency} onValueChange={(v: any) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('report_schedules.freq_daily')}</SelectItem>
                      <SelectItem value="weekly">{t('report_schedules.freq_weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('report_schedules.freq_monthly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('report_schedules.label_hour')}</Label>
                  <Input type="number" min={0} max={23} value={form.hour_of_day}
                    onChange={(e) => setForm({ ...form, hour_of_day: parseInt(e.target.value) || 8 })} />
                </div>
              </div>
              {form.frequency === 'weekly' && (
                <div>
                  <Label>{t('report_schedules.label_dow')}</Label>
                  <Select value={String(form.day_of_week ?? 1)} onValueChange={(v) => setForm({ ...form, day_of_week: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOW.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.frequency === 'monthly' && (
                <div>
                  <Label>{t('report_schedules.label_dom')}</Label>
                  <Input type="number" min={1} max={28} value={form.day_of_month ?? 1}
                    onChange={(e) => setForm({ ...form, day_of_month: parseInt(e.target.value) || 1 })} />
                </div>
              )}
              <div>
                <Label>{t('report_schedules.label_recipients')}</Label>
                <div className="flex gap-2">
                  <Input placeholder="email@cim.hu" value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }} />
                  <Button type="button" variant="outline" onClick={addRecipient}>+</Button>
                </div>
                {(form.recipients || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(form.recipients || []).map(r => (
                      <Badge key={r} variant="secondary" className="gap-1">
                        {r}
                        <button onClick={() => removeRecipient(r)}><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t('report_schedules.btn_cancel')}</Button>
              <Button onClick={handleSave}>{t('report_schedules.btn_save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('report_schedules.empty')}</p>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{reportName(s.report_id)}</p>
                    {!s.is_active && <Badge variant="outline" className="text-[10px]">{t('report_schedules.badge_paused')}</Badge>}
                    {s.last_run_status === 'error' && <Badge variant="destructive" className="text-[10px] gap-1"><AlertCircle className="h-3 w-3" /> {t('report_schedules.badge_error')}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.frequency === 'daily' && t('report_schedules.schedule_daily', { hour: s.hour_of_day })}
                    {s.frequency === 'weekly' && t('report_schedules.schedule_weekly', { day: DOW[s.day_of_week ?? 1], hour: s.hour_of_day })}
                    {s.frequency === 'monthly' && t('report_schedules.schedule_monthly', { dom: s.day_of_month, hour: s.hour_of_day })}
                    {' · '}<Mail className="inline h-3 w-3" /> {t('report_schedules.recipients_count', { count: s.recipients.length })}
                    {s.last_run_at && ' ' + t('report_schedules.last_run', { date: new Date(s.last_run_at).toLocaleDateString() })}
                  </p>
                  {s.last_run_error && <p className="text-[10px] text-destructive mt-1 truncate">⚠️ {s.last_run_error}</p>}
                </div>
                <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive(s.id, v)} />
                <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
