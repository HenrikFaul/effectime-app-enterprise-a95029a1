import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Trash2, MapPin, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Office {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  workspace_id: string;
}

interface Props {
  workspaceId: string;
}

export function OfficeManager({ workspaceId }: Props) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', city: '' });
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const fetchOffices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_offices')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name');
    setOffices((data as Office[]) || []);

    // Count members per office
    const { data: members } = await supabase
      .from('enterprise_memberships')
      .select('office_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .not('office_id', 'is', null);

    const counts: Record<string, number> = {};
    (members || []).forEach((m: any) => {
      counts[m.office_id] = (counts[m.office_id] || 0) + 1;
    });
    setMemberCounts(counts);
    setLoading(false);
  };

  useEffect(() => { fetchOffices(); }, [workspaceId]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    const { error } = await supabase.from('enterprise_offices').insert({
      workspace_id: workspaceId,
      name: form.name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
    } as any);
    if (error) {
      toast.error('Hiba az iroda hozzáadásakor');
    } else {
      toast.success('Iroda hozzáadva');
      setForm({ name: '', address: '', city: '' });
      setShowAdd(false);
      fetchOffices();
    }
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from('enterprise_offices').update({
      name: form.name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
    } as any).eq('id', id);
    if (error) {
      toast.error('Hiba a mentéskor');
    } else {
      toast.success('Iroda frissítve');
      setEditingId(null);
      fetchOffices();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('enterprise_offices').delete().eq('id', id);
    if (error) {
      toast.error('Hiba a törléskor');
    } else {
      toast.success('Iroda törölve');
      fetchOffices();
    }
  };

  const startEdit = (office: Office) => {
    setEditingId(office.id);
    setForm({ name: office.name, address: office.address || '', city: office.city || '' });
  };

  if (loading) {
    return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Telephelyek / Irodák</span>
          <Button size="sm" variant="outline" onClick={() => { setShowAdd(true); setForm({ name: '', address: '', city: '' }); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Új iroda
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {showAdd && (
          <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Név *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Központi iroda" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Város</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Budapest" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Cím</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Kossuth tér 1." className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Mégse</Button>
              <Button size="sm" onClick={handleAdd} disabled={!form.name.trim()}>Hozzáadás</Button>
            </div>
          </div>
        )}

        {offices.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground text-center py-4">Még nincsenek irodák megadva.</p>
        )}

        {offices.map(office => (
          <div key={office.id} className="flex items-center justify-between border rounded-md p-2.5">
            {editingId === office.id ? (
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
                  <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="h-8 text-sm" />
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="flex gap-1 justify-end">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(office.id)}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{office.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {office.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{office.city}</span>}
                      {office.address && <span>{office.address}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{memberCounts[office.id] || 0} fő</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(office)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(office.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
