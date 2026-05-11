import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { toast } from 'sonner';

interface Props { workspaceId: string }

interface Allowance {
  id: string;
  name: string;
  unit: 'days' | 'hours';
  ignore_limit: boolean;
  is_archived: boolean;
  sort_order: number;
}

export function AllowanceManager({ workspaceId }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Allowance | null>(null);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'days' | 'hours'>('days');
  const [ignoreLimit, setIgnoreLimit] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_allowances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true });
    setItems((data as Allowance[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const openCreate = () => { setEditing(null); setName(''); setUnit('days'); setIgnoreLimit(false); setOpen(true); };
  const openEdit = (a: Allowance) => { setEditing(a); setName(a.name); setUnit(a.unit); setIgnoreLimit(a.ignore_limit); setOpen(true); };

  const save = async () => {
    if (!name.trim()) { toast.error(t('allowance_mgr.name_required')); return; }
    if (editing) {
      const { error } = await (supabase as any).from('enterprise_allowances').update({ name: name.trim(), unit, ignore_limit: ignoreLimit }).eq('id', editing.id);
      if (error) return toast.error(t('allowance_mgr.save_failed'));
      toast.success(t('allowance_mgr.updated'));
    } else {
      const { error } = await (supabase as any).from('enterprise_allowances').insert({ workspace_id: workspaceId, name: name.trim(), unit, ignore_limit: ignoreLimit, sort_order: items.length });
      if (error) return toast.error(t('allowance_mgr.create_failed'));
      toast.success(t('allowance_mgr.created'));
    }
    setOpen(false); load();
  };

  const toggleArchive = async (a: Allowance) => {
    await (supabase as any).from('enterprise_allowances').update({ is_archived: !a.is_archived }).eq('id', a.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t('allowance_mgr.confirm_delete'))) return;
    const { error } = await (supabase as any).from('enterprise_allowances').delete().eq('id', id);
    if (error) return toast.error(t('allowance_mgr.delete_failed'));
    toast.success(t('allowance_mgr.deleted')); load();
  };

  const visible = items.filter(i => showArchived ? i.is_archived : !i.is_archived);

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t('allowance_mgr.title')}</h3>
          <Badge variant="outline" className="text-[10px] cursor-pointer" onClick={() => setShowArchived(s => !s)}>
            {showArchived ? t('allowance_mgr.badge_archived') : t('allowance_mgr.badge_active')}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}><Plus className="h-3 w-3 mr-1" /> {t('allowance_mgr.btn_new')}</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t('allowance_mgr.description')}</p>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">{showArchived ? t('allowance_mgr.empty_archived') : t('allowance_mgr.empty_active')}</p>
      ) : (
        <div className="space-y-1">
          {visible.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
              <span className="font-medium">{a.name}</span>
              <Badge variant="secondary" className="text-[10px] h-4">{a.unit === 'days' ? t('allowance_mgr.unit_days') : t('allowance_mgr.unit_hours')}</Badge>
              {a.ignore_limit && <Badge variant="outline" className="text-[10px] h-4">{t('allowance_mgr.no_limit')}</Badge>}
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleArchive(a)}>
                  {a.is_archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(a.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editing ? t('allowance_mgr.dialog_edit_title') : t('allowance_mgr.dialog_create_title')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('allowance_mgr.label_name')}</Label>
              <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder={t('allowance_mgr.name_placeholder')} />
            </div>
            <div>
              <Label>{t('allowance_mgr.label_unit')}</Label>
              <Select value={unit} onValueChange={(v: 'days' | 'hours') => setUnit(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">{t('allowance_mgr.unit_days')}</SelectItem>
                  <SelectItem value="hours">{t('allowance_mgr.unit_hours')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('allowance_mgr.label_ignore_limit')}</Label>
              <Switch checked={ignoreLimit} onCheckedChange={setIgnoreLimit} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('allowance_mgr.btn_cancel')}</Button>
            <Button onClick={save}>{editing ? t('allowance_mgr.btn_save') : t('allowance_mgr.btn_create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
