import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ExternalLink, Pencil, List, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { JiraIssueEditor } from './JiraIssueEditor';
import { AzureDevOpsIssueEditor } from './AzureDevOpsIssueEditor';
import { useI18n } from '@/i18n/I18nProvider';
import { BacklogFilterBuilder, type FieldMeta } from './BacklogFilterBuilder';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  base_url: string;
  project_key: string | null;
  selected_field_ids: string[];
}

// ADO / Jira field reference names → enterprise_agile_issues column keys
// Only map to columns that actually exist in the enterprise_agile_issues table.
const FIELD_TO_COL: Record<string, string> = {
  'System.WorkItemType': 'issue_type',
  'System.State': 'status',
  'System.AssignedTo': 'assignee_name',
  'Microsoft.VSTS.Common.Priority': 'priority',
  'Microsoft.VSTS.Scheduling.StoryPoints': 'story_points',
  'System.IterationPath': 'iteration_path',
  'System.Description': 'description',
  'System.Tags': 'labels',
  'System.CreatedDate': 'created_at',
  'System.ChangedDate': 'external_updated_at',
  'Microsoft.VSTS.Scheduling.DueDate': 'due_date',
  'assignee': 'assignee_name',
  'status': 'status',
  'issuetype': 'issue_type',
  'priority': 'priority',
  'story_points': 'story_points',
  'labels': 'labels',
  'description': 'description',
  'jira.issuetypes': 'issue_type',
  'jira.statuses': 'status',
  'jira.labels': 'labels',
};

const FILTER_ONLY_IDS = new Set([
  'ado.iterations', 'jira.issuetypes', 'jira.statuses',
  'jira.labels', 'jira.components', 'jira.project_name',
]);
const FILTER_ONLY_PREFIXES = ['ado.workitemtype.'];

interface DynamicCol { fieldId: string; label: string; colKey: string; fieldType: string | null; }

function buildDynamicCols(selectedIds: string[], allMeta: FieldMeta[]): DynamicCol[] {
  const seen = new Set<string>(['external_key', 'summary']);
  return selectedIds.reduce<DynamicCol[]>((acc, id) => {
    if (FILTER_ONLY_IDS.has(id) || FILTER_ONLY_PREFIXES.some(p => id.startsWith(p))) return acc;
    const colKey = FIELD_TO_COL[id];
    if (!colKey || seen.has(colKey)) return acc;
    seen.add(colKey);
    const meta = allMeta.find(f => f.field_id === id);
    acc.push({ fieldId: id, label: meta?.field_name ?? id, colKey, fieldType: meta?.field_type ?? null });
    return acc;
  }, []);
}

const CACHE_SELECT = [
  'external_key', 'summary', 'status', 'assignee_name', 'assignee_email',
  'issue_type', 'priority', 'story_points', 'url', 'iteration_path', 'due_date',
  'description', 'labels', 'created_at', 'external_updated_at', 'last_synced_at',
].join(',');

const PAGE_OPTIONS = [10, 20, 50, 100] as const;

