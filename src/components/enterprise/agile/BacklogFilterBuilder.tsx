import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlignJustify, ChevronDown, ChevronUp, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  project_key: string | null;
  selected_field_ids: string[];
}

export interface FieldMeta {
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

type FilterLayout = 'inline' | 'accordion';

interface BacklogFilterBuilderProps {
  integration: IntegrationMini;
  fieldMeta: FieldMeta[];
  selectedFieldIds: string[];
  onSearch: (query: string) => void;
  loading: boolean;
  cachedIssueTypes?: string[];
  cachedStates?: string[];
  cachedPriorities?: string[];
  cachedIterationPaths?: string[];
  issues?: Record<string, unknown>[];
}

function countBy(items: Record<string, unknown>[], key: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const item of items) {
    const v = item[key] as string;
    if (v) m[v] = (m[v] ?? 0) + 1;
  }
  return m;
}

interface AccordionSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  label: string;
  activeCount: number;
  children: ReactNode;
}

function AccordionSection({ isOpen, onToggle, label, activeCount, children }: AccordionSectionProps) {
  return (
    <div className={cn('border-b last:border-b-0', activeCount > 0 && 'bg-primary/5')}>
      <button
        type="button"
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium hover:bg-accent/50 transition-colors',
          activeCount > 0 && 'text-primary',
        )}
        onClick={onToggle}
      >
        <span>{label}</span>
        <div className="flex items-center gap-1.5">
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20">
              {activeCount}
            </Badge>
          )}
          {isOpen
            ? <ChevronUp className="h-3.5 w-3.5 opacity-50" />
            : <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
        </div>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function BacklogFilterBuilder({
  integration,
  fieldMeta,
  selectedFieldIds,
  onSearch,
  loading,
  cachedIssueTypes = [],
  cachedStates = [],
  cachedPriorities = [],
  cachedIterationPaths = [],
  issues = [],
}: BacklogFilterBuilderProps) {
  const { t } = useI18n();
  const [filterLayout, setFilterLayout] = useState<FilterLayout>('inline');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [iterationPath, setIterationPath] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [textFilter, setTextFilter] = useState<string>('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const isAdo = integration.provider === 'azure_devops';

  // Counts derived from currently loaded issues
  const typeCounts = useMemo(() => countBy(issues, 'issue_type'), [issues]);
  const stateCounts = useMemo(() => countBy(issues, 'status'), [issues]);
  const priorityCounts = useMemo(() => countBy(issues, 'priority'), [issues]);
  const iterCounts = useMemo(() => countBy(issues, 'iteration_path'), [issues]);
  const assigneeCounts = useMemo(() => countBy(issues, 'assignee_name'), [issues]);

  // ── Derived values from field metadata (with cache fallbacks) ────────────────
  const workItemTypeFields = fieldMeta.filter(f => f.field_type === 'workitemtype');
  const allWorkItemTypeNames = workItemTypeFields.map(f => f.field_name);
  const allStates = [...new Set(
    workItemTypeFields.flatMap(f => ((f.schema as any)?.states ?? []) as string[])
  )].sort();
  const iterField = fieldMeta.find(f => f.field_id === 'ado.iterations');
  const metaIterPaths = ((iterField?.schema as any)?.paths ?? []) as string[];

  const jiraTypeOptions: string[] = ((fieldMeta.find(f => f.field_id === 'jira.issuetypes')?.schema as any)?.options ?? [])
    .map((o: any) => (typeof o === 'string' ? o : (o.name ?? o))).filter(Boolean);
  const jiraStatusOptions: string[] = ((fieldMeta.find(f => f.field_id === 'jira.statuses')?.schema as any)?.options ?? [])
    .map((o: any) => (typeof o === 'string' ? o : (o.name ?? o))).filter(Boolean);

  const typeOptions = isAdo
    ? (allWorkItemTypeNames.length ? allWorkItemTypeNames : cachedIssueTypes)
    : jiraTypeOptions;
  const stateOptions = isAdo
    ? (allStates.length ? allStates : cachedStates)
    : jiraStatusOptions;
  const iterPathOptions = metaIterPaths.length ? metaIterPaths : cachedIterationPaths;
  const priorityOptions = cachedPriorities;

  // ── Decide which filter sections to show ────────────────────────────────────
  const noSelection = selectedFieldIds.length === 0;

  const showTypeFilter = noSelection || (isAdo
    ? selectedFieldIds.some(id => id.startsWith('ado.workitemtype.') || id === 'System.WorkItemType')
    : selectedFieldIds.some(id => id === 'jira.issuetypes' || id === 'issuetype'));

  const showStateFilter = noSelection || (isAdo
    ? selectedFieldIds.includes('System.State')
    : selectedFieldIds.some(id => id === 'jira.statuses' || id === 'status'));

  const showPriorityFilter = noSelection || selectedFieldIds.some(
    id => id === 'Microsoft.VSTS.Common.Priority' || id === 'priority',
  );

  const showAssigneeFilter = noSelection || (isAdo
    ? selectedFieldIds.includes('System.AssignedTo')
    : selectedFieldIds.includes('assignee'));

  const showIterationFilter = isAdo && (noSelection || selectedFieldIds.some(
    id => id === 'ado.iterations' || id === 'System.IterationPath',
  ));

  const showDateFilter = noSelection || selectedFieldIds.some(id => {
    const meta = fieldMeta.find(f => f.field_id === id);
    return meta?.field_type === 'dateTime' || (id.toLowerCase().includes('date') && meta != null);
  });

  const showTextFilter = noSelection || selectedFieldIds.some(
    id => id === 'System.Title' || id === 'summary' ||
      ['string', 'html', 'plainText'].includes(fieldMeta.find(f => f.field_id === id)?.field_type ?? ''),
  );

  // ── Load users ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showAssigneeFilter) return;
    setUsersLoading(true);
    supabase.functions.invoke('jira-devops-proxy', {
      body: {
        action: 'search_assignable_users',
        integration_id: integration.id,
        params: { key: integration.project_key ?? '', query: '' },
      },
    }).then(({ data }) => {
      setUserOptions((data as any)?.users ?? []);
    }).catch(() => {}).finally(() => setUsersLoading(false));
  }, [integration.id, integration.provider, integration.project_key, showAssigneeFilter]);

  // ── WIQL / JQL assembly ─────────────────────────────────────────────────────
  function buildAdoWiql(): string {
    const project = integration.project_key ?? 'Project';
    const conds: string[] = [`[System.TeamProject] = '${project}'`];
    if (selectedTypes.size > 0)
      conds.push(`[System.WorkItemType] IN (${[...selectedTypes].map(v => `'${v}'`).join(', ')})`);
    if (selectedStates.size > 0)
      conds.push(`[System.State] IN (${[...selectedStates].map(v => `'${v}'`).join(', ')})`);
    if (selectedPriorities.size > 0)
      conds.push(`[Microsoft.VSTS.Common.Priority] IN (${[...selectedPriorities].join(', ')})`);
    if (selectedAssignees.size > 0)
      conds.push(`[System.AssignedTo] IN (${[...selectedAssignees].map(v => `'${v}'`).join(', ')})`);
    if (iterationPath)
      conds.push(`[System.IterationPath] UNDER '${iterationPath}'`);
    if (dateFrom)
      conds.push(`[System.CreatedDate] >= '${dateFrom}'`);
    if (dateTo)
      conds.push(`[System.CreatedDate] <= '${dateTo}'`);
    if (textFilter)
      conds.push(`[System.Title] CONTAINS '${textFilter.replace(/'/g, "''")}'`);
    return `SELECT [System.Id] FROM WorkItems WHERE ${conds.join(' AND ')} ORDER BY [System.ChangedDate] DESC`;
  }

  function buildJql(): string {
    const project = integration.project_key ?? 'PROJ';
    const conds: string[] = [`project = ${project}`];
    if (selectedTypes.size > 0)
      conds.push(`issuetype in (${[...selectedTypes].map(v => `"${v}"`).join(', ')})`);
    if (selectedStates.size > 0)
      conds.push(`status in (${[...selectedStates].map(v => `"${v}"`).join(', ')})`);
    if (selectedPriorities.size > 0)
      conds.push(`priority in (${[...selectedPriorities].map(v => `"${v}"`).join(', ')})`);
    if (selectedAssignees.size > 0)
      conds.push(`assignee in (${[...selectedAssignees].join(', ')})`);
    if (dateFrom) conds.push(`created >= "${dateFrom}"`);
    if (dateTo) conds.push(`created <= "${dateTo}"`);
    if (textFilter) conds.push(`summary ~ "${textFilter}"`);
    return conds.join(' AND ') + ' ORDER BY updated DESC';
  }

  function handleSearch() {
    onSearch(isAdo ? buildAdoWiql() : buildJql());
  }

  function toggleSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  }

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const hasActiveFilters =
    selectedTypes.size > 0 || selectedStates.size > 0 || selectedPriorities.size > 0 ||
    selectedAssignees.size > 0 || iterationPath || dateFrom || dateTo || textFilter;

  // ── INLINE LAYOUT ────────────────────────────────────────────────────────────
  const inlineLayout = (
    <div className="space-y-4">
      {showTypeFilter && typeOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_work_item_type')}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {typeOptions.map((type) => (
              <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedTypes.has(type)}
                  onCheckedChange={() => setSelectedTypes(toggleSet(selectedTypes, type))}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">
                  {type}{typeCounts[type] ? <span className="text-muted-foreground"> ({typeCounts[type]})</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {showStateFilter && stateOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_state')}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {stateOptions.map((state) => (
              <label key={state} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedStates.has(state)}
                  onCheckedChange={() => setSelectedStates(toggleSet(selectedStates, state))}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">
                  {state}{stateCounts[state] ? <span className="text-muted-foreground"> ({stateCounts[state]})</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {showPriorityFilter && priorityOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_priority')}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {priorityOptions.map((p) => (
              <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedPriorities.has(p)}
                  onCheckedChange={() => setSelectedPriorities(toggleSet(selectedPriorities, p))}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">
                  {p}{priorityCounts[p] ? <span className="text-muted-foreground"> ({priorityCounts[p]})</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {showAssigneeFilter && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_assignee')}</Label>
          {usersLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('backlog_browser.loading_users')}
            </div>
          ) : userOptions.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-h-32 overflow-y-auto border rounded p-2">
              {userOptions.map((u, idx) => {
                const label = u.display_name ?? u.email ?? `User ${idx}`;
                const value = u.display_name ?? u.email ?? '';
                const count = assigneeCounts[u.display_name ?? ''] ?? 0;
                return (
                  <label key={u.account_id ?? idx} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={selectedAssignees.has(value)}
                      onCheckedChange={() => value && setSelectedAssignees(toggleSet(selectedAssignees, value))}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-xs">
                      {label}{count ? <span className="text-muted-foreground"> ({count})</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">{t('backlog_browser.no_users')}</p>
          )}
        </div>
      )}

      {showIterationFilter && iterPathOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_iteration')}</Label>
          <Select value={iterationPath || '__all__'} onValueChange={(v) => setIterationPath(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('backlog_browser.all_iterations')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('backlog_browser.all_iterations')}</SelectItem>
              {iterPathOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}{iterCounts[p] ? ` (${iterCounts[p]})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showDateFilter && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_date_created')}</Label>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-40" />
            <span className="text-xs text-muted-foreground">—</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-40" />
          </div>
        </div>
      )}

      {showTextFilter && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('backlog_browser.filter_text')}</Label>
          <Input
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            placeholder={t('backlog_browser.filter_text_placeholder')}
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );

  // ── ACCORDION LAYOUT ─────────────────────────────────────────────────────────
  const accordionLayout = (
    <div className="border rounded-lg bg-card overflow-hidden">
      {showTypeFilter && typeOptions.length > 0 && (
        <AccordionSection
          isOpen={expandedSections.has('type')}
          onToggle={() => toggleSection('type')}
          label={t('backlog_browser.filter_work_item_type')}
          activeCount={selectedTypes.size}
        >
          <div className="space-y-0.5">
            {typeOptions.map((type) => (
              <label key={type} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer">
                <Checkbox
                  checked={selectedTypes.has(type)}
                  onCheckedChange={() => setSelectedTypes(toggleSet(selectedTypes, type))}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs flex-1">{type}</span>
                {typeCounts[type] > 0 && <span className="text-[10px] text-muted-foreground">({typeCounts[type]})</span>}
              </label>
            ))}
          </div>
        </AccordionSection>
      )}

      {showStateFilter && stateOptions.length > 0 && (
        <AccordionSection
          isOpen={expandedSections.has('state')}
          onToggle={() => toggleSection('state')}
          label={t('backlog_browser.filter_state')}
          activeCount={selectedStates.size}
        >
          <div className="space-y-0.5">
            {stateOptions.map((state) => (
              <label key={state} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer">
                <Checkbox
                  checked={selectedStates.has(state)}
                  onCheckedChange={() => setSelectedStates(toggleSet(selectedStates, state))}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs flex-1">{state}</span>
                {stateCounts[state] > 0 && <span className="text-[10px] text-muted-foreground">({stateCounts[state]})</span>}
              </label>
            ))}
          </div>
        </AccordionSection>
      )}

      {showPriorityFilter && priorityOptions.length > 0 && (
        <AccordionSection
          isOpen={expandedSections.has('priority')}
          onToggle={() => toggleSection('priority')}
          label={t('backlog_browser.filter_priority')}
          activeCount={selectedPriorities.size}
        >
          <div className="space-y-0.5">
            {priorityOptions.map((p) => (
              <label key={p} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer">
                <Checkbox
                  checked={selectedPriorities.has(p)}
                  onCheckedChange={() => setSelectedPriorities(toggleSet(selectedPriorities, p))}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs flex-1">{p}</span>
                {priorityCounts[p] > 0 && <span className="text-[10px] text-muted-foreground">({priorityCounts[p]})</span>}
              </label>
            ))}
          </div>
        </AccordionSection>
      )}

      {showAssigneeFilter && (
        <AccordionSection
          isOpen={expandedSections.has('assignee')}
          onToggle={() => toggleSection('assignee')}
          label={t('backlog_browser.filter_assignee')}
          activeCount={selectedAssignees.size}
        >
          {usersLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('backlog_browser.loading_users')}
            </div>
          ) : userOptions.length > 0 ? (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {userOptions.map((u, idx) => {
                const label = u.display_name ?? u.email ?? `User ${idx}`;
                const value = u.display_name ?? u.email ?? '';
                const count = assigneeCounts[u.display_name ?? ''] ?? 0;
                return (
                  <label key={u.account_id ?? idx} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={selectedAssignees.has(value)}
                      onCheckedChange={() => value && setSelectedAssignees(toggleSet(selectedAssignees, value))}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-xs flex-1 truncate">{label}</span>
                    {count > 0 && <span className="text-[10px] text-muted-foreground">({count})</span>}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">{t('backlog_browser.no_users')}</p>
          )}
        </AccordionSection>
      )}

      {showIterationFilter && iterPathOptions.length > 0 && (
        <AccordionSection
          isOpen={expandedSections.has('iteration')}
          onToggle={() => toggleSection('iteration')}
          label={t('backlog_browser.filter_iteration')}
          activeCount={iterationPath ? 1 : 0}
        >
          <div className="space-y-0.5">
            {iterPathOptions.map((p) => (
              <label
                key={p}
                className={cn(
                  'flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer',
                  iterationPath === p && 'bg-primary/10',
                )}
              >
                <Checkbox
                  checked={iterationPath === p}
                  onCheckedChange={() => setIterationPath(iterationPath === p ? '' : p)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs flex-1">{p}</span>
                {iterCounts[p] > 0 && <span className="text-[10px] text-muted-foreground">({iterCounts[p]})</span>}
              </label>
            ))}
          </div>
        </AccordionSection>
      )}

      {showDateFilter && (
        <AccordionSection
          isOpen={expandedSections.has('date')}
          onToggle={() => toggleSection('date')}
          label={t('backlog_browser.filter_date_created')}
          activeCount={dateFrom || dateTo ? 1 : 0}
        >
          <div className="flex items-center gap-2 pt-1">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-40" />
            <span className="text-xs text-muted-foreground">—</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-40" />
          </div>
        </AccordionSection>
      )}

      {showTextFilter && (
        <AccordionSection
          isOpen={expandedSections.has('text')}
          onToggle={() => toggleSection('text')}
          label={t('backlog_browser.filter_text')}
          activeCount={textFilter ? 1 : 0}
        >
          <Input
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            placeholder={t('backlog_browser.filter_text_placeholder')}
            className="h-8 text-xs mt-1"
          />
        </AccordionSection>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Layout toggle */}
      <div className="flex items-center gap-1 rounded-md border p-0.5 self-start w-fit">
        <Button
          variant={filterLayout === 'inline' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={() => setFilterLayout('inline')}
        >
          <SlidersHorizontal className="h-3 w-3" /> {t('backlog_browser.filter_layout_inline')}
        </Button>
        <Button
          variant={filterLayout === 'accordion' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={() => setFilterLayout('accordion')}
        >
          <AlignJustify className="h-3 w-3" /> {t('backlog_browser.filter_layout_accordion')}
        </Button>
      </div>

      {/* Filter content */}
      {filterLayout === 'inline' ? inlineLayout : accordionLayout}

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[...selectedTypes].map(v => (
            <Badge key={v} variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setSelectedTypes(toggleSet(selectedTypes, v))}>
              {v} <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {[...selectedStates].map(v => (
            <Badge key={v} variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setSelectedStates(toggleSet(selectedStates, v))}>
              {v} <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {[...selectedPriorities].map(v => (
            <Badge key={v} variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setSelectedPriorities(toggleSet(selectedPriorities, v))}>
              P{v} <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {[...selectedAssignees].map(v => (
            <Badge key={v} variant="outline" className="text-[10px] gap-1 cursor-pointer" onClick={() => setSelectedAssignees(toggleSet(selectedAssignees, v))}>
              @{v} <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {iterationPath && (
            <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer" onClick={() => setIterationPath('')}>
              {iterationPath} <X className="h-2.5 w-2.5" />
            </Badge>
          )}
        </div>
      )}

      <Button size="sm" onClick={handleSearch} disabled={loading} className="gap-1">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
        {t('backlog_browser.search')}
      </Button>
    </div>
  );
}
