import { useEffect, useState } from 'react';
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

const DOW = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

export function ReportSchedulesManager({ workspaceId, userId, reports }: Props) {
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
      toast.error('Érvénytelen email cím');
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
    if (!reportId) return toast.error('Válassz egy riportot');
    if (!form.recipients?.length) return toast.error('Adj meg legalább egy címzettet');

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
      toast.error('Mentés sikertelen: ' + error.message);
    } else {
      toast.success('Ütemezés létrehozva');
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
    if (!confirm('Biztosan törlöd ezt az ütemezést?')) return;
    await (supabase as any).from('enterprise_report_schedules').delete().eq('id', id);
    toast.success('Ütemezés törölve');
    fetchSchedules();
  };

  const reportName = (id: string) => reports.find(r => r.id === id)?.name || '— ismeretlen —';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" />
            Ütemezett email riportok
          </CardTitle>
          <CardDescription>Automatikus riportküldés napi, heti vagy havi gyakorisággal</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Új ütemezés</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Új ütemezett riport</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Riport</Label>
                <Select value={reportId} onValueChange={setReportId}>
                  <SelectTrigger><SelectValue placeholder="Válassz egy mentett riportot" /></SelectTrigger>
                  <SelectContent>
                    {reports.length === 0 && <SelectItem value="__none__" disabled>Nincs mentett riport</SelectItem>}
                    {reports.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Gyakoriság</Label>
                  <Select value={form.frequency} onValueChange={(v: any) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Napi</SelectItem>
                      <SelectItem value="weekly">Heti</SelectItem>
                      <SelectItem value="monthly">Havi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Óra (UTC)</Label>
                  <Input type="number" min={0} max={23} value={form.hour_of_day}
                    onChange={(e) => setForm({ ...form, hour_of_day: parseInt(e.target.value) || 8 })} />
                </div>
              </div>
              {form.frequency === 'weekly' && (
                <div>
                  <Label>Nap</Label>
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
                  <Label>Hónap napja (1–28)</Label>
                  <Input type="number" min={1} max={28} value={form.day_of_month ?? 1}
                    onChange={(e) => setForm({ ...form, day_of_month: parseInt(e.target.value) || 1 })} />
                </div>
              )}
              <div>
                <Label>Címzettek</Label>
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
              <Button variant="outline" onClick={() => setOpen(false)}>Mégsem</Button>
              <Button onClick={handleSave}>Mentés</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Még nincs ütemezett riport.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{reportName(s.report_id)}</p>
                    {!s.is_active && <Badge variant="outline" className="text-[10px]">Szünetelve</Badge>}
                    {s.last_run_status === 'error' && <Badge variant="destructive" className="text-[10px] gap-1"><AlertCircle className="h-3 w-3" /> Hiba</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.frequency === 'daily' && `Naponta ${s.hour_of_day}:00 UTC`}
                    {s.frequency === 'weekly' && `${DOW[s.day_of_week ?? 1]} ${s.hour_of_day}:00 UTC`}
                    {s.frequency === 'monthly' && `Minden hónap ${s.day_of_month}. ${s.hour_of_day}:00 UTC`}
                    {' · '}<Mail className="inline h-3 w-3" /> {s.recipients.length} címzett
                    {s.last_run_at && ` · Utolsó futás: ${new Date(s.last_run_at).toLocaleDateString('hu-HU')}`}
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
