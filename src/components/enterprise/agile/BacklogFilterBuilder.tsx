import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X } from 'lucide-react';
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

// ── Color helpers ──────────────────────────────────────────────────────────────

const TYPE_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#ec4899', '#3b82f6', '#84cc16'];

function typeColor(idx: number): string {
  return TYPE_COLORS[idx % TYPE_COLORS.length];
}

function stateColor(s: string): string {
  const l = s.toLowerCase();
  if (['done', 'closed', 'resolved', 'complete', "won't"].some(d => l.includes(d))) return '#22c55e';
  if (['active', 'in progress', 'doing', 'development', 'review', 'code'].some(d => l.includes(d))) return '#06b6d4';
  if (['blocked', 'impediment', 'hold', 'stalled', 'waiting'].some(d => l.includes(d))) return '#ef4444';
  if (['new', 'to do', 'open', 'backlog', 'ready'].some(d => l.includes(d))) return '#8b5cf6';
  return '#6b7280';
}

function priorityColor(p: string): string {
  const l = String(p).toLowerCase();
  if (l === '1' || l === 'critical' || l === 'highest') return '#ef4444';
  if (l === '2' || l === 'high') return '#f97316';
  if (l === '3' || l === 'medium') return '#eab308';
  if (l === '4' || l === 'low') return '#22c55e';
  return '#6b7280';
}

function nameToHsl(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 60%, 52%)`;
}

function countBy(items: Record<string, unknown>[], key: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const item of items) {
    const v = item[key] as string;
    if (v) m[v] = (m[v] ?? 0) + 1;
  }
  return m;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  count?: number;
  selected: boolean;
  color?: string;
  weight?: number;
  onClick: () => void;
}

function FilterChip({ label, count, selected, color = '#6366f1', weight = 1, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all duration-150 border',
        selected
          ? 'text-white border-transparent'
          : 'bg-background border-border/60 hover:border-border hover:bg-accent/40 text-foreground',
      )}
      style={selected
        ? { background: color, borderColor: color, boxShadow: `0 0 10px ${color}55, 0 0 3px ${color}` }
        : { opacity: 0.45 + weight * 0.55 }
      }
    >
      <span className="truncate max-w-[100px]">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn(
          'text-[9px] px-1 rounded-full shrink-0',
          selected ? 'bg-white/25 text-white' : 'bg-muted/80 text-muted-foreground',
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

function SignalMeter({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? (current / total) * 100 : 100;
  const color = pct > 60 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-muted/50 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 4px ${color}80` }}
        />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground shrink-0 tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}

const CHIP_LIMIT = 8;

