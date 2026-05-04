import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    if (!name.trim()) { toast.error('Adj meg nevet'); return; }
    if (editing) {
      const { error } = await (supabase as any).from('enterprise_allowances').update({ name: name.trim(), unit, ignore_limit: ignoreLimit }).eq('id', editing.id);
      if (error) return toast.error('Mentési hiba');
      toast.success('Frissítve');
    } else {
      const { error } = await (supabase as any).from('enterprise_allowances').insert({ workspace_id: workspaceId, name: name.trim(), unit, ignore_limit: ignoreLimit, sort_order: items.length });
      if (error) return toast.error('Létrehozási hiba');
      toast.success('Létrehozva');
    }
    setOpen(false); load();
  };

  const toggleArchive = async (a: Allowance) => {
    await (supabase as any).from('enterprise_allowances').update({ is_archived: !a.is_archived }).eq('id', a.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Biztosan törlöd? Ez nem visszavonható.')) return;
    const { error } = await (supabase as any).from('enterprise_allowances').delete().eq('id', id);
    if (error) return toast.error('Törlési hiba');
    toast.success('Törölve'); load();
  };

  const visible = items.filter(i => showArchived ? i.is_archived : !i.is_archived);

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Kvóta-poolok (Allowances)</h3>
          <Badge variant="outline" className="text-[10px] cursor-pointer" onClick={() => setShowArchived(s => !s)}>
            {showArchived ? 'Archivált' : 'Aktív'}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}><Plus className="h-3 w-3 mr-1" /> Új pool</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Kvóta-poolokat itt definiálhatsz workspace szinten (pl. Éves szabadság, Túlóra). A típusokhoz külön rendelhetők.</p>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">{showArchived ? 'Nincs archivált pool.' : 'Még nincs definiált pool.'}</p>
      ) : (
        <div className="space-y-1">
          {visible.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
              <span className="font-medium">{a.name}</span>
              <Badge variant="secondary" className="text-[10px] h-4">{a.unit === 'days' ? 'Nap' : 'Óra'}</Badge>
              {a.ignore_limit && <Badge variant="outline" className="text-[10px] h-4">Korlátozás nélkül</Badge>}
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
          <DialogHeader><DialogTitle>{editing ? 'Pool szerkesztése' : 'Új kvóta-pool'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Név</Label>
              <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="pl. Éves szabadság, Túlóra" />
            </div>
            <div>
              <Label>Egység</Label>
              <Select value={unit} onValueChange={(v: 'days' | 'hours') => setUnit(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Nap</SelectItem>
                  <SelectItem value="hours">Óra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Korlátozás figyelmen kívül hagyása</Label>
              <Switch checked={ignoreLimit} onCheckedChange={setIgnoreLimit} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Mégse</Button>
            <Button onClick={save}>{editing ? 'Mentés' : 'Létrehozás'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
