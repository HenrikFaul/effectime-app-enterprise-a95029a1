import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Plus, Trash2, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  userId: string;
}

export function CompanyLeaveDayManager({ workspaceId, userId }: Props) {
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date>();
  const [isRecurring, setIsRecurring] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_company_leave_days')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('leave_date');
    setDays((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [workspaceId]);

  const handleAdd = async () => {
    if (!name.trim() || !date) return;
    const { error } = await supabase.from('enterprise_company_leave_days').insert({
      workspace_id: workspaceId,
      name: name.trim(),
      leave_date: format(date, 'yyyy-MM-dd'),
      is_recurring: isRecurring,
      created_by: userId,
    });
    if (error) { toast.error('Hiba'); return; }
    toast.success('Céges szabadnap hozzáadva');
    setName(''); setDate(undefined); setIsRecurring(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('enterprise_company_leave_days').delete().eq('id', id);
    toast.success('Törölve');
    fetch();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Céges szabadnapok
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          A cég által előírt kötelező szabadnapok. Ezek nem tiltott napok — a dolgozók automatikusan szabadságon vannak.
        </p>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <Input placeholder="Elnevezés (pl. Karácsonyi leállás)" value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-8 text-xs", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {date ? format(date, 'yyyy.MM.dd', { locale: hu }) : 'Dátum'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} locale={hu} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox checked={isRecurring} onCheckedChange={v => setIsRecurring(!!v)} />
            Ismétlődő
          </label>
          <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !date}>
            <Plus className="h-3 w-3 mr-1" /> Hozzáadás
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : days.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Nincs céges szabadnap beállítva.</p>
        ) : (
          <div className="space-y-1">
            {days.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground">{d.leave_date}</span>
                  {d.is_recurring && <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded">Ismétlődő</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
