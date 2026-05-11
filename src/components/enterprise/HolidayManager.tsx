import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
  is_recurring: boolean;
}

export function HolidayManager({ workspaceId }: Props) {
  const { t } = useI18n();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date>();
  const [isRecurring, setIsRecurring] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncYear, setSyncYear] = useState(new Date().getFullYear());

  const fetchHolidays = async () => {
    setLoading(true);
    const [{ data }, { data: ws }] = await Promise.all([
      supabase.from('enterprise_holidays').select('*').eq('workspace_id', workspaceId).order('holiday_date', { ascending: true }),
      (supabase as any).from('enterprise_workspaces').select('holidays_last_sync_at,holidays_auto_sync').eq('id', workspaceId).maybeSingle(),
    ]);
    setHolidays((data as any[]) || []);
    setAutoSync(Boolean(ws?.holidays_auto_sync));
    setLastSync(ws?.holidays_last_sync_at || null);
    setLoading(false);
  };

  useEffect(() => { fetchHolidays(); }, [workspaceId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-holidays', {
        body: { workspace_id: workspaceId, year: syncYear },
      });
      if (error) throw error;
      const d = data as { inserted?: number; skipped?: number; total?: number };
      toast.success(t('holiday_mgr.sync_done').replace('{{inserted}}', String(d.inserted ?? 0)).replace('{{skipped}}', String(d.skipped ?? 0)).replace('{{total}}', String(d.total ?? 0)));
      fetchHolidays();
    } catch (e: any) {
      toast.error(t('holiday_mgr.sync_error').replace('{{message}}', e.message || t('holiday_mgr.sync_error_unknown')));
    } finally {
      setSyncing(false);
    }
  };

  const toggleAutoSync = async (v: boolean) => {
    setAutoSync(v);
    await (supabase as any).from('enterprise_workspaces').update({ holidays_auto_sync: v }).eq('id', workspaceId);
    toast.success(v ? t('holiday_mgr.auto_sync_on') : t('holiday_mgr.auto_sync_off'));
  };

  const handleAdd = async () => {
    if (!name.trim() || !date) { toast.error(t('holiday_mgr.error_name_date')); return; }
    const { error } = await supabase.from('enterprise_holidays').insert({
      workspace_id: workspaceId,
      holiday_date: format(date, 'yyyy-MM-dd'),
      name: name.trim(),
      is_recurring: isRecurring,
    });
    if (error) {
      if (error.code === '23505') toast.error(t('holiday_mgr.error_duplicate_date'));
      else toast.error(t('holiday_mgr.error_generic'));
      return;
    }
    toast.success(t('holiday_mgr.added'));
    setShowForm(false);
    setName('');
    setDate(undefined);
    setIsRecurring(false);
    fetchHolidays();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('enterprise_holidays').delete().eq('id', id);
    toast.success(t('holiday_mgr.deleted'));
    fetchHolidays();
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">{t('holiday_mgr.title')}</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" /> {t('holiday_mgr.btn_add')}</Button>
      </div>

      {/* Auto-sync panel */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs font-medium">{t('holiday_mgr.auto_sync_label')}</p>
            <p className="text-[10px] text-muted-foreground">{t('holiday_mgr.source_label')} · {lastSync ? t('holiday_mgr.last_sync').replace('{{date}}', format(new Date(lastSync), 'yyyy.MM.dd HH:mm')) : t('holiday_mgr.never_synced')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">{t('holiday_mgr.auto_label')}</Label>
            <Switch checked={autoSync} onCheckedChange={toggleAutoSync} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" min={2000} max={2100} value={syncYear} onChange={e => setSyncYear(parseInt(e.target.value) || new Date().getFullYear())} className="w-24 h-8 text-xs" />
          <Button size="sm" variant="default" onClick={handleSync} disabled={syncing} className="h-8">
            <RefreshCw className={cn('h-3 w-3 mr-1', syncing && 'animate-spin')} /> {syncing ? t('holiday_mgr.syncing') : t('holiday_mgr.sync_now')}
          </Button>
        </div>
      </div>

      {holidays.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('holiday_mgr.empty')}</p>
      ) : (
        <div className="space-y-1">
          {holidays.map(h => (
            <div key={h.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
              <span className="font-medium">{format(new Date(h.holiday_date), 'yyyy.MM.dd', { locale: hu })}</span>
              <span className="text-muted-foreground">—</span>
              <span>{h.name}</span>
              {h.is_recurring && <span className="text-xs text-muted-foreground">{t('holiday_mgr.recurring')}</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => handleDelete(h.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('holiday_mgr.dialog_title')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('holiday_mgr.field_name')}</Label>
              <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder={t('holiday_mgr.field_name_placeholder')} />
            </div>
            <div>
              <Label>{t('holiday_mgr.field_date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'yyyy.MM.dd', { locale: hu }) : t('holiday_mgr.pick_date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} locale={hu} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('holiday_mgr.recurring_label')}</Label>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('holiday_mgr.btn_cancel')}</Button>
            <Button onClick={handleAdd}>{t('holiday_mgr.btn_add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
