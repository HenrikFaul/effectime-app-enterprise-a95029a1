import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
}

export function BlockedDateManager({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const [dates, setDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState<Date>();
  const [reason, setReason] = useState('');

  const fetchDates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_blocked_dates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('blocked_date', { ascending: true });
    setDates((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDates(); }, [workspaceId]);

  const handleAdd = async () => {
    if (!date) { toast.error(t('blocked_date_mgr.date_required')); return; }
    const { error } = await supabase.from('enterprise_blocked_dates').insert({
      workspace_id: workspaceId,
      blocked_date: format(date, 'yyyy-MM-dd'),
      reason: reason.trim() || null,
      created_by: userId,
    });
    if (error) {
      if (error.code === '23505') toast.error(t('blocked_date_mgr.already_blocked'));
      else toast.error(t('blocked_date_mgr.error'));
      return;
    }
    toast.success(t('blocked_date_mgr.added'));
    setShowForm(false);
    setDate(undefined);
    setReason('');
    fetchDates();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('enterprise_blocked_dates').delete().eq('id', id);
    toast.success(t('blocked_date_mgr.deleted'));
    fetchDates();
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('blocked_date_mgr.title')}</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" /> {t('blocked_date_mgr.btn_add')}</Button>
      </div>

      {dates.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('blocked_date_mgr.empty')}</p>
      ) : (
        <div className="space-y-1">
          {dates.map(d => (
            <div key={d.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
              <span className="font-medium text-destructive">{format(new Date(d.blocked_date), 'yyyy.MM.dd', { locale: hu })}</span>
              {d.reason && <span className="text-muted-foreground text-xs truncate">— {d.reason}</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => handleDelete(d.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('blocked_date_mgr.dialog_title')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('blocked_date_mgr.label_date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'yyyy.MM.dd', { locale: hu }) : t('blocked_date_mgr.pick_date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} locale={hu} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>{t('blocked_date_mgr.label_reason')}</Label>
              <Textarea className="mt-1" value={reason} onChange={e => setReason(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('blocked_date_mgr.btn_cancel')}</Button>
            <Button onClick={handleAdd}>{t('blocked_date_mgr.btn_add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
