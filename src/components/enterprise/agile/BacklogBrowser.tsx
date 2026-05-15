import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ExternalLink, Pencil, List, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { JiraIssueEditor } from './JiraIssueEditor';
import { AzureDevOpsIssueEditor } from './AzureDevOpsIssueEditor';
import { useI18n } from '@/i18n/I18nProvider';
import { BacklogFilterBuilder } from './BacklogFilterBuilder';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  base_url: string;
  project_key: string | null;
}

interface Issue {
  external_key: string;
  summary: string | null;
  status: string | null;
  assignee_name: string | null;
  issue_type: string | null;
  priority: string | null;
  story_points: number | null;
  url: string | null;
}

export function BacklogBrowser({ integration }: { integration: IntegrationMini }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [adoEditorId, setAdoEditorId] = useState<string | null>(null);
  const [mode, setMode] = useState<'wiql' | 'visual'>('visual');

  const placeholder =
    integration.provider === 'jira'
      ? `JQL — pl. project = ${integration.project_key ?? 'PROJ'} AND status != Done`
      : `WIQL — pl. SELECT [System.Id] FROM WorkItems WHERE [System.State] <> 'Closed'`;

  const presets = integration.provider === 'jira'
    ? [
      { label: t('agile_boards.query_label_active_sprint'), q: `project = ${integration.project_key ?? 'PROJ'} AND sprint in openSprints() ORDER BY priority DESC, updated DESC` },
      { label: t('agile_boards.query_label_my_tickets'), q: `project = ${integration.project_key ?? 'PROJ'} AND assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC` },
      { label: t('agile_boards.query_label_overdue'), q: `project = ${integration.project_key ?? 'PROJ'} AND due <= now() AND statusCategory != Done ORDER BY due ASC` },
    ]
    : [
      { label: t('agile_boards.query_label_active_iteration'), q: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${integration.project_key ?? 'Project'}' AND [System.State] <> 'Closed' ORDER BY [System.ChangedDate] DESC` },
      { label: t('agile_boards.query_label_my_tickets'), q: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${integration.project_key ?? 'Project'}' AND [System.AssignedTo] = @Me AND [System.State] <> 'Closed'` },
      { label: t('agile_boards.query_label_overdue'), q: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${integration.project_key ?? 'Project'}' AND [Microsoft.VSTS.Scheduling.DueDate] < @Today AND [System.State] <> 'Closed'` },
    ];

  const loadFromCache = async () => {
    const { data } = await (supabase as any)
      .from('enterprise_agile_issues')
      .select('external_key,summary,status,assignee_name,issue_type,priority,story_points,url')
      .eq('integration_id', integration.id)
      .order('last_synced_at', { ascending: false })
      .limit(200);
    setIssues((data ?? []) as Issue[]);
  };


  useEffect(() => {
    loadFromCache();
  }, [integration.id]);

  const search = async (queryOverride?: string) => {
    const q = queryOverride ?? query;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'search_issues', integration_id: integration.id, params: { query: q, max: 100 } },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? t('agile_boards.error_bad_response'));
      const remote = (data as any).issues ?? [];
      if (remote.length > 0) {
        setIssues(remote);
        toast.success(t('backlog_browser.tickets_loaded', { count: (data as any).count }));
      } else {
        await loadFromCache();
        toast.message(t('agile_boards.no_fresh_results'));
      }
    } catch (e: any) {
      toast.error(t('agile_boards.query_failed', { msg: e?.message ?? String(e) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t('backlog_browser.title')}</CardTitle>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={mode === 'visual' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => setMode('visual')}
            >
              <SlidersHorizontal className="h-3 w-3" /> {t('backlog_browser.mode_visual')}
            </Button>
            <Button
              variant={mode === 'wiql' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => setMode('wiql')}
            >
              <List className="h-3 w-3" /> {t('backlog_browser.mode_wiql')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === 'visual' ? (
          <BacklogFilterBuilder integration={integration} onSearch={search} loading={loading} />
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="h-8 text-xs font-mono"
              />
              <Button size="sm" onClick={() => search()} disabled={loading} className="gap-1">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {t('backlog_browser.search')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => setQuery(preset.q)}
                >
                  {preset.label}
                </Button>
              ))}
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={loadFromCache}>
                {t('backlog_browser.load_cache')}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t('backlog_browser.empty_query_hint', { project: integration.project_key ?? 'projekt' })}{' '}
              {t('backlog_browser.cache_note')}
            </p>
            {integration.provider === 'jira' && (
              <p className="text-[10px] text-muted-foreground">
                {t('backlog_browser.tip')}
              </p>
            )}
          </>
        )}

        <JiraIssueEditor
          open={!!editorKey}
          onOpenChange={(o) => !o && setEditorKey(null)}
          integration={integration}
          issueKey={editorKey}
          onSaved={loadFromCache}
        />
        <AzureDevOpsIssueEditor
          open={!!adoEditorId}
          onOpenChange={(o) => !o && setAdoEditorId(null)}
          integration={integration}
          workItemId={adoEditorId}
          onSaved={loadFromCache}
        />

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">{t('backlog_browser.col_key')}</th>
                <th className="text-left p-2">{t('backlog_browser.col_title')}</th>
                <th className="text-left p-2">{t('backlog_browser.col_type')}</th>
                <th className="text-left p-2">{t('backlog_browser.col_status')}</th>
                <th className="text-left p-2">{t('backlog_browser.col_assignee')}</th>
                <th className="text-left p-2">SP</th>
                <th className="text-left p-2"></th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{t('backlog_browser.no_data')}</td></tr>
              )}
              {issues.map((i) => (
                <tr key={i.external_key} className="border-t hover:bg-accent/30">
                  <td className="p-2 font-mono">{i.external_key}</td>
                  <td className="p-2">
                    {integration.provider === 'jira' ? (
                      <button
                        type="button"
                        onClick={() => setEditorKey(i.external_key)}
                        className="text-left hover:text-primary hover:underline"
                      >
                        {i.summary}
                      </button>
                    ) : integration.provider === 'azure_devops' ? (
                      <button
                        type="button"
                        onClick={() => setAdoEditorId(i.external_key)}
                        className="text-left hover:text-primary hover:underline"
                      >
                        {i.summary}
                      </button>
                    ) : (
                      i.summary
                    )}
                  </td>
                  <td className="p-2"><Badge variant="outline" className="text-[10px]">{i.issue_type}</Badge></td>
                  <td className="p-2">{i.status}</td>
                  <td className="p-2">{i.assignee_name ?? '—'}</td>
                  <td className="p-2">{i.story_points ?? '—'}</td>
                  <td className="p-2 flex items-center gap-2">
                    {integration.provider === 'jira' && (
                      <button
                        type="button"
                        onClick={() => setEditorKey(i.external_key)}
                        className="text-muted-foreground hover:text-primary"
                        title={t('agile_boards.edit_in_effectime')}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {integration.provider === 'azure_devops' && (
                      <button
                        type="button"
                        onClick={() => setAdoEditorId(i.external_key)}
                        className="text-muted-foreground hover:text-primary"
                        title={t('agile_boards.edit_in_effectime')}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {i.url && (
                      <a href={i.url} target="_blank" rel="noreferrer" className="text-primary hover:underline" title={t('backlog_browser.open_external')}>
                        <ExternalLink className="h-3 w-3 inline" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
