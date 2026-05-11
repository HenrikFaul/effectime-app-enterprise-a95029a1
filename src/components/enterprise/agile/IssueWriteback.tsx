import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  PlusCircle,
  Pencil,
  Database,
  RefreshCw,
  ChevronsUpDown,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  project_key: string | null;
}

interface CachedIssue {
  external_key: string;
  summary: string | null;
  status: string | null;
  issue_type: string | null;
  assignee_name: string | null;
}

export function IssueWriteback({ integration, userId }: { integration: IntegrationMini; userId: string }) {
  void userId;
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const [createForm, setCreateForm] = useState({
    summary: '',
    description: '',
    issue_type: '',
    assignee_email: '',
    labels: '',
    iteration_path: '',
    original_estimate_hours: '',
  });

  const [configLoading, setConfigLoading] = useState(false);
  const [issueTypeOptions, setIssueTypeOptions] = useState<string[]>([]);
  const [labelOptions, setLabelOptions] = useState<string[]>([]);
  const [autoSyncTried, setAutoSyncTried] = useState(false);

  const [updateForm, setUpdateForm] = useState({
    key: '',
    summary: '',
    assignee_email: '',
    status: '',
    iteration_path: '',
  });

  // Issue picker for "Frissítés"
  const [issues, setIssues] = useState<CachedIssue[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [issuesLoading, setIssuesLoading] = useState(false);

  const loadProjectConfigFromDb = async () => {
    const { data } = await supabase
      .from('enterprise_agile_field_metadata')
      .select('field_id,field_name,field_type,schema')
      .eq('integration_id', integration.id);
    const rows = (data ?? []) as any[];
    // Only use project-specific issue type rows (field_id starts with 'jira.issuetype.')
    // The generic field-discovery row has field_id='issuetype', field_name='Issue Type' and must be excluded.
    const issueTypes = Array.from(
      new Set(
        rows
          .filter((r) => r.field_type === 'issuetype' && r.field_id.startsWith('jira.issuetype.'))
          .map((r) => r.field_name)
          .filter(Boolean),
      ),
    );
    const labels = rows.find((r) => r.field_id === 'jira.labels')?.schema?.options ?? [];
    setIssueTypeOptions(issueTypes);
    setLabelOptions(Array.isArray(labels) ? labels : []);
    setCreateForm((prev) => {
      if (!issueTypes.length) return prev;
      if (prev.issue_type && issueTypes.includes(prev.issue_type)) return prev;
      return { ...prev, issue_type: issueTypes[0] };
    });
    return issueTypes;
  };

  const syncProjectConfig = async (silent = false) => {
    setConfigLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'sync_project_config', integration_id: integration.id },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? t('issue_writeback.bad_response'));
      await loadProjectConfigFromDb();
      if (!silent) toast.success(t('issue_writeback.config_saved', { count: (data as any).count }));
    } catch (e: any) {
      if (!silent) toast.error(t('issue_writeback.sync_error', { msg: e?.message ?? String(e) }));
    } finally {
      setConfigLoading(false);
    }
  };

  const loadIssuesCache = async () => {
    setIssuesLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_agile_issues')
      .select('external_key,summary,status,issue_type,assignee_name')
      .eq('integration_id', integration.id)
      .order('last_synced_at', { ascending: false })
      .limit(500);
    setIssues((data ?? []) as CachedIssue[]);
    setIssuesLoading(false);
  };

  const create = async () => {
    if (!createForm.summary) { toast.error(t('issue_writeback.summary_required')); return; }
    if (integration.provider === 'jira' && !createForm.issue_type) {
      toast.error(t('issue_writeback.select_issue_type')); return;
    }
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
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? t('issue_writeback.bad_response'));
      toast.success(t('issue_writeback.ticket_created'));
      setCreateForm((p) => ({ ...p, summary: '', description: '', labels: '', iteration_path: '', original_estimate_hours: '' }));
    } catch (e: any) {
      toast.error('Hiba: ' + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  const update = async () => {
    if (!updateForm.key) { toast.error(t('issue_writeback.select_ticket_first')); return; }
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
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? t('issue_writeback.bad_response'));
      toast.success(t('issue_writeback.ticket_updated'));
    } catch (e: any) {
      toast.error('Hiba: ' + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setAutoSyncTried(false);
    void loadProjectConfigFromDb().then((opts) => {
      // Auto-sync once if Jira and no issue types cached yet
      if (integration.provider === 'jira' && opts.length === 0) {
        setAutoSyncTried(true);
        void syncProjectConfig(true);
      }
    });
    void loadIssuesCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration.id]);

  const selectedIssue = useMemo(
    () => issues.find((i) => i.external_key === updateForm.key) || null,
    [issues, updateForm.key],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t('issue_writeback.card_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {integration.provider === 'jira' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => syncProjectConfig(false)} disabled={configLoading || busy} className="gap-1">
              {configLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
              {t('issue_writeback.sync_config_label')}
            </Button>
            <Button size="sm" variant="ghost" onClick={loadProjectConfigFromDb} disabled={configLoading || busy} className="gap-1">
              <RefreshCw className="h-3 w-3" /> {t('issue_writeback.load_from_db_btn')}
            </Button>
            {issueTypeOptions.length > 0 ? (
              <Badge variant="secondary" className="text-[10px]">
                {t('issue_writeback.issue_types_count', { count: issueTypeOptions.length })}
              </Badge>
            ) : autoSyncTried && !configLoading ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Nincs cache-elt issue type — futtass szinkront
              </Badge>
            ) : null}
          </div>
        )}
        <Tabs defaultValue="create">
          <TabsList>
            <TabsTrigger value="create" className="gap-1"><PlusCircle className="h-3 w-3" /> {t('issue_writeback.tab_new')}</TabsTrigger>
            <TabsTrigger value="update" className="gap-1"><Pencil className="h-3 w-3" /> {t('issue_writeback.tab_update')}</TabsTrigger>
          </TabsList>

          {/* ---------------- CREATE ---------------- */}
          <TabsContent value="create" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs">{t('issue_writeback.label_summary')}</Label>
              <Input className="h-8 text-xs" value={createForm.summary} onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('issue_writeback.label_description')}</Label>
              <Textarea rows={3} className="text-xs" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('issue_writeback.label_type')}</Label>
                {integration.provider === 'jira' ? (
                  issueTypeOptions.length > 0 ? (
                    <Select
                      value={createForm.issue_type}
                      onValueChange={(v) => setCreateForm({ ...createForm, issue_type: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t('issue_writeback.type_placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {issueTypeOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-[10px] text-muted-foreground border rounded-md h-8 px-2 flex items-center">
                      {configLoading ? '...' : t('issue_writeback.no_config_hint')}
                    </div>
                  )
                ) : (
                  <Input className="h-8 text-xs" value={createForm.issue_type} onChange={(e) => setCreateForm({ ...createForm, issue_type: e.target.value })} placeholder="Task" />
                )}
              </div>
              <div>
                <Label className="text-xs">{t('issue_writeback.label_labels')}</Label>
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
                  <Label className="text-xs">{t('issue_writeback.label_assignee_email')}</Label>
                  <Input className="h-8 text-xs" value={createForm.assignee_email} onChange={(e) => setCreateForm({ ...createForm, assignee_email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Iteration path</Label>
                  <Input className="h-8 text-xs" value={createForm.iteration_path} onChange={(e) => setCreateForm({ ...createForm, iteration_path: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{t('issue_writeback.label_estimate')}</Label>
                  <Input className="h-8 text-xs" type="number" value={createForm.original_estimate_hours} onChange={(e) => setCreateForm({ ...createForm, original_estimate_hours: e.target.value })} />
                </div>
              </div>
            )}
            <Button size="sm" onClick={create} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
              {t('issue_writeback.btn_create')}
            </Button>
          </TabsContent>

          {/* ---------------- UPDATE ---------------- */}
          <TabsContent value="update" className="space-y-3 pt-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ticket *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={loadIssuesCache}
                  disabled={issuesLoading}
                >
                  {issuesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {t('issue_writeback.load_from_cache_btn')}
                </Button>
              </div>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full h-9 justify-between text-xs font-normal"
                  >
                    {selectedIssue ? (
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-primary">{selectedIssue.external_key}</span>
                        <span className="truncate text-muted-foreground">{selectedIssue.summary}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Search className="h-3.5 w-3.5" />
                        {issues.length > 0 ? t('issue_writeback.select_from_n_tickets', { count: issues.length }) : t('issue_writeback.no_cached_tickets')}
                      </span>
                    )}
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[480px] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      const s = search.toLowerCase();
                      return value.toLowerCase().includes(s) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder={t('issue_writeback.search_placeholder')} />
                    <CommandList>
                      <CommandEmpty>{t('issue_writeback.no_results')}</CommandEmpty>
                      <CommandGroup>
                        {issues.map((i) => {
                          const haystack = `${i.external_key} ${i.summary ?? ''} ${i.assignee_name ?? ''} ${i.issue_type ?? ''}`;
                          return (
                            <CommandItem
                              key={i.external_key}
                              value={haystack}
                              onSelect={() => {
                                setUpdateForm((f) => ({ ...f, key: i.external_key }));
                                setPickerOpen(false);
                              }}
                              className="flex items-center gap-2"
                            >
                              <span className="font-mono text-xs text-primary w-20 shrink-0">{i.external_key}</span>
                              <span className="flex-1 min-w-0 truncate">{i.summary || '—'}</span>
                              {i.issue_type && (
                                <Badge variant="outline" className="text-[10px] shrink-0">{i.issue_type}</Badge>
                              )}
                              {i.status && (
                                <Badge variant="secondary" className="text-[10px] shrink-0">{i.status}</Badge>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {issues.length === 0 && !issuesLoading && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('issue_writeback.tip_open_backlog')}
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">{t('issue_writeback.label_new_title')}</Label>
              <Input className="h-8 text-xs" value={updateForm.summary} onChange={(e) => setUpdateForm({ ...updateForm, summary: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('issue_writeback.label_new_assignee')}</Label>
                <Input className="h-8 text-xs" value={updateForm.assignee_email} onChange={(e) => setUpdateForm({ ...updateForm, assignee_email: e.target.value })} />
              </div>
              {integration.provider === 'azure_devops' && (
                <>
                  <div>
                    <Label className="text-xs">{t('issue_writeback.label_new_status')}</Label>
                    <Input className="h-8 text-xs" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Iteration path</Label>
                    <Input className="h-8 text-xs" value={updateForm.iteration_path} onChange={(e) => setUpdateForm({ ...updateForm, iteration_path: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <Button size="sm" onClick={update} disabled={busy || !updateForm.key} className="gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
              {t('issue_writeback.btn_update')}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