// ── Main component ─────────────────────────────────────────────────────────────

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
  const [chipSearch, setChipSearch] = useState('');
  const [showAllSection, setShowAllSection] = useState<Set<string>>(new Set());
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

  // ── Counts from loaded issues ────────────────────────────────────────────────
  const typeCounts = useMemo(() => countBy(issues, 'issue_type'), [issues]);
  const stateCounts = useMemo(() => countBy(issues, 'status'), [issues]);
  const priorityCounts = useMemo(() => countBy(issues, 'priority'), [issues]);
  const iterCounts = useMemo(() => countBy(issues, 'iteration_path'), [issues]);
  const assigneeCounts = useMemo(() => countBy(issues, 'assignee_name'), [issues]);

  // ── Derived options ──────────────────────────────────────────────────────────
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

  // ── Visibility flags ─────────────────────────────────────────────────────────
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

  // ── Load users ───────────────────────────────────────────────────────────────
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

  // ── WIQL / JQL assembly (unchanged) ─────────────────────────────────────────
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

  function toggleShowAll(id: string) {
    setShowAllSection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const hasActiveFilters =
    selectedTypes.size > 0 || selectedStates.size > 0 || selectedPriorities.size > 0 ||
    selectedAssignees.size > 0 || !!iterationPath || !!dateFrom || !!dateTo || !!textFilter;

  function clearAll() {
    setSelectedTypes(new Set());
    setSelectedStates(new Set());
    setSelectedPriorities(new Set());
    setSelectedAssignees(new Set());
    setIterationPath('');
    setDateFrom('');
    setDateTo('');
    setTextFilter('');
  }

  // ── Preset actions ───────────────────────────────────────────────────────────
  function applyPresetInFlight() {
    const kw = ['active', 'in progress', 'doing', 'development', 'review', 'code'];
    const matching = stateOptions.filter(s => kw.some(k => s.toLowerCase().includes(k)));
    setSelectedStates(new Set(matching.length ? matching : ['Active', 'In Progress']));
    setSelectedTypes(new Set()); setSelectedPriorities(new Set()); setSelectedAssignees(new Set()); setIterationPath('');
  }

  function applyPresetCritical() {
    if (isAdo) {
      setSelectedPriorities(new Set(['1', '2']));
    } else {
      const kw = ['critical', 'high', 'highest'];
      const matching = priorityOptions.filter(p => kw.some(k => p.toLowerCase().includes(k)));
      setSelectedPriorities(new Set(matching.length ? matching : ['Critical', 'High']));
    }
    setSelectedTypes(new Set()); setSelectedStates(new Set()); setSelectedAssignees(new Set()); setIterationPath('');
  }

  function applyPresetUnblocked() {
    const blockedKw = ['blocked', 'impediment', 'hold', 'stalled', 'waiting'];
    const unblocked = stateOptions.filter(s => !blockedKw.some(k => s.toLowerCase().includes(k)));
    setSelectedStates(new Set(unblocked.length ? unblocked : stateOptions));
    setSelectedTypes(new Set()); setSelectedPriorities(new Set()); setSelectedAssignees(new Set()); setIterationPath('');
  }

  // ── Filter pipeline computation ──────────────────────────────────────────────
  const funnelStats = useMemo(() => {
    if (!hasActiveFilters || issues.length === 0) return null;
    const total = issues.length;
    const afterType = selectedTypes.size > 0
      ? issues.filter(i => selectedTypes.has(i.issue_type as string)).length
      : null;
    const afterState = selectedStates.size > 0
      ? issues.filter(i =>
          (selectedTypes.size === 0 || selectedTypes.has(i.issue_type as string)) &&
          selectedStates.has(i.status as string)
        ).length
      : null;
    const final = issues.filter(i => {
      if (selectedTypes.size > 0 && !selectedTypes.has(i.issue_type as string)) return false;
      if (selectedStates.size > 0 && !selectedStates.has(i.status as string)) return false;
      if (selectedPriorities.size > 0 && !selectedPriorities.has(i.priority as string)) return false;
      if (selectedAssignees.size > 0 && !selectedAssignees.has(i.assignee_name as string)) return false;
      if (iterationPath && i.iteration_path !== iterationPath) return false;
      if (textFilter && !(i.title as string || '').toLowerCase().includes(textFilter.toLowerCase())) return false;
      return true;
    }).length;
    return { total, afterType, afterState, final };
  }, [issues, selectedTypes, selectedStates, selectedPriorities, selectedAssignees, iterationPath, textFilter, hasActiveFilters]);

  // ── Chip search helper ───────────────────────────────────────────────────────
  function applyChipSearch(opts: string[]): string[] {
    if (!chipSearch) return opts;
    return opts.filter(o => o.toLowerCase().includes(chipSearch.toLowerCase()));
  }

  // ── Chip section renderer ────────────────────────────────────────────────────
  function renderChipSection(
    id: string,
    label: string,
    sectionColor: string,
    opts: string[],
    selected: Set<string>,
    onToggle: (v: string) => void,
    counts: Record<string, number>,
    getChipColor: (v: string, idx: number) => string,
  ) {
    const nonEmpty = opts.filter(v => (counts[v] ?? 0) > 0);
    const pool = nonEmpty.length > 0 ? nonEmpty : opts;
    const filtered = applyChipSearch(pool);
    if (filtered.length === 0) return null;
    const maxCount = Math.max(...filtered.map(v => counts[v] ?? 0), 1);
    const showAll = showAllSection.has(id);
    const visible = showAll ? filtered : filtered.slice(0, CHIP_LIMIT);
    const hidden = filtered.length - CHIP_LIMIT;
    return (
      <div>
        <div className="flex items-center gap-2 mb-1.5 mt-3">
          <div className="w-0.5 h-3 rounded-full shrink-0" style={{ background: sectionColor }} />
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {visible.map((v, localIdx) => {
            const cnt = counts[v] ?? 0;
            const weight = maxCount > 0 ? cnt / maxCount : 0;
            const globalIdx = opts.indexOf(v);
            return (
              <FilterChip
                key={v}
                label={v}
                count={cnt > 0 ? cnt : undefined}
                selected={selected.has(v)}
                color={getChipColor(v, globalIdx >= 0 ? globalIdx : localIdx)}
                weight={weight}
                onClick={() => onToggle(v)}
              />
            );
          })}
        </div>
        {!showAll && hidden > 0 && (
          <button type="button" className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleShowAll(id)}>
            +{hidden} {t('backlog_browser.filter_show_empty', { count: hidden })}
          </button>
        )}
        {showAll && filtered.length > CHIP_LIMIT && (
          <button type="button" className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleShowAll(id)}>
            {t('backlog_browser.filter_hide_empty')}
          </button>
        )}
      </div>
    );
  }

  const signalCurrent = funnelStats ? funnelStats.final : issues.length;
  const signalTotal = issues.length;

  return (
    <div className="space-y-3">

      {/* CONTROL SURFACE header + signal meter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
            {t('backlog_browser.control_surface')}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors"
              onClick={clearAll}
            >
              {t('backlog_browser.clear_all')} ×
            </button>
          )}
        </div>
        {signalTotal > 0 && (
          <SignalMeter current={signalCurrent} total={signalTotal} />
        )}
      </div>

      {/* Cross-category chip search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        <Input
          className="h-7 pl-7 pr-6 text-[11px] bg-muted/30 border-border/50"
          placeholder={t('backlog_browser.chip_search_placeholder')}
          value={chipSearch}
          onChange={e => setChipSearch(e.target.value)}
        />
        {chipSearch && (
          <button
            type="button"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setChipSearch('')}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Quick presets */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-0.5 h-3 rounded-full shrink-0 bg-amber-500" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {t('backlog_browser.presets')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={applyPresetInFlight}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-cyan-500/40 bg-cyan-500/5 text-cyan-500 hover:bg-cyan-500/15 transition-colors"
          >
            ⚡ {t('backlog_browser.preset_inflight')}
          </button>
          <button
            type="button"
            onClick={applyPresetCritical}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-red-500/40 bg-red-500/5 text-red-500 hover:bg-red-500/15 transition-colors"
          >
            🔴 {t('backlog_browser.preset_critical')}
          </button>
          <button
            type="button"
            onClick={applyPresetUnblocked}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-emerald-500/40 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/15 transition-colors"
          >
            🎯 {t('backlog_browser.preset_unblocked')}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="rounded-md border border-border/40 bg-muted/15 p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-3 rounded-full bg-primary shrink-0" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {t('backlog_browser.active_filters')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[...selectedTypes].map(v => (
              <span key={v} onClick={() => setSelectedTypes(toggleSet(selectedTypes, v))}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white cursor-pointer"
                style={{ background: '#8b5cf6', boxShadow: '0 0 6px #8b5cf660' }}>
                {v} <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {[...selectedStates].map(v => (
              <span key={v} onClick={() => setSelectedStates(toggleSet(selectedStates, v))}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white cursor-pointer"
                style={{ background: stateColor(v), boxShadow: `0 0 6px ${stateColor(v)}60` }}>
                {v} <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {[...selectedPriorities].map(v => (
              <span key={v} onClick={() => setSelectedPriorities(toggleSet(selectedPriorities, v))}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white cursor-pointer"
                style={{ background: priorityColor(v), boxShadow: `0 0 6px ${priorityColor(v)}60` }}>
                P{v} <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {[...selectedAssignees].map(v => (
              <span key={v} onClick={() => setSelectedAssignees(toggleSet(selectedAssignees, v))}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white cursor-pointer"
                style={{ background: nameToHsl(v), boxShadow: `0 0 6px ${nameToHsl(v)}60` }}>
                @{v.split(' ')[0]} <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {iterationPath && (
              <span onClick={() => setIterationPath('')}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white cursor-pointer"
                style={{ background: '#f59e0b', boxShadow: '0 0 6px #f59e0b60' }}>
                {iterationPath.split('\\').pop()} <X className="h-2.5 w-2.5" />
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white cursor-pointer"
                style={{ background: '#10b981', boxShadow: '0 0 6px #10b98160' }}>
                {dateFrom}{dateFrom && dateTo ? '→' : ''}{dateTo} <X className="h-2.5 w-2.5" />
              </span>
            )}
            {textFilter && (
              <span onClick={() => setTextFilter('')}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white cursor-pointer"
                style={{ background: '#f97316', boxShadow: '0 0 6px #f9731660' }}>
                "{textFilter}" <X className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter pipeline */}
      {funnelStats && (
        <div className="rounded-md border border-border/30 bg-muted/10 px-2.5 py-2">
          <div className="flex items-center gap-1 flex-wrap font-mono text-[10px]">
            <span className="text-foreground font-bold tabular-nums">{funnelStats.total}</span>
            {funnelStats.afterType !== null && (
              <>
                <span className="text-muted-foreground">──▶</span>
                <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: '#8b5cf620', color: '#a78bfa' }}>
                  T:{funnelStats.afterType}
                </span>
              </>
            )}
            {funnelStats.afterState !== null && (
              <>
                <span className="text-muted-foreground">──▶</span>
                <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: '#06b6d420', color: '#22d3ee' }}>
                  S:{funnelStats.afterState}
                </span>
              </>
            )}
            <span className="text-muted-foreground">──▶</span>
            <span className="text-foreground font-bold tabular-nums">{funnelStats.final}</span>
            <span className="text-muted-foreground">{t('backlog_browser.funnel_results')}</span>
          </div>
        </div>
      )}

      {/* TYPE chips */}
      {showTypeFilter && renderChipSection(
        'type', t('backlog_browser.section_type'), '#8b5cf6',
        typeOptions, selectedTypes,
        v => setSelectedTypes(toggleSet(selectedTypes, v)),
        typeCounts, (_v, idx) => typeColor(idx),
      )}

      {/* STATE chips */}
      {showStateFilter && renderChipSection(
        'state', t('backlog_browser.section_state'), '#06b6d4',
        stateOptions, selectedStates,
        v => setSelectedStates(toggleSet(selectedStates, v)),
        stateCounts, v => stateColor(v),
      )}

      {/* PRIORITY chips */}
      {showPriorityFilter && renderChipSection(
        'priority', t('backlog_browser.section_priority'), '#f97316',
        priorityOptions, selectedPriorities,
        v => setSelectedPriorities(toggleSet(selectedPriorities, v)),
        priorityCounts, v => priorityColor(v),
      )}

      {/* ASSIGNEE chips */}
      {showAssigneeFilter && (
        <div>
          <div className="flex items-center gap-2 mb-1.5 mt-3">
            <div className="w-0.5 h-3 rounded-full shrink-0 bg-pink-500" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {t('backlog_browser.section_assignee')}
            </span>
          </div>
          {usersLoading ? (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('backlog_browser.loading_users')}
            </div>
          ) : userOptions.length > 0 ? (() => {
            const allLabels = userOptions.map(u => u.display_name ?? u.email ?? '').filter(Boolean);
            const pool = applyChipSearch(allLabels);
            const maxCnt = Math.max(...pool.map(v => assigneeCounts[v] ?? 0), 1);
            const showAll = showAllSection.has('assignee');
            const visible = showAll ? pool : pool.slice(0, CHIP_LIMIT);
            const hidden = pool.length - CHIP_LIMIT;
            return (
              <div>
                <div className="flex flex-wrap gap-1">
                  {visible.map(label => {
                    const cnt = assigneeCounts[label] ?? 0;
                    return (
                      <FilterChip
                        key={label}
                        label={label}
                        count={cnt > 0 ? cnt : undefined}
                        selected={selectedAssignees.has(label)}
                        color={nameToHsl(label)}
                        weight={maxCnt > 0 ? cnt / maxCnt : 0}
                        onClick={() => setSelectedAssignees(toggleSet(selectedAssignees, label))}
                      />
                    );
                  })}
                </div>
                {!showAll && hidden > 0 && (
                  <button type="button" className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleShowAll('assignee')}>
                    +{hidden} {t('backlog_browser.filter_show_empty', { count: hidden })}
                  </button>
                )}
                {showAll && pool.length > CHIP_LIMIT && (
                  <button type="button" className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleShowAll('assignee')}>
                    {t('backlog_browser.filter_hide_empty')}
                  </button>
                )}
              </div>
            );
          })() : (
            <p className="text-[10px] text-muted-foreground">{t('backlog_browser.no_users')}</p>
          )}
        </div>
      )}

      {/* ITERATION chips (ADO only) */}
      {showIterationFilter && iterPathOptions.length > 0 && (() => {
        const nonEmpty = iterPathOptions.filter(v => (iterCounts[v] ?? 0) > 0);
        const pool = nonEmpty.length > 0 ? nonEmpty : iterPathOptions;
        const filtered = applyChipSearch(pool);
        if (filtered.length === 0) return null;
        const maxCnt = Math.max(...filtered.map(v => iterCounts[v] ?? 0), 1);
        const showAll = showAllSection.has('iteration');
        const visible = showAll ? filtered : filtered.slice(0, CHIP_LIMIT);
        const hidden = filtered.length - CHIP_LIMIT;
        return (
          <div>
            <div className="flex items-center gap-2 mb-1.5 mt-3">
              <div className="w-0.5 h-3 rounded-full shrink-0 bg-amber-500" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                {t('backlog_browser.section_iteration')}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {visible.map(p => {
                const cnt = iterCounts[p] ?? 0;
                return (
                  <FilterChip
                    key={p}
                    label={p.split('\\').pop() ?? p}
                    count={cnt > 0 ? cnt : undefined}
                    selected={iterationPath === p}
                    color="#f59e0b"
                    weight={maxCnt > 0 ? cnt / maxCnt : 0}
                    onClick={() => setIterationPath(iterationPath === p ? '' : p)}
                  />
                );
              })}
            </div>
            {!showAll && hidden > 0 && (
              <button type="button" className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleShowAll('iteration')}>
                +{hidden} {t('backlog_browser.filter_show_empty', { count: hidden })}
              </button>
            )}
            {showAll && filtered.length > CHIP_LIMIT && (
              <button type="button" className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleShowAll('iteration')}>
                {t('backlog_browser.filter_hide_empty')}
              </button>
            )}
          </div>
        );
      })()}

      {/* DATE RANGE */}
      {showDateFilter && (
        <div>
          <div className="flex items-center gap-2 mb-1.5 mt-3">
            <div className="w-0.5 h-3 rounded-full shrink-0 bg-emerald-500" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {t('backlog_browser.section_date')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-[11px] flex-1 min-w-0" />
            <span className="text-muted-foreground text-xs shrink-0">→</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-[11px] flex-1 min-w-0" />
          </div>
        </div>
      )}

      {/* TEXT SEARCH */}
      {showTextFilter && (
        <div>
          <div className="flex items-center gap-2 mb-1.5 mt-3">
            <div className="w-0.5 h-3 rounded-full shrink-0 bg-orange-500" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {t('backlog_browser.section_text')}
            </span>
          </div>
          <Input
            value={textFilter}
            onChange={e => setTextFilter(e.target.value)}
            placeholder={t('backlog_browser.filter_text_placeholder')}
            className="h-7 text-[11px]"
          />
        </div>
      )}

      {/* Execute query */}
      <Button size="sm" onClick={handleSearch} disabled={loading} className="w-full gap-1.5 mt-2">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        {t('backlog_browser.search')}
      </Button>
    </div>
  );
}
