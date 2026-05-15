import { useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ExternalLink, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const ADO_PRIORITIES = [
  { value: '1', label: 'Critical' },
  { value: '2', label: 'High' },
  { value: '3', label: 'Medium' },
  { value: '4', label: 'Low' },
];

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  base_url: string;
  project_key: string | null;
}

interface WorkItemDetail {
  external_key: string;
  external_id: string;
  summary: string | null;
  description: string;
  status: string | null;
  assignee_email: string | null;
  assignee_name: string | null;
  issue_type: string | null;
  priority: string | null;
  iteration_path: string | null;
  area_path: string | null;
  story_points: number | null;
  original_estimate_hours: number | null;
  parent_id: string | null;
  created: string | null;
  updated: string | null;
  url: string | null;
  tags: string | null;
}

interface State {
  name: string;
  category: string | null;
}

interface AssignableUser {
  display_name: string | null;
  email: string | null;
  account_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: IntegrationMini;
  workItemId: string | null;
  onSaved?: () => void;
}

export function AzureDevOpsIssueEditor({ open, onOpenChange, integration, workItemId, onSaved }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issue, setIssue] = useState<WorkItemDetail | null>(null);
  const [states, setStates] = useState<State[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [iterationPaths, setIterationPaths] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState('');

  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [iterationPath, setIterationPath] = useState('');
  const [storyPoints, setStoryPoints] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [newState, setNewState] = useState('');

  const loadIterationPaths = async () => {
    const { data } = await supabase
      .from('enterprise_agile_field_metadata')
      .select('schema')
      .eq('integration_id', integration.id)
      .eq('field_id', 'ado.iterations')
      .maybeSingle();
    const paths = (data as any)?.schema?.paths ?? [];
    setIterationPaths(Array.isArray(paths) ? paths : []);
  };

  const load = useCallback(async () => {
    if (!workItemId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'get_issue', integration_id: integration.id, params: { key: workItemId } },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; issue?: WorkItemDetail; transitions?: State[] };
      if (!payload?.ok) throw new Error(payload?.error ?? t('ado_editor.bad_response'));
      const det = payload.issue!;
      setIssue(det);
      setStates(payload.transitions ?? []);
      setSummary(det.summary ?? '');
      setDescription(det.description ?? '');
      setPriority(det.priority ?? '');
      setIterationPath(det.iteration_path ?? '');
      setStoryPoints(det.story_points != null ? String(det.story_points) : '');
      setAssigneeEmail(det.assignee_email ?? '');
      setNewState('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      toast.error(t('ado_editor.toast_load_error', { msg }));
    } finally {
      setLoading(false);
    }
  }, [integration.id, workItemId]);

  useEffect(() => {
    if (open && workItemId) {
      load();
      loadIterationPaths();
    } else if (!open) {
      setIssue(null);
      setLoadError(null);
      setUsers([]);
      setUserQuery('');
    }
  }, [open, workItemId, load]);

  useEffect(() => {
    if (!open || !workItemId) return;
    const timer = setTimeout(async () => {
      const { data } = await supabase.functions.invoke('jira-devops-proxy', {
        body: {
          action: 'search_assignable_users',
          integration_id: integration.id,
          params: { key: workItemId, query: userQuery },
        },
      });
      const payload = data as { ok?: boolean; users?: AssignableUser[] };
      setUsers(payload?.users ?? []);
    }, 400);
    return () => clearTimeout(timer);
  }, [open, workItemId, integration.id, userQuery]);

  const handleSave = async () => {
    if (!issue || !workItemId) return;
    setSaving(true);
    try {
      const params: Record<string, unknown> = { key: workItemId };
      if (summary !== (issue.summary ?? '')) params.summary = summary;
      if (description !== (issue.description ?? '')) params.description = description;
      if (priority !== (issue.priority ?? '')) params.priority = priority || null;
      if (iterationPath !== (issue.iteration_path ?? '')) params.iteration_path = iterationPath || null;
      const sp = storyPoints === '' ? null : Number(storyPoints);
      if (sp !== (issue.story_points ?? null)) params.story_points = sp;
      if (assigneeEmail !== (issue.assignee_email ?? '')) params.assignee_email = assigneeEmail || null;
      if (newState && newState !== issue.status) params.status = newState;

      const editableKeys = Object.keys(params).filter((k) => k !== 'key');
      if (editableKeys.length === 0) {
        toast.message(t('ado_editor.toast_no_changes'));
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'update_issue', integration_id: integration.id, params },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string };
      if (!payload?.ok) throw new Error(payload?.error ?? t('ado_editor.bad_response'));
      toast.success(t('ado_editor.toast_saved', { key: workItemId }));
      onSaved?.();
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('ado_editor.toast_save_error', { msg }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" aria-describedby="ado-editor-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm">#{workItemId ?? '—'}</span>
            {issue?.issue_type && <Badge variant="outline">{issue.issue_type}</Badge>}
            {issue?.status && <Badge>{issue.status}</Badge>}
            {issue?.url && (
              <a
                href={issue.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 ml-auto"
              >
                <ExternalLink className="h-3 w-3" /> {t('ado_editor.open_in_ado')}
              </a>
            )}
          </DialogTitle>
        </DialogHeader>
        <p id="ado-editor-desc" className="sr-only">{t('ado_editor.sr_desc')}</p>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">{t('ado_editor.loading')}</span>
          </div>
        )}

        {!loading && loadError && (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive font-medium">{t('ado_editor.load_failed')}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto break-words">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-1">
              <RefreshCw className="h-3 w-3" /> {t('ado_editor.btn_retry')}
            </Button>
          </div>
        )}

        {!loading && !loadError && !issue && workItemId && (
          <div className="py-10 text-center text-muted-foreground text-sm">{t('ado_editor.no_data')}</div>
        )}

        {!loading && issue && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ado-summary">{t('ado_editor.label_summary')}</Label>
              <Input id="ado-summary" value={summary} onChange={(e) => setSummary(e.target.value)} className="text-sm" />
            </div>

            <div>
              <Label htmlFor="ado-desc">{t('ado_editor.label_description')}</Label>
              <Textarea
                id="ado-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="text-sm font-mono"
                placeholder={t('ado_editor.placeholder_desc')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('ado_editor.label_priority')}</Label>
                <Select value={priority || '__none__'} onValueChange={(v) => setPriority(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={t('ado_editor.placeholder_priority')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {ADO_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ado-sp">{t('ado_editor.label_story_points')}</Label>
                <Input
                  id="ado-sp"
                  type="number"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value)}
                  className="h-8 text-sm"
                  step={0.5}
                />
              </div>

              <div>
                <Label htmlFor="ado-iter">{t('ado_editor.label_iteration_path')}</Label>
                <Input
                  id="ado-iter"
                  list="ado-iter-paths"
                  value={iterationPath}
                  onChange={(e) => setIterationPath(e.target.value)}
                  className="h-8 text-sm"
                  placeholder={t('ado_editor.placeholder_iteration_path')}
                />
                {iterationPaths.length > 0 && (
                  <datalist id="ado-iter-paths">
                    {iterationPaths.map((p) => <option key={p} value={p} />)}
                  </datalist>
                )}
              </div>

              {states.length > 0 && (
                <div>
                  <Label>{t('ado_editor.label_state')}</Label>
                  <Select value={newState || '__keep__'} onValueChange={(v) => setNewState(v === '__keep__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('ado_editor.placeholder_keep_state')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep__">{t('ado_editor.keep_state', { state: issue.status ?? '—' })}</SelectItem>
                      {states.map((s) => (
                        <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label>{t('ado_editor.label_assignee')}</Label>
              <Input
                placeholder={t('ado_editor.placeholder_search_user')}
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="h-8 text-sm mb-1"
              />
              <Select
                value={assigneeEmail || '__none__'}
                onValueChange={(v) => setAssigneeEmail(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={issue.assignee_name ?? t('ado_editor.placeholder_assignee')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('ado_editor.opt_unassign')}</SelectItem>
                  {users.map((u, i) => (
                    <SelectItem key={u.email ?? String(i)} value={u.email ?? ''}>
                      {u.display_name} {u.email ? `(${u.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground border-t pt-3">
              <div>
                <div className="font-medium text-foreground/70">{t('ado_editor.meta_type')}</div>
                {issue.issue_type ?? '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">{t('ado_editor.meta_iteration')}</div>
                {issue.iteration_path ?? '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">{t('ado_editor.meta_area')}</div>
                {issue.area_path ?? '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">{t('ado_editor.meta_parent')}</div>
                {issue.parent_id ? `#${issue.parent_id}` : '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">{t('ado_editor.meta_created')}</div>
                {issue.created ? new Date(issue.created).toLocaleString() : '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">{t('ado_editor.meta_updated')}</div>
                {issue.updated ? new Date(issue.updated).toLocaleString() : '—'}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={load} disabled={loading || saving} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> {t('ado_editor.btn_reload')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('ado_editor.btn_close')}
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !issue} className="gap-1">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('ado_editor.btn_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
