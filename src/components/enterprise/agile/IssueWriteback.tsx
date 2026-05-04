import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, PlusCircle, Pencil, Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  project_key: string | null;
}

export function IssueWriteback({ integration, userId }: { integration: IntegrationMini; userId: string }) {
  const [busy, setBusy] = useState(false);
  
  const [createForm, setCreateForm] = useState({
    summary: '', 
    description: '', 
    issue_type: 'Task', 
    assignee_email: '', 
    labels: '',
    iteration_path: '', 
    original_estimate_hours: '',
  });

  const [configLoading, setConfigLoading] = useState(false);
  const [issueTypeOptions, setIssueTypeOptions] = useState<string[]>([]);
  const [labelOptions, setLabelOptions] = useState<string[]>([]);

  const [updateForm, setUpdateForm] = useState({
    key: '', 
    summary: '', 
    assignee_email: '', 
    status: '', 
    iteration_path: '',
  });



  const loadProjectConfigFromDb = async () => {
    const { data } = await supabase
      .from('enterprise_agile_field_metadata')
      .select('field_id,field_name,field_type,schema')
      .eq('integration_id', integration.id);
    const rows = (data ?? []) as any[];
    const issueTypes = rows.filter((r) => r.field_type === 'issuetype').map((r) => r.field_name).filter(Boolean);
    const labels = rows.find((r) => r.field_id === 'jira.labels')?.schema?.options ?? [];
    setIssueTypeOptions(issueTypes);
    setLabelOptions(Array.isArray(labels) ? labels : []);
    if (issueTypes.length && !issueTypes.includes(createForm.issue_type)) {
      setCreateForm((prev) => ({ ...prev, issue_type: issueTypes[0] }));
    }
  };

  const syncProjectConfig = async () => {
    setConfigLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'sync_project_config', integration_id: integration.id },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? 'Hibás válasz');
      await loadProjectConfigFromDb();
      toast.success(`Projekt konfiguráció mentve (${(data as any).count} elem)`);
    } catch (e: any) {
      toast.error('Konfiguráció szinkron hiba: ' + (e?.message ?? String(e)));
    } finally {
      setConfigLoading(false);
    }
  };

  const create = async () => {
    if (!createForm.summary) { toast.error('Cím (summary) kötelező'); return; }
    setBusy(true);
    try {
      const params: any = {
        summary: createForm.summary,
        description: createForm.description || undefined,
        issue_type: createForm.issue_type,
        labels: createForm.labels ? createForm.labels.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      };
      if (integration.provider === 'azure_devops') {
        params.assignee_email = createForm.assignee_email || undefined;
        params.iteration_path = createForm.iteration_path || undefined;
        if (createForm.original_estimate_hours) params.original_estimate_hours = Number(createForm.original_estimate_hours);
      }
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'create_issue', integration_id: integration.id, params },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? 'Hibás válasz');
      toast.success('Ticket létrehozva ✓');
      setCreateForm({ summary: '', description: '', issue_type: 'Task', assignee_email: '', labels: '', iteration_path: '', original_estimate_hours: '' });
    } catch (e: any) {
      toast.error('Hiba: ' + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  const update = async () => {
    if (!updateForm.key) { toast.error('Issue key/id kötelező'); return; }
    setBusy(true);
    try {
      const params: any = { key: updateForm.key };
      if (updateForm.summary) params.summary = updateForm.summary;
      if (updateForm.assignee_email) params.assignee_email = updateForm.assignee_email;
      if (updateForm.status) params.status = updateForm.status;
      if (updateForm.iteration_path) params.iteration_path = updateForm.iteration_path;
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'update_issue', integration_id: integration.id, params },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? 'Hibás válasz');
      toast.success('Ticket frissítve ✓');
    } catch (e: any) {
      toast.error('Hiba: ' + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadProjectConfigFromDb();
  }, [integration.id]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Issue írás (write-back)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {integration.provider === 'jira' && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={syncProjectConfig} disabled={configLoading || busy} className="gap-1">
              {configLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
              Jira projekt konfiguráció szinkron
            </Button>
            <Button size="sm" variant="ghost" onClick={loadProjectConfigFromDb} disabled={configLoading || busy} className="gap-1">
              <RefreshCw className="h-3 w-3" /> Betöltés DB-ből
            </Button>
          </div>
        )}
        <Tabs defaultValue="create">
          <TabsList>
            <TabsTrigger value="create" className="gap-1"><PlusCircle className="h-3 w-3" /> Új ticket</TabsTrigger>
            <TabsTrigger value="update" className="gap-1"><Pencil className="h-3 w-3" /> Frissítés</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs">Cím (summary) *</Label>
              <Input className="h-8 text-xs" value={createForm.summary} onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Leírás</Label>
              <Textarea rows={3} className="text-xs" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Típus</Label>
                {integration.provider === 'jira' && issueTypeOptions.length > 0 ? (
                  <select className="h-8 w-full rounded-md border bg-background px-2 text-xs" value={createForm.issue_type} onChange={(e) => setCreateForm({ ...createForm, issue_type: e.target.value })}>
                    {issueTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <Input className="h-8 text-xs" value={createForm.issue_type} onChange={(e) => setCreateForm({ ...createForm, issue_type: e.target.value })} />
                )}
              </div>
              <div>
                <Label className="text-xs">Címkék (vesszővel)</Label>
                <Input list="jira-label-options" className="h-8 text-xs" value={createForm.labels} onChange={(e) => setCreateForm({ ...createForm, labels: e.target.value })} />
              </div>
            </div>
            {integration.provider === 'jira' && labelOptions.length > 0 && (
              <datalist id="jira-label-options">
                {labelOptions.map((label) => <option key={label} value={label} />)}
              </datalist>
            )}
            {integration.provider === 'azure_devops' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Felelős e-mail</Label>
                  <Input className="h-8 text-xs" value={createForm.assignee_email} onChange={(e) => setCreateForm({ ...createForm, assignee_email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Iteration path</Label>
                  <Input className="h-8 text-xs" value={createForm.iteration_path} onChange={(e) => setCreateForm({ ...createForm, iteration_path: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Eredeti becslés (óra)</Label>
                  <Input className="h-8 text-xs" type="number" value={createForm.original_estimate_hours} onChange={(e) => setCreateForm({ ...createForm, original_estimate_hours: e.target.value })} />
                </div>
              </div>
            )}
            <Button size="sm" onClick={create} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
              Létrehozás
            </Button>
          </TabsContent>

          <TabsContent value="update" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs">Issue kulcs / Work item ID *</Label>
              <Input className="h-8 text-xs font-mono" value={updateForm.key} onChange={(e) => setUpdateForm({ ...updateForm, key: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Új cím (üres = változatlan)</Label>
              <Input className="h-8 text-xs" value={updateForm.summary} onChange={(e) => setUpdateForm({ ...updateForm, summary: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Új felelős e-mail</Label>
                <Input className="h-8 text-xs" value={updateForm.assignee_email} onChange={(e) => setUpdateForm({ ...updateForm, assignee_email: e.target.value })} />
              </div>
              {integration.provider === 'azure_devops' && (
                <>
                  <div>
                    <Label className="text-xs">Új státusz</Label>
                    <Input className="h-8 text-xs" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Iteration path</Label>
                    <Input className="h-8 text-xs" value={updateForm.iteration_path} onChange={(e) => setUpdateForm({ ...updateForm, iteration_path: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <Button size="sm" onClick={update} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
              Frissítés
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
