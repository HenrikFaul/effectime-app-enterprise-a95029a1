import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Server } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface System {
  id: string;
  name: string;
  kind: 'internal' | 'external';
  description: string | null;
  archived_at: string | null;
}

export function AccessSystems({ workspaceId, isAdmin }: Props) {
  const t = useT();
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'external' | 'internal'>('external');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('enterprise_access_systems')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('name');
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[access_systems] load error', error.message);
      setSystems([]);
    } else {
      setSystems((data as System[]) || []);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from('enterprise_access_systems')
      .insert({ workspace_id: workspaceId, name: name.trim(), kind });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName('');
    toast.success(t('common.save'));
    load();
  };

  const handleSeed = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('seed_default_access_systems', { p_workspace_id: workspaceId });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success('Seeded'); load(); }
  };

  const handleArchive = async (id: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_access_systems')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('access.systems_description')}</p>

      {isAdmin ? (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('common.name')}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jira" />
            </div>
            <div className="min-w-[140px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Kind</label>
              <Select value={kind} onValueChange={(v) => setKind(v as 'external' | 'internal')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="external">{t('access.kind_external')}</SelectItem>
                  <SelectItem value="internal">{t('access.kind_internal')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={busy || !name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> {t('access.add_system')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSeed} disabled={busy}>
              {t('access.seed_systems')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : systems.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{t('common.empty')}</div>
      ) : (
        <div className="space-y-1">
          {systems.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm flex-1">{s.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {s.kind === 'internal' ? t('access.kind_internal') : t('access.kind_external')}
              </Badge>
              {isAdmin ? (
                <Button variant="ghost" size="sm" onClick={() => handleArchive(s.id)} aria-label={t('common.archive')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
