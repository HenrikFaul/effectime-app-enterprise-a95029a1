import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Database, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationMini { id: string; provider: 'jira' | 'azure_devops'; selected_field_ids: string[] }
interface FieldRow {
  field_id: string;
  field_name: string;
  field_type: string | null;
  is_custom: boolean;
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(integration.selected_field_ids ?? []),
  );

  // Re-initialize selectedIds when integration changes
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

  useEffect(() => { load(); }, [integration.id]);

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

  const filtered = fields.filter(
    (f) => !filter || f.field_name.toLowerCase().includes(filter.toLowerCase()) || f.field_id.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" /> {t('field_discovery.card_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder={t('field_discovery.filter_placeholder')} className="h-8 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
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
        <div className="border rounded-md overflow-hidden max-h-[480px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-2">{t('field_discovery.col_board')}</th>
                <th className="text-left p-2">{t('field_discovery.col_name')}</th>
                <th className="text-left p-2">Field ID</th>
                <th className="text-left p-2">{t('field_discovery.col_type')}</th>
                <th className="text-left p-2">Custom</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">
                  {t('field_discovery.no_fields_hint')}
                </td></tr>
              )}
              {filtered.map((f) => (
                <tr key={f.field_id} className="border-t">
                  <td className="p-2">
                    <Checkbox
                      checked={selectedIds.has(f.field_id)}
                      onCheckedChange={() => toggleField(f.field_id)}
                      className="h-3.5 w-3.5"
                    />
                  </td>
                  <td className="p-2">{f.field_name}</td>
                  <td className="p-2 font-mono text-[10px]">{f.field_id}</td>
                  <td className="p-2">{f.field_type ?? '—'}</td>
                  <td className="p-2">
                    {f.is_custom && <Badge variant="secondary" className="text-[10px]">custom</Badge>}
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
