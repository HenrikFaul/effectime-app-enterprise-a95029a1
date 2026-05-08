import { useEffect, useState, useCallback } from 'react';
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

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  base_url: string;
  project_key: string | null;
}

interface IssueDetail {
  external_key: string;
  external_id: string;
  summary: string | null;
  description: string;
  status: string | null;
  status_id: string | null;
  assignee_account_id: string | null;
  assignee_email: string | null;
  assignee_name: string | null;
  issue_type: string | null;
  priority: string | null;
  labels: string[];
  components: string[];
  parent_key: string | null;
  reporter_email: string | null;
  reporter_name: string | null;
  sprint_name: string | null;
  story_points: number | null;
  due_date: string | null;
  created: string | null;
  updated: string | null;
  url: string | null;
}

interface Transition {
  id: string;
  name: string;
  to_status: string | null;
  to_status_id: string | null;
}

interface AssignableUser {
  account_id: string;
  display_name: string;
  email: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: IntegrationMini;
  issueKey: string | null;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: () => void;
}

const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

export function JiraIssueEditor({ open, onOpenChange, integration, issueKey, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [userQuery, setUserQuery] = useState('');

  // Editable form state
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('');
  const [labelsStr, setLabelsStr] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [storyPoints, setStoryPoints] = useState<string>('');
  const [assigneeAccountId, setAssigneeAccountId] = useState<string>('');
  const [transitionId, setTransitionId] = useState<string>('');

  const load = useCallback(async () => {
    if (!issueKey) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'get_issue', integration_id: integration.id, params: { key: issueKey } },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; issue?: IssueDetail; transitions?: Transition[] };
      if (!payload?.ok) throw new Error(payload?.error ?? 'Hibás válasz');
      const det = payload.issue!;
      setIssue(det);
      setTransitions(payload.transitions ?? []);
      setSummary(det.summary ?? '');
      setDescription(det.description ?? '');
      setPriority(det.priority ?? '');
      setLabelsStr((det.labels ?? []).join(', '));
      setDueDate(det.due_date ?? '');
      setStoryPoints(det.story_points != null ? String(det.story_points) : '');
      setAssigneeAccountId(det.assignee_account_id ?? '');
      setTransitionId('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      toast.error('Ticket betöltés sikertelen: ' + msg);
    } finally {
      setLoading(false);
    }
  }, [integration.id, issueKey]);

  useEffect(() => {
    if (open && issueKey) {
      load();
    } else if (!open) {
      setIssue(null);
      setLoadError(null);
      setUsers([]);
      setUserQuery('');
    }
  }, [open, issueKey, load]);

  // Search assignable users (debounced)
  useEffect(() => {
    if (!open || !issueKey) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.functions.invoke('jira-devops-proxy', {
        body: {
          action: 'search_assignable_users',
          integration_id: integration.id,
          params: { key: issueKey, query: userQuery },
        },
      });
      const payload = data as { ok?: boolean; users?: AssignableUser[] };
      setUsers(payload?.users ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [open, issueKey, integration.id, userQuery]);

  const handleSave = async () => {
    if (!issue || !issueKey) return;
    setSaving(true);
    try {
      const params: Record<string, unknown> = { key: issueKey };
      if (summary !== (issue.summary ?? '')) params.summary = summary;
      if (description !== (issue.description ?? '')) params.description = description;
      if (priority !== (issue.priority ?? '')) params.priority = priority || null;
      const newLabels = labelsStr.split(',').map((l) => l.trim()).filter(Boolean);
      const oldLabels = issue.labels ?? [];
      if (JSON.stringify(newLabels) !== JSON.stringify(oldLabels)) params.labels = newLabels;
      if (dueDate !== (issue.due_date ?? '')) params.due_date = dueDate || null;
      const sp = storyPoints === '' ? null : Number(storyPoints);
      if (sp !== (issue.story_points ?? null)) params.story_points = sp;
      if (assigneeAccountId !== (issue.assignee_account_id ?? '')) {
        params.assignee_account_id = assigneeAccountId || null;
      }
      if (transitionId) {
        params.status_transition_id = transitionId;
      }

      // No-op short-circuit
      const editableKeys = Object.keys(params).filter((k) => k !== 'key');
      if (editableKeys.length === 0) {
        toast.message('Nincs módosítás.');
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'update_issue', integration_id: integration.id, params },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string };
      if (!payload?.ok) throw new Error(payload?.error ?? 'Hibás válasz');
      toast.success(`${issueKey} frissítve a Jira-ban`);
      onSaved?.();
      // Reload to show the post-save state (especially status after transition)
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Mentés sikertelen: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" aria-describedby="issue-editor-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm">{issueKey ?? '—'}</span>
            {issue?.issue_type && <Badge variant="outline">{issue.issue_type}</Badge>}
            {issue?.status && <Badge>{issue.status}</Badge>}
            {issue?.url && (
              <a
                href={issue.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 ml-auto"
              >
                <ExternalLink className="h-3 w-3" /> Megnyitás Jira-ban
              </a>
            )}
          </DialogTitle>
        </DialogHeader>
        <p id="issue-editor-desc" className="sr-only">
          Jira ticket szerkesztése. Mentés után az adatok a Jira-ban is frissülnek.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Ticket betöltése…</span>
          </div>
        )}

        {!loading && loadError && (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive font-medium">Nem sikerült betölteni a ticketet.</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto break-words">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-1">
              <RefreshCw className="h-3 w-3" /> Újrapróbál
            </Button>
          </div>
        )}

        {!loading && !loadError && !issue && issueKey && (
          <div className="py-10 text-center text-muted-foreground text-sm">
            Nincs adat — a ticket nem található vagy üres a válasz.
          </div>
        )}

        {!loading && issue && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ji-summary">Cím</Label>
              <Input
                id="ji-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="text-sm"
              />
            </div>

            <div>
              <Label htmlFor="ji-desc">Leírás</Label>
              <Textarea
                id="ji-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="text-sm font-mono"
                placeholder="Részletes leírás..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioritás</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Válassz prioritást" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ji-due">Határidő (YYYY-MM-DD)</Label>
                <Input
                  id="ji-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="ji-sp">Story Points</Label>
                <Input
                  id="ji-sp"
                  type="number"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value)}
                  className="h-8 text-sm"
                  step={0.5}
                />
              </div>

              <div>
                <Label htmlFor="ji-labels">Címkék (vesszővel)</Label>
                <Input
                  id="ji-labels"
                  value={labelsStr}
                  onChange={(e) => setLabelsStr(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="bug, frontend, urgent"
                />
              </div>
            </div>

            <div>
              <Label>Felelős</Label>
              <Input
                placeholder="Keresés név vagy email alapján..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="h-8 text-sm mb-1"
              />
              <Select value={assigneeAccountId} onValueChange={setAssigneeAccountId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={issue.assignee_name ?? 'Nincs hozzárendelve'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Hozzárendelés törlése —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.account_id} value={u.account_id}>
                      {u.display_name} {u.email ? `(${u.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {transitions.length > 0 && (
              <div>
                <Label>Státusz váltás</Label>
                <Select value={transitionId} onValueChange={setTransitionId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Tartja a jelenlegit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tartja: {issue.status ?? '—'}</SelectItem>
                    {transitions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        → {t.to_status ?? t.name} ({t.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground border-t pt-3">
              <div>
                <div className="font-medium text-foreground/70">Bejelentő</div>
                {issue.reporter_name ?? issue.reporter_email ?? '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">Sprint</div>
                {issue.sprint_name ?? '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">Szülő ticket</div>
                {issue.parent_key ?? '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">Komponensek</div>
                {issue.components?.length ? issue.components.join(', ') : '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">Létrehozva</div>
                {issue.created ? new Date(issue.created).toLocaleString('hu-HU') : '—'}
              </div>
              <div>
                <div className="font-medium text-foreground/70">Utolsó módosítás</div>
                {issue.updated ? new Date(issue.updated).toLocaleString('hu-HU') : '—'}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={load} disabled={loading || saving} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Újratöltés
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Bezárás
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !issue} className="gap-1">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Mentés a Jira-ba
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
