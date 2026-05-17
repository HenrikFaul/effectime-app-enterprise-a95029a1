import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Database, RefreshCw, Save, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationMini { id: string; provider: 'jira' | 'azure_devops'; selected_field_ids: string[] }
interface FieldRow {
  field_id: string;
  field_name: string;
  field_type: string | null;
  is_custom: boolean;
}

// Same mapping as BacklogBrowser — field reference name → enterprise_agile_issues column
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

// Columns to check for "used" detection in enterprise_agile_issues (must all exist in the table)
const USAGE_COLS = 'issue_type,status,assignee_name,priority,story_points,iteration_path,due_date,description,labels,created_at,external_updated_at';

export function FieldDiscovery({
  integration,
  onSelectionChange,
}: {
  integration: IntegrationMini;
  onSelectionChange?: () => void;
}) {
  const { t } = useI18n();
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [showUsedOnly, setShowUsedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(integration.selected_field_ids ?? []),
  );
  // Columns that have at least one non-null value in the cached issues
  const [usedCols, setUsedCols] = useState<Set<string>>(new Set());
  // Which specific work-item-type names appear in cached issues
  const [usedIssueTypes, setUsedIssueTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set(integration.selected_field_ids ?? []));
  }, [integration.id]);

  const load = async () => {
    const { data } = await supabase
      .from('enterprise_agile_field_metadata')
      .select('field_id,field_name,field_type,is_custom')
      .eq('integration_id', integration.id)
      .order('is_custom', { ascending: true })
      .order('field_name', { ascending: true });
    setFields((data as FieldRow[]) ?? []);
  };

  // Detect which columns have data in the cached issues for this integration
  const detectUsedFields = async () => {
    const { data } = await (supabase as any)
      .from('enterprise_agile_issues')
      .select(USAGE_COLS)
      .eq('integration_id', integration.id)
      .limit(200);
    if (!data || data.length === 0) return;
    const cols = new Set<string>();
    const types = new Set<string>();
    const colNames = USAGE_COLS.split(',');
    for (const row of data as Record<string, unknown>[]) {
      for (const col of colNames) {
        const val = row[col];
        if (val != null && val !== '' && val !== false) cols.add(col);
      }
      if (row.issue_type) types.add(String(row.issue_type));
    }
    setUsedCols(cols);
    setUsedIssueTypes(types);
  };

  useEffect(() => {
    load();
    detectUsedFields();
  }, [integration.id]);

  const discover = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'discover_fields', integration_id: integration.id },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? t('field_discovery.bad_response'));
      toast.success(t('field_discovery.fields_discovered', { count: (data as any).count } as any));
      await load();
    } catch (e: any) {
      toast.error('Hiba: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const saveSelection = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('enterprise_workspace_integrations')
        .update({ selected_field_ids: [...selectedIds] })
        .eq('id', integration.id);
      if (error) throw error;
      toast.success(t('field_discovery.selection_saved'));
      onSelectionChange?.();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (fieldId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId); else next.add(fieldId);
      return next;
    });
  };

  // Select all currently visible "used" fields at once
  const selectAllUsed = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const f of fields) {
        if (isUsed(f)) next.add(f.field_id);
      }
      return next;
    });
  };

  // Select / deselect all currently filtered (visible) fields
  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const f of filtered) next.add(f.field_id);
      return next;
    });
  };

  const deselectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const f of filtered) next.delete(f.field_id);
      return next;
    });
  };

  // Returns true if this field has actual data in cached issues
  const isUsed = (f: FieldRow): boolean => {
    if (usedCols.size === 0) return false; // cache not yet loaded
    if (f.field_type === 'workitemtype') return usedIssueTypes.has(f.field_name);
    if (f.field_id === 'ado.iterations') return usedCols.has('iteration_path');
    const col = FIELD_TO_COL[f.field_id];
    return col ? usedCols.has(col) : false;
  };

  const hasUsageData = usedCols.size > 0 || usedIssueTypes.size > 0;

  let filtered = fields.filter(
    (f) => !filter || f.field_name.toLowerCase().includes(filter.toLowerCase()) || f.field_id.toLowerCase().includes(filter.toLowerCase()),
  );
  if (showUsedOnly) filtered = filtered.filter(isUsed);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" /> {t('field_discovery.card_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder={t('field_discovery.filter_placeholder')}
            className="h-8 text-xs flex-1 min-w-[160px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button size="sm" onClick={discover} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {t('field_discovery.btn_discover')}
          </Button>
          <Button size="sm" variant="secondary" onClick={saveSelection} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {t('field_discovery.btn_save_selection')}
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({t('field_discovery.n_selected', { count: selectedIds.size } as any)})
            </span>
          </Button>
        </div>

        {/* ── Bulk selection row ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={selectAllVisible}>
            {t('field_discovery.btn_select_all_visible')}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={deselectAllVisible}>
            {t('field_discovery.btn_deselect_all')}
          </Button>
        </div>

        {/* Used-only toggle + select-all-used */}
        {hasUsageData && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={showUsedOnly ? 'default' : 'outline'}
              className="h-7 text-[10px] gap-1"
              onClick={() => setShowUsedOnly(v => !v)}
            >
              <CheckCircle2 className="h-3 w-3" />
              {showUsedOnly ? t('field_discovery.btn_show_all_fields') : t('field_discovery.btn_show_used_only')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] gap-1"
              onClick={selectAllUsed}
            >
              {t('field_discovery.btn_select_all_used')}
            </Button>
            <span className="text-[10px] text-muted-foreground">{t('field_discovery.used_hint')}</span>
          </div>
        )}

        <div className="border rounded-md overflow-hidden max-h-[480px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs min-w-[420px]">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-2 w-10">{t('field_discovery.col_board')}</th>
                {hasUsageData && (
                  <th className="text-left p-2 w-20">{t('field_discovery.col_used')}</th>
                )}
                <th className="text-left p-2">{t('field_discovery.col_name')}</th>
                <th className="text-left p-2">Field ID</th>
                <th className="text-left p-2">{t('field_discovery.col_type')}</th>
                <th className="text-left p-2">Custom</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={hasUsageData ? 6 : 5} className="p-4 text-center text-muted-foreground">
                  {t('field_discovery.no_fields_hint')}
                </td></tr>
              )}
              {filtered.map((f) => {
                const used = isUsed(f);
                return (
                  <tr key={f.field_id} className={`border-t ${used ? '' : 'opacity-70'}`}>
                    <td className="p-2">
                      <Checkbox
                        checked={selectedIds.has(f.field_id)}
                        onCheckedChange={() => toggleField(f.field_id)}
                        className="h-3.5 w-3.5"
                      />
                    </td>
                    {hasUsageData && (
                      <td className="p-2">
                        {used
                          ? <span title={t('field_discovery.col_used')}><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /></span>
                          : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                        }
                      </td>
                    )}
                    <td className="p-2 font-medium">{f.field_name}</td>
                    <td className="p-2 font-mono text-[10px]">{f.field_id}</td>
                    <td className="p-2">{f.field_type ?? '—'}</td>
                    <td className="p-2">
                      {f.is_custom && <Badge variant="secondary" className="text-[10px]">custom</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
