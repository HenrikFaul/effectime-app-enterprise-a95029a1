import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationMini { id: string; provider: 'jira' | 'azure_devops' }
interface FieldRow {
  field_id: string;
  field_name: string;
  field_type: string | null;
  is_custom: boolean;
}

export function FieldDiscovery({ integration }: { integration: IntegrationMini }) {
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

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
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? 'Hibás válasz');
      toast.success(`${(data as any).count} mező felfedezve`);
      await load();
    } catch (e: any) {
      toast.error('Hiba: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const filtered = fields.filter(
    (f) => !filter || f.field_name.toLowerCase().includes(filter.toLowerCase()) || f.field_id.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" /> Mezők (custom field discovery)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Szűrés név/ID alapján…" className="h-8 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button size="sm" onClick={discover} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Felfedezés
          </Button>
        </div>
        <div className="border rounded-md overflow-hidden max-h-[480px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-2">Név</th>
                <th className="text-left p-2">Field ID</th>
                <th className="text-left p-2">Típus</th>
                <th className="text-left p-2">Custom</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">
                  Még nincs mező. Nyomj „Felfedezés"-t.
                </td></tr>
              )}
              {filtered.map((f) => (
                <tr key={f.field_id} className="border-t">
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
