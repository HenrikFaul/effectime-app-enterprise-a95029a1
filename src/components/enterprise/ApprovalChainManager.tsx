import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

export function ApprovalChainManager({ workspaceId }: Props) {
  const { t } = useI18n();
  const [chains, setChains] = useState<any[]>([]);
  const [escalation, setEscalation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [escHours, setEscHours] = useState('48');
  const [escRole, setEscRole] = useState('owner');
  const [escNotify, setEscNotify] = useState(true);
  const [escActive, setEscActive] = useState(true);

  const roleOptions = [
    { value: 'resourceAssistant', label: t('approval_chain_mgr.role_resource_assistant') },
    { value: 'owner', label: t('approval_chain_mgr.role_owner') },
  ];

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
    if (error) { toast.error(t('approval_chain_mgr.step_add_failed')); return; }
    toast.success(t('approval_chain_mgr.step_added'));
    fetchData();
  };

  const updateStep = async (id: string, role: string) => {
    await supabase.from('enterprise_approval_chains').update({ approver_role: role as any }).eq('id', id);
    fetchData();
  };

  const deleteStep = async (id: string) => {
    await supabase.from('enterprise_approval_chains').delete().eq('id', id);
    toast.success(t('approval_chain_mgr.step_deleted'));
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
    toast.success(t('approval_chain_mgr.escalation_saved'));
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('approval_chain_mgr.title')}</h3>
          <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3 w-3 mr-1" /></Button>
        </div>

        {chains.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('approval_chain_mgr.empty')}</p>
        ) : (
          <div className="space-y-2">
            {chains.map((c, i) => (
              <div key={c.id}>
                <div className="flex items-center gap-2 p-2 rounded-md border text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">{c.step_order}.</Badge>
                  <Select value={c.approver_role} onValueChange={(v) => updateStep(c.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" />
        </h3>

        <div className="space-y-3 p-3 rounded-md border">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('approval_chain_mgr.label_active')}</Label>
            <Switch checked={escActive} onCheckedChange={setEscActive} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('approval_chain_mgr.label_escalation_hours')}</Label>
              <Input className="mt-1 h-8 text-xs" type="number" min="1" value={escHours} onChange={e => setEscHours(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('approval_chain_mgr.label_escalation_role')}</Label>
              <Select value={escRole} onValueChange={setEscRole}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('approval_chain_mgr.label_notify_owner')}</Label>
            <Switch checked={escNotify} onCheckedChange={setEscNotify} />
          </div>
          <Button size="sm" onClick={saveEscalation} className="w-full text-xs">{t('approval_chain_mgr.btn_save')}</Button>
        </div>
      </div>
    </div>
  );
}
