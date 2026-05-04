import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plug, Trash2, PlugZap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { workspaceId: string; userId: string; }

interface Integration {
  id: string;
  provider: 'jira' | 'azure_devops';
  is_active: boolean;
  base_url: string;
  account_email: string | null;
  project_key: string | null;
  default_issue_type: string | null;
  auto_create_on_approval: boolean;
}

export function IntegrationManager({ workspaceId, userId }: Props) {
  const [items, setItems] = useState<Integration[]>([]);
  const [provider, setProvider] = useState<'jira' | 'azure_devops'>('jira');
  const [form, setForm] = useState({ base_url: '', account_email: '', api_token: '', project_key: '', default_issue_type: 'Task', auto_create_on_approval: false });
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('enterprise_workspace_integrations')
      .select('id, provider, is_active, base_url, account_email, project_key, default_issue_type, auto_create_on_approval')
      .eq('workspace_id', workspaceId);
    setItems((data as Integration[]) || []);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const save = async () => {
    if (!form.base_url || !form.api_token) { toast.error('URL és token kötelező'); return; }
    const { error } = await supabase.from('enterprise_workspace_integrations').upsert({
      workspace_id: workspaceId,
      provider,
      created_by: userId,
      ...form,
    } as any, { onConflict: 'workspace_id,provider' });
    if (error) { toast.error('Mentés sikertelen: ' + error.message); return; }
    toast.success('Integráció mentve');
    setForm({ base_url: '', account_email: '', api_token: '', project_key: '', default_issue_type: 'Task', auto_create_on_approval: false });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Biztos törlöd?')) return;
    await supabase.from('enterprise_workspace_integrations').delete().eq('id', id);
    load();
  };

  const toggleAuto = async (id: string, val: boolean) => {
    await supabase.from('enterprise_workspace_integrations').update({ auto_create_on_approval: val } as any).eq('id', id);
    load();
  };

  const testConnection = async (id: string) => {
    setTestingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'test_connection', integration_id: id },
      });
      if (error) throw error;
      if ((data as any)?.ok) {
        toast.success('Kapcsolat sikeres ✓');
      } else {
        toast.error('Sikertelen: ' + ((data as any)?.error ?? 'ismeretlen hiba'));
      }
    } catch (e: any) {
      toast.error('Hiba: ' + (e?.message ?? String(e)));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" /> Külső integrációk (Jira / Azure DevOps)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between border rounded-md p-2 text-xs">
                <div>
                  <Badge variant={i.is_active ? 'default' : 'outline'} className="mr-2">
                    {i.provider === 'jira' ? 'Jira' : 'Azure DevOps'}
                  </Badge>
                  <span className="font-mono">{i.base_url}</span>
                  {i.project_key && <span className="ml-2 opacity-60">/ {i.project_key}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] flex items-center gap-1">
                    Auto-create
                    <Switch checked={i.auto_create_on_approval} onCheckedChange={(v) => toggleAuto(i.id, v)} />
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testConnection(i.id)}
                    disabled={testingId === i.id}
                    className="h-7 px-2 gap-1 text-[10px]"
                  >
                    {testingId === i.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <PlugZap className="h-3 w-3" />}
                    Teszt
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium">Új integráció hozzáadása</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Szolgáltató</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jira">Jira Cloud</SelectItem>
                  <SelectItem value="azure_devops">Azure DevOps</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{provider === 'jira' ? 'Project key (pl. PROJ)' : 'Project név'}</Label>
              <Input className="h-8" value={form.project_key} onChange={(e) => setForm({ ...form, project_key: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Base URL ({provider === 'jira' ? 'https://yourname.atlassian.net' : 'https://dev.azure.com/yourorg'})</Label>
            <Input className="h-8" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{provider === 'jira' ? 'E-mail' : 'PAT user (opcionális)'}</Label>
              <Input className="h-8" value={form.account_email} onChange={(e) => setForm({ ...form, account_email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">API token / PAT</Label>
              <Input className="h-8" type="password" value={form.api_token} onChange={(e) => setForm({ ...form, api_token: e.target.value })} />
            </div>
          </div>
          <Button size="sm" onClick={save}>Mentés</Button>
          <p className="text-[10px] text-muted-foreground">
            A token titkosítva tárolódik, és csak a backend integrációs függvény olvashatja.
            Auto-create bekapcsolásakor minden jóváhagyott szabadságról automatikusan készül egy issue/work item.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
