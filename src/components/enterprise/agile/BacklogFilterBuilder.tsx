import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, X } from 'lucide-react';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  project_key: string | null;
}

interface FieldRow {
  field_id: string;
  field_name: string;
  field_type: string | null;
  schema: Record<string, unknown> | null;
}

interface UserOption {
  display_name: string | null;
  email: string | null;
  account_id: string | null;
}

interface BacklogFilterBuilderProps {
  integration: IntegrationMini;
  onSearch: (query: string) => void;
  loading: boolean;
}

export function BacklogFilterBuilder({ integration, onSearch, loading }: BacklogFilterBuilderProps) {
  const { t } = useI18n();
  const [fieldMeta, setFieldMeta] = useState<FieldRow[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [iterationPath, setIterationPath] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [textFilter, setTextFilter] = useState<string>('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('enterprise_agile_field_metadata')
      .select('field_id,field_name,field_type,schema')
      .eq('integration_id', integration.id)
      .then(({ data }) => setFieldMeta((data ?? []) as FieldRow[]));
  }, [integration.id]);

  // Load users for ADO
  useEffect(() => {
    if (integration.provider !== 'azure_devops') return;
    setUsersLoading(true);
    supabase.functions.invoke('jira-devops-proxy', {
      body: { action: 'search_assignable_users', integration_id: integration.id, params: { key: integration.project_key ?? '', query: '' } },
    }).then(({ data }) => {
      setUserOptions((data as any)?.users ?? []);
    }).catch(() => {}).finally(() => setUsersLoading(false));
  }, [integration.id, integration.provider, integration.project_key]);

  // Derived data
  const workItemTypes = fieldMeta.filter(f => f.field_type === 'workitemtype').map(f => f.field_name);
  const allStates = [...new Set(
    fieldMeta.filter(f => f.field_type === 'workitemtype')
      .flatMap(f => (f.schema as any)?.states ?? [])
  )].sort();
  const iterationPaths = ((fieldMeta.find(f => f.field_id === 'ado.iterations')?.schema as any)?.paths ?? []) as string[];

  // Jira-specific
  const jiraIssueTypes = (fieldMeta.find(f => f.field_id === 'jira.issuetypes')?.schema as any)?.options ?? [];
  const jiraStatuses = (fieldMeta.find(f => f.field_id === 'jira.statuses')?.schema as any)?.options ?? [];

  function buildAdoWiql(): string {
    const project = integration.project_key ?? 'Project';
    const conditions: string[] = [`[System.TeamProject] = '${project}'`];
    if (selectedTypes.size > 0) {
      conditions.push(`[System.WorkItemType] IN (${[...selectedTypes].map(t2 => `'${t2}'`).join(', ')})`);
    }
    if (selectedStates.size > 0) {
      conditions.push(`[System.State] IN (${[...selectedStates].map(s => `'${s}'`).join(', ')})`);
    }
    if (selectedAssignees.size > 0) {
      conditions.push(`[System.AssignedTo] IN (${[...selectedAssignees].map(a => `'${a}'`).join(', ')})`);
    }
    if (iterationPath) {
      conditions.push(`[System.IterationPath] UNDER '${iterationPath}'`);
    }
    if (dateFrom) {
      conditions.push(`[System.CreatedDate] >= '${dateFrom}'`);
    }
    if (dateTo) {
      conditions.push(`[System.CreatedDate] <= '${dateTo}'`);
    }
    if (textFilter) {
      conditions.push(`[System.Title] CONTAINS '${textFilter.replace(/'/g, "''")}'`);
    }
    return `SELECT [System.Id] FROM WorkItems WHERE ${conditions.join(' AND ')} ORDER BY [System.ChangedDate] DESC`;
  }

  function buildJql(): string {
    const project = integration.project_key ?? 'PROJ';
    const conditions: string[] = [`project = ${project}`];
    if (selectedTypes.size > 0) {
      conditions.push(`issuetype in (${[...selectedTypes].map(t2 => `"${t2}"`).join(', ')})`);
    }
    if (selectedStates.size > 0) {
      conditions.push(`status in (${[...selectedStates].map(s => `"${s}"`).join(', ')})`);
    }
    if (selectedAssignees.size > 0) {
      conditions.push(`assignee in (${[...selectedAssignees].join(', ')})`);
    }
    if (dateFrom) {
      conditions.push(`created >= "${dateFrom}"`);
    }
    if (dateTo) {
      conditions.push(`created <= "${dateTo}"`);
    }
    if (textFilter) {
      conditions.push(`summary ~ "${textFilter}"`);
    }
    return conditions.join(' AND ') + ' ORDER BY updated DESC';
  }

  function handleSearch() {
    const query = integration.provider === 'azure_devops' ? buildAdoWiql() : buildJql();
    onSearch(query);
  }

  function toggleSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  }

  const isAdo = integration.provider === 'azure_devops';

  // Jira: derive issue types and statuses from metadata
  const jiraTypeOptions: string[] = jiraIssueTypes.map((o: any) => typeof o === 'string' ? o : o.name ?? o).filter(Boolean);
  const jiraStatusOptions: string[] = jiraStatuses.map((o: any) => typeof o === 'string' ? o : o.name ?? o).filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Work item type / Issue type */}
      {(isAdo ? workItemTypes : jiraTypeOptions).length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_work_item_type')}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {(isAdo ? workItemTypes : jiraTypeOptions).map((type: string) => (
              <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedTypes.has(type)}
                  onCheckedChange={() => setSelectedTypes(toggleSet(selectedTypes, type))}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">{type}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* State / Status */}
      {(isAdo ? allStates : jiraStatusOptions).length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_state')}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {(isAdo ? allStates : jiraStatusOptions).map((state: string) => (
              <label key={state} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedStates.has(state)}
                  onCheckedChange={() => setSelectedStates(toggleSet(selectedStates, state))}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">{state}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Assignee */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('backlog_browser.filter_assignee')}</Label>
        {usersLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {t('backlog_browser.loading_users')}
          </div>
        ) : userOptions.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-h-32 overflow-y-auto border rounded p-2">
            {userOptions.map((u, idx) => {
              const label = u.display_name ?? u.email ?? u.account_id ?? `User ${idx}`;
              const value = u.display_name ?? u.email ?? '';
              return (
                <label key={u.account_id ?? idx} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={selectedAssignees.has(value)}
                    onCheckedChange={() => value && setSelectedAssignees(toggleSet(selectedAssignees, value))}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">{label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">{t('backlog_browser.no_users')}</p>
        )}
      </div>

      {/* Iteration path (ADO only) */}
      {isAdo && iterationPaths.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_iteration')}</Label>
          <Select value={iterationPath} onValueChange={setIterationPath}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('backlog_browser.all_iterations')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('backlog_browser.all_iterations')}</SelectItem>
              {iterationPaths.map((p: string) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Date range */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('backlog_browser.filter_date_created')}</Label>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-40" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-40" />
        </div>
      </div>

      {/* Text search */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('backlog_browser.filter_text')}</Label>
        <Input
          value={textFilter}
          onChange={(e) => setTextFilter(e.target.value)}
          placeholder={t('backlog_browser.filter_text_placeholder')}
          className="h-8 text-xs"
        />
      </div>

      {/* Active filters summary */}
      {(selectedTypes.size > 0 || selectedStates.size > 0 || selectedAssignees.size > 0 || iterationPath || dateFrom || dateTo || textFilter) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[...selectedTypes].map(t2 => (
            <Badge key={t2} variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setSelectedTypes(toggleSet(selectedTypes, t2))}>
              {t2} <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {[...selectedStates].map(s => (
            <Badge key={s} variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setSelectedStates(toggleSet(selectedStates, s))}>
              {s} <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {[...selectedAssignees].map(a => (
            <Badge key={a} variant="outline" className="text-[10px] gap-1 cursor-pointer" onClick={() => setSelectedAssignees(toggleSet(selectedAssignees, a))}>
              @{a} <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
        </div>
      )}

      <Button size="sm" onClick={handleSearch} disabled={loading} className="gap-1">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
        {t('backlog_browser.search')}
      </Button>
    </div>
  );
}
