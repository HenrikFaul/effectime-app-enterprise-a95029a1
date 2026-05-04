import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowDown, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Props {
  workspaceId: string;
}

const ROLE_OPTIONS = [
  { value: 'resourceAssistant', label: 'Erőforrás asszisztens' },
  { value: 'owner', label: 'Tulajdonos' },
];

export function ApprovalChainManager({ workspaceId }: Props) {
  const [chains, setChains] = useState<any[]>([]);
  const [escalation, setEscalation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Escalation form
  const [escHours, setEscHours] = useState('48');
  const [escRole, setEscRole] = useState('owner');
  const [escNotify, setEscNotify] = useState(true);
  const [escActive, setEscActive] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [chainsRes, escRes] = await Promise.all([
      supabase.from('enterprise_approval_chains').select('*').eq('workspace_id', workspaceId).order('step_order'),
      supabase.from('enterprise_escalation_rules').select('*').eq('workspace_id', workspaceId).limit(1),
    ]);
    setChains((chainsRes.data as any[]) || []);
    const esc = (escRes.data as any[])?.[0] || null;
    setEscalation(esc);
    if (esc) {
      setEscHours(String(esc.escalate_after_hours));
      setEscRole(esc.escalate_to_role);
      setEscNotify(esc.notify_owner);
      setEscActive(esc.is_active);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const addStep = async () => {
    const nextOrder = chains.length > 0 ? Math.max(...chains.map(c => c.step_order)) + 1 : 1;
    const { error } = await supabase.from('enterprise_approval_chains').insert({
      workspace_id: workspaceId,
      step_order: nextOrder,
      approver_role: 'resourceAssistant' as any,
    });
    if (error) { toast.error('Hiba'); return; }
    toast.success('Jóváhagyási lépés hozzáadva');
    fetchData();
  };

  const updateStep = async (id: string, role: string) => {
    await supabase.from('enterprise_approval_chains').update({ approver_role: role as any }).eq('id', id);
    fetchData();
  };

  const deleteStep = async (id: string) => {
    await supabase.from('enterprise_approval_chains').delete().eq('id', id);
    toast.success('Lépés törölve');
    fetchData();
  };

  const saveEscalation = async () => {
    const payload = {
      workspace_id: workspaceId,
      escalate_after_hours: parseInt(escHours) || 48,
      escalate_to_role: escRole as any,
      notify_owner: escNotify,
      is_active: escActive,
    };

    if (escalation) {
      await supabase.from('enterprise_escalation_rules').update(payload).eq('id', escalation.id);
    } else {
      await supabase.from('enterprise_escalation_rules').insert(payload);
    }
    toast.success('Eszkaláció beállítások mentve');
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      {/* Approval chain */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Jóváhagyási lánc</h3>
          <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3 w-3 mr-1" /> Lépés</Button>
        </div>

        {chains.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nincs jóváhagyási lánc — az alapértelmezett egylépcsős jóváhagyás érvényes (owner vagy resourceAssistant).</p>
        ) : (
          <div className="space-y-2">
            {chains.map((c, i) => (
              <div key={c.id}>
                <div className="flex items-center gap-2 p-2 rounded-md border text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">{c.step_order}. lépés</Badge>
                  <Select value={c.approver_role} onValueChange={(v) => updateStep(c.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => deleteStep(c.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                {i < chains.length - 1 && (
                  <div className="flex justify-center py-1"><ArrowDown className="h-3 w-3 text-muted-foreground" /></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Escalation rules */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" /> Eszkaláció
        </h3>

        <div className="space-y-3 p-3 rounded-md border">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Aktív</Label>
            <Switch checked={escActive} onCheckedChange={setEscActive} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Eszkaláció ennyi óra után</Label>
              <Input className="mt-1 h-8 text-xs" type="number" min="1" value={escHours} onChange={e => setEscHours(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Eszkaláció célszerepkör</Label>
              <Select value={escRole} onValueChange={setEscRole}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Tulajdonos értesítése</Label>
            <Switch checked={escNotify} onCheckedChange={setEscNotify} />
          </div>
          <Button size="sm" onClick={saveEscalation} className="w-full text-xs">Mentés</Button>
        </div>
      </div>
    </div>
  );
}
