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
      toast.success(`Szinkron kész: +${d.inserted ?? 0} új, ${d.skipped ?? 0} létezett (${d.total ?? 0} összesen)`);
      fetchHolidays();
    } catch (e: any) {
      toast.error(`Szinkron hiba: ${e.message || 'ismeretlen'}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleAutoSync = async (v: boolean) => {
    setAutoSync(v);
    await (supabase as any).from('enterprise_workspaces').update({ holidays_auto_sync: v }).eq('id', workspaceId);
    toast.success(v ? 'Automatikus szinkron bekapcsolva' : 'Automatikus szinkron kikapcsolva');
  };

  const handleAdd = async () => {
    if (!name.trim() || !date) { toast.error('Add meg a nevet és dátumot'); return; }
    const { error } = await supabase.from('enterprise_holidays').insert({
      workspace_id: workspaceId,
      holiday_date: format(date, 'yyyy-MM-dd'),
      name: name.trim(),
      is_recurring: isRecurring,
    });
    if (error) {
      if (error.code === '23505') toast.error('Erre a dátumra már van ünnepnap');
      else toast.error('Hiba');
      return;
    }
    toast.success('Ünnepnap hozzáadva');
    setShowForm(false);
    setName('');
    setDate(undefined);
    setIsRecurring(false);
    fetchHolidays();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('enterprise_holidays').delete().eq('id', id);
    toast.success('Ünnepnap törölve');
    fetchHolidays();
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">Ünnepnapok / munkaszüneti napok</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" /> Hozzáadás</Button>
      </div>

      {/* Auto-sync panel */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs font-medium">Magyar munkaszüneti napok automatikus szinkron</p>
            <p className="text-[10px] text-muted-foreground">Forrás: szunetnapok.hu API · {lastSync ? `Utolsó: ${format(new Date(lastSync), 'yyyy.MM.dd HH:mm')}` : 'Még nem futott'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Auto</Label>
            <Switch checked={autoSync} onCheckedChange={toggleAutoSync} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" min={2000} max={2100} value={syncYear} onChange={e => setSyncYear(parseInt(e.target.value) || new Date().getFullYear())} className="w-24 h-8 text-xs" />
          <Button size="sm" variant="default" onClick={handleSync} disabled={syncing} className="h-8">
            <RefreshCw className={cn('h-3 w-3 mr-1', syncing && 'animate-spin')} /> {syncing ? 'Szinkron...' : 'Szinkronizálás most'}
          </Button>
        </div>
      </div>

      {holidays.length === 0 ? (
        <p className="text-xs text-muted-foreground">Még nincs ünnepnap definiálva.</p>
      ) : (
        <div className="space-y-1">
          {holidays.map(h => (
            <div key={h.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
              <span className="font-medium">{format(new Date(h.holiday_date), 'yyyy.MM.dd', { locale: hu })}</span>
              <span className="text-muted-foreground">—</span>
              <span>{h.name}</span>
              {h.is_recurring && <span className="text-xs text-muted-foreground">(évente ismétlődik)</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => handleDelete(h.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ünnepnap hozzáadása</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Név</Label>
              <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="pl. Nemzeti ünnep" />
            </div>
            <div>
              <Label>Dátum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'yyyy.MM.dd', { locale: hu }) : 'Válassz dátumot'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} locale={hu} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center justify-between">
              <Label>Évente ismétlődik</Label>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Mégse</Button>
            <Button onClick={handleAdd}>Hozzáadás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
