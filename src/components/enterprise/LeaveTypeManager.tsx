import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Props {
  workspaceId: string;
}

interface LeaveType {
  id: string;
  name: string;
  color: string;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
  sort_order: number;
  is_private?: boolean;
  allowance_id?: string | null;
  icon?: string | null;
}

interface Allowance { id: string; name: string }

export function LeaveTypeManager({ workspaceId }: Props) {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isPaid, setIsPaid] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowanceId, setAllowanceId] = useState<string>('none');
  const [icon, setIcon] = useState('');

  const fetch = async () => {
    setLoading(true);
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from('enterprise_leave_types').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
      (supabase as any).from('enterprise_allowances').select('id,name').eq('workspace_id', workspaceId).eq('is_archived', false),
    ]);
    setTypes((t as any[]) || []);
    setAllowances((a as Allowance[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [workspaceId]);

  const openCreate = () => {
    setEditing(null);
    setName(''); setColor('#3b82f6'); setIsPaid(true); setRequiresApproval(true);
    setIsPrivate(false); setAllowanceId('none'); setIcon('');
    setShowForm(true);
  };

  const openEdit = (t: LeaveType) => {
    setEditing(t);
    setName(t.name); setColor(t.color); setIsPaid(t.is_paid); setRequiresApproval(t.requires_approval);
    setIsPrivate(!!t.is_private); setAllowanceId(t.allowance_id || 'none'); setIcon(t.icon || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Add meg a típus nevét'); return; }
    const payload: any = {
      name: name.trim(), color, is_paid: isPaid, requires_approval: requiresApproval,
      is_private: isPrivate, allowance_id: allowanceId === 'none' ? null : allowanceId, icon: icon || null,
    };

    if (editing) {
      const { error } = await (supabase as any).from('enterprise_leave_types').update(payload).eq('id', editing.id);
      if (error) { toast.error('Hiba a mentéskor'); return; }
      toast.success('Típus frissítve');
    } else {
      const { error } = await (supabase as any).from('enterprise_leave_types')
        .insert({ workspace_id: workspaceId, ...payload, sort_order: types.length });
      if (error) {
        if (error.code === '23505') toast.error('Ilyen nevű típus már létezik');
        else toast.error('Hiba a létrehozáskor');
        return;
      }
      toast.success('Típus létrehozva');
    }
    setShowForm(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('enterprise_leave_types').delete().eq('id', id);
    if (error) { toast.error('Hiba a törléskor'); return; }
    toast.success('Típus törölve');
    fetch();
  };

  const toggleActive = async (t: LeaveType) => {
    await supabase.from('enterprise_leave_types').update({ is_active: !t.is_active }).eq('id', t.id);
    fetch();
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Szabadság típusok</h3>
        <Button size="sm" variant="outline" onClick={openCreate}><Plus className="h-3 w-3 mr-1" /> Új típus</Button>
      </div>

      {types.length === 0 ? (
        <p className="text-xs text-muted-foreground">Még nincs egyedi típus definiálva. Az alapértelmezett típusok (Szabadság, Betegszabadság, Fizetés nélküli, Egyéb) automatikusan elérhetők.</p>
      ) : (
        <div className="space-y-1">
          {types.map(t => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <span className={t.is_active ? '' : 'line-through text-muted-foreground'}>{t.name}</span>
              {t.is_paid && <Badge variant="outline" className="text-[10px] h-4">Fizetett</Badge>}
              {t.requires_approval && <Badge variant="secondary" className="text-[10px] h-4">Jóváhagyás</Badge>}
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleActive(t)}>
                  <Switch checked={t.is_active} className="scale-75" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(t)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Típus szerkesztése' : 'Új szabadság típus'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[60px_1fr] gap-2">
              <div>
                <Label className="text-xs">Ikon</Label>
                <Input className="mt-1 text-center" value={icon} onChange={e => setIcon(e.target.value)} placeholder="🌞" maxLength={4} />
              </div>
              <div>
                <Label>Név</Label>
                <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="pl. Tanulmányi szabadság" />
              </div>
            </div>
            <div>
              <Label>Szín</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
                <Input value={color} onChange={e => setColor(e.target.value)} className="w-24 text-xs" />
              </div>
            </div>
            <div>
              <Label>Levonás kvóta-poolból</Label>
              <select className="w-full mt-1 rounded-md border bg-background px-2 py-1.5 text-sm" value={allowanceId} onChange={e => setAllowanceId(e.target.value)}>
                <option value="none">Nincs (nem von le)</option>
                {allowances.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Fizetett szabadság</Label>
              <Switch checked={isPaid} onCheckedChange={setIsPaid} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Jóváhagyás szükséges</Label>
              <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Privát (csak jóváhagyók látják az indokot)</Label>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Mégse</Button>
            <Button onClick={handleSave}>{editing ? 'Mentés' : 'Létrehozás'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