export function BacklogBrowser({ integration }: { integration: IntegrationMini }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'wiql' | 'visual'>('visual');
  const [query, setQuery] = useState('');
  const [issues, setIssues] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [adoEditorId, setAdoEditorId] = useState<string | null>(null);
  const [fieldMeta, setFieldMeta] = useState<FieldMeta[]>([]);
  const [pageSize, setPageSize] = useState<number>(10);
  // Use a ref so loadFromCache / search always see the current pageSize even from effects
  const pageSizeRef = useRef(10);
  pageSizeRef.current = pageSize;

  useEffect(() => {
    supabase
      .from('enterprise_agile_field_metadata')
      .select('field_id,field_name,field_type,schema')
      .eq('integration_id', integration.id)
      .then(({ data }) => setFieldMeta((data ?? []) as FieldMeta[]));
  }, [integration.id]);

  const selectedFieldIds = integration.selected_field_ids ?? [];
  const dynamicCols = buildDynamicCols(selectedFieldIds, fieldMeta);
  const totalCols = 2 + dynamicCols.length + 1;

  // Derive unique filter option values from cached issues as fallback for visual filter
  const cachedIssueTypes = useMemo(
    () => [...new Set(issues.map(i => i.issue_type as string).filter(Boolean))].sort(),
    [issues],
  );
  const cachedStates = useMemo(
    () => [...new Set(issues.map(i => i.status as string).filter(Boolean))].sort(),
    [issues],
  );
  const cachedPriorities = useMemo(
    () => [...new Set(issues.map(i => i.priority as string).filter(Boolean))].sort(),
    [issues],
  );
  const cachedIterationPaths = useMemo(
    () => [...new Set(issues.map(i => i.iteration_path as string).filter(Boolean))].sort(),
    [issues],
  );

  // Build a simple default query (no filters) for auto-fetch
  const defaultQuery = integration.provider === 'azure_devops'
    ? `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${integration.project_key ?? 'Project'}' ORDER BY [System.ChangedDate] DESC`
    : `project = ${integration.project_key ?? 'PROJ'} ORDER BY updated DESC`;

  const placeholder = integration.provider === 'jira'
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

  const loadFromCache = async (): Promise<number> => {
    const limit = pageSizeRef.current;
    let q = (supabase as any)
      .from('enterprise_agile_issues')
      .select(CACHE_SELECT)
      .eq('integration_id', integration.id)
      .order('last_synced_at', { ascending: false });
    if (limit > 0) q = q.limit(limit);
    const { data } = await q;
    const rows = (data ?? []) as Record<string, unknown>[];
    setIssues(rows);
    return rows.length;
  };

  const search = async (queryOverride?: string) => {
    const q = queryOverride ?? query;
    const max = pageSizeRef.current > 0 ? pageSizeRef.current : 500;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'search_issues', integration_id: integration.id, params: { query: q, max } },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? t('agile_boards.error_bad_response'));
      const remote = (data as any).issues ?? [];
      if (remote.length > 0) {
        setIssues(remote as Record<string, unknown>[]);
        toast.success(t('backlog_browser.tickets_loaded', { count: (data as any).count ?? remote.length }));
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

  // On mount / integration change: load cache; if empty auto-fetch from API
  useEffect(() => {
    let active = true;
    loadFromCache().then((count) => {
      if (!active) return;
      if (count === 0) search(defaultQuery);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration.id]);

  // On page size change: reload from cache with new limit
  useEffect(() => {
    loadFromCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const renderCell = (issue: Record<string, unknown>, col: DynamicCol) => {
    const val = issue[col.colKey];
    if (val == null || val === '') return <span className="text-muted-foreground">—</span>;
    if (col.colKey === 'issue_type') return <Badge variant="outline" className="text-[10px]">{String(val)}</Badge>;
    if (col.colKey === 'assignee_name') {
      const name = String(val);
      const email = issue['assignee_email'] as string | null;
      return <span title={email ?? name} className="cursor-default">{name}</span>;
    }
    if (col.fieldType === 'dateTime' || ['created_at', 'external_updated_at', 'due_date'].includes(col.colKey)) {
      try { return <span>{new Date(String(val)).toLocaleDateString()}</span>; } catch { /* fall through */ }
    }
    const str = String(val);
    return <span title={str.length > 40 ? str : undefined}>{str.length > 40 ? `${str.slice(0, 38)}…` : str}</span>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t('backlog_browser.title')}</CardTitle>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button variant={mode === 'visual' ? 'secondary' : 'ghost'} size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={() => setMode('visual')}>
              <SlidersHorizontal className="h-3 w-3" /> {t('backlog_browser.mode_visual')}
            </Button>
            <Button variant={mode === 'wiql' ? 'secondary' : 'ghost'} size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={() => setMode('wiql')}>
              <List className="h-3 w-3" /> {t('backlog_browser.mode_wiql')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === 'visual' ? (
          <BacklogFilterBuilder
            integration={integration}
            fieldMeta={fieldMeta}
            selectedFieldIds={selectedFieldIds}
            onSearch={search}
            loading={loading}
            cachedIssueTypes={cachedIssueTypes}
            cachedStates={cachedStates}
            cachedPriorities={cachedPriorities}
            cachedIterationPaths={cachedIterationPaths}
          />
        ) : (
          <>
            <div className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="h-8 text-xs font-mono" />
              <Button size="sm" onClick={() => search()} disabled={loading} className="gap-1">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {t('backlog_browser.search')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <Button key={preset.label} type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setQuery(preset.q)}>
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
              <p className="text-[10px] text-muted-foreground">{t('backlog_browser.tip')}</p>
            )}
          </>
        )}

        <JiraIssueEditor open={!!editorKey} onOpenChange={(o) => !o && setEditorKey(null)} integration={integration} issueKey={editorKey} onSaved={loadFromCache} />
        <AzureDevOpsIssueEditor open={!!adoEditorId} onOpenChange={(o) => !o && setAdoEditorId(null)} integration={integration} workItemId={adoEditorId} onSaved={loadFromCache} />

        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 whitespace-nowrap">{t('backlog_browser.col_key')}</th>
                <th className="text-left p-2">{t('backlog_browser.col_title')}</th>
                {dynamicCols.map(col => (
                  <th key={col.fieldId} className="text-left p-2 whitespace-nowrap text-[11px]">{col.label}</th>
                ))}
                <th className="text-left p-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {loading && issues.length === 0 && (
                <tr><td colSpan={totalCols} className="p-4 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />{t('backlog_browser.search')}…
                </td></tr>
              )}
              {!loading && issues.length === 0 && (
                <tr><td colSpan={totalCols} className="p-4 text-center text-muted-foreground">{t('backlog_browser.no_data')}</td></tr>
              )}
              {issues.map((issue) => (
                <tr key={String(issue.external_key)} className="border-t hover:bg-accent/30">
                  <td className="p-2 font-mono whitespace-nowrap">{String(issue.external_key)}</td>
                  <td className="p-2 min-w-[180px] max-w-[320px]">
                    {integration.provider === 'jira' ? (
                      <button type="button" onClick={() => setEditorKey(String(issue.external_key))} className="text-left hover:text-primary hover:underline line-clamp-2">
                        {String(issue.summary ?? '')}
                      </button>
                    ) : (
                      <button type="button" onClick={() => setAdoEditorId(String(issue.external_key))} className="text-left hover:text-primary hover:underline line-clamp-2">
                        {String(issue.summary ?? '')}
                      </button>
                    )}
                  </td>
                  {dynamicCols.map(col => (
                    <td key={col.fieldId} className="p-2 whitespace-nowrap">{renderCell(issue, col)}</td>
                  ))}
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {integration.provider === 'jira' ? (
                        <button type="button" onClick={() => setEditorKey(String(issue.external_key))} className="text-muted-foreground hover:text-primary" title={t('agile_boards.edit_in_effectime')}>
                          <Pencil className="h-3 w-3" />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setAdoEditorId(String(issue.external_key))} className="text-muted-foreground hover:text-primary" title={t('agile_boards.edit_in_effectime')}>
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {issue.url && (
                        <a href={String(issue.url)} target="_blank" rel="noreferrer" className="text-primary hover:underline" title={t('backlog_browser.open_external')}>
                          <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            {issues.length > 0 ? t('backlog_browser.showing_count', { count: issues.length }) : ''}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{t('backlog_browser.page_size_label')}:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                <SelectItem value="0">{t('backlog_browser.page_size_all')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
