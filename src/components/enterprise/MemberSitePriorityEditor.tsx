import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Trash2, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

interface Office { id: string; name: string; city: string | null }
interface Priority { id?: string; office_id: string; priority: number }

interface Props {
  workspaceId: string;
  membershipId: string;
  isAdmin: boolean;
}

const PRIORITY_TONES: Record<number, string> = {
  1: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  2: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  3: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
};

export function MemberSitePriorityEditor({ workspaceId, membershipId, isAdmin }: Props) {
  const { t } = useI18n();
  const [offices, setOffices] = useState<Office[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newOffice, setNewOffice] = useState<string>('');
  const [newPriority, setNewPriority] = useState<string>('2');

  const load = async () => {
    setLoading(true);
    const [oRes, pRes] = await Promise.all([
      (supabase as any).from('enterprise_offices').select('id,name,city').eq('workspace_id', workspaceId).order('name'),
      (supabase as any).from('enterprise_member_site_priorities').select('id,office_id,priority').eq('workspace_id', workspaceId).eq('membership_id', membershipId),
    ]);
    setOffices((oRes.data || []) as Office[]);
    setPriorities((pRes.data || []) as Priority[]);
    setLoading(false);
  };

  useEffect(() => { if (membershipId) load(); }, [membershipId, workspaceId]);

  const handleAdd = async () => {
    if (!newOffice) { toast.error(t('site_priority_mgr.select_office')); return; }
    if (priorities.some(p => p.office_id === newOffice)) {
      toast.error(t('site_priority_mgr.already_assigned'));
      return;
    }
    const { error } = await (supabase as any).from('enterprise_member_site_priorities').insert({
      workspace_id: workspaceId,
      membership_id: membershipId,
      office_id: newOffice,
      priority: Number(newPriority),
    });
    if (error) { toast.error(t('site_priority_mgr.save_failed', { message: error.message })); return; }
    toast.success(t('site_priority_mgr.assigned'));
    setNewOffice('');
    setNewPriority('2');
    setAdding(false);
    load();
  };

  const handlePriorityChange = async (officeId: string, priority: number) => {
    const { error } = await (supabase as any)
      .from('enterprise_member_site_priorities')
      .update({ priority })
      .eq('workspace_id', workspaceId)
      .eq('membership_id', membershipId)
      .eq('office_id', officeId);
    if (error) { toast.error(t('site_priority_mgr.update_failed')); return; }
    load();
  };

  const handleRemove = async (officeId: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_member_site_priorities')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('membership_id', membershipId)
      .eq('office_id', officeId);
    if (error) { toast.error(t('site_priority_mgr.delete_failed')); return; }
    load();
  };

  const sorted = [...priorities].sort((a, b) => a.priority - b.priority);
  const usedOfficeIds = new Set(priorities.map(p => p.office_id));
  const availableOffices = offices.filter(o => !usedOfficeIds.has(o.id));

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">{t('site_priority_mgr.loading')}</p>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t('site_priority_mgr.empty')}</p>
        ) : (
          <div className="space-y-1.5">
            {sorted.map(p => {
              const office = offices.find(o => o.id === p.office_id);
              const tone = PRIORITY_TONES[p.priority];
              const label = t(`site_priority_mgr.priority_${p.priority}` as any);
              return (
                <div key={p.office_id} className="flex items-center gap-2 p-2 rounded-md border bg-card text-sm">
                  <div className="flex-1 flex items-center gap-2">
                    {p.priority === 1 && <Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />}
                    <span className="font-medium">{office?.name || t('site_priority_mgr.unknown')}</span>
                    {office?.city && <span className="text-[10px] text-muted-foreground">({office.city})</span>}
                  </div>
                  {isAdmin ? (
                    <>
                      <Select value={String(p.priority)} onValueChange={v => handlePriorityChange(p.office_id, Number(v))}>
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 — {t('site_priority_mgr.priority_1')}</SelectItem>
                          <SelectItem value="2">2 — {t('site_priority_mgr.priority_2')}</SelectItem>
                          <SelectItem value="3">3 — {t('site_priority_mgr.priority_3')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(p.office_id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <Badge variant="outline" className={cn('text-[10px]', tone)}>{label}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isAdmin && (
          adding ? (
            <div className="flex items-center gap-2 pt-2 border-t mt-2">
              <Select value={newOffice} onValueChange={setNewOffice}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder={t('site_priority_mgr.select_office')} />
                </SelectTrigger>
                <SelectContent>
                  {availableOffices.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">{t('site_priority_mgr.no_more_offices')}</div>
                  ) : (
                    availableOffices.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name} {o.city ? `(${o.city})` : ''}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — {t('site_priority_mgr.priority_1')}</SelectItem>
                  <SelectItem value="2">2 — {t('site_priority_mgr.priority_2')}</SelectItem>
                  <SelectItem value="3">3 — {t('site_priority_mgr.priority_3')}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAdd} disabled={availableOffices.length === 0}>OK</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewOffice(''); }}>X</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="w-full mt-2" disabled={availableOffices.length === 0}>
              <Plus className="h-3 w-3 mr-1" />
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
