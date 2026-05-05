import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface Unit {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  unit_type: string | null;
  archived_at: string | null;
  sort_order: number;
}

export function OrgStructure({ workspaceId, isAdmin }: Props) {
  const t = useT();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('enterprise_org_units')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('sort_order')
      .order('name');
    if (error) {
      // Table may not exist yet; show empty rather than crash
      // eslint-disable-next-line no-console
      console.warn('[org_units] load error', error.message);
      setUnits([]);
    } else {
      setUnits((data as Unit[]) || []);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const { error } = await (supabase as any).from('enterprise_org_units').insert({
      workspace_id: workspaceId,
      name: name.trim(),
      parent_id: parentId || null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName('');
    setParentId('');
    toast.success(t('common.save'));
    load();
  };

  const handleArchive = async (id: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_org_units')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  // Build a simple tree
  const childrenOf = (parent: string | null) =>
    units.filter((u) => (u.parent_id || null) === parent).sort((a, b) => a.sort_order - b.sort_order);

  const renderNode = (u: Unit, depth: number) => {
    const kids = childrenOf(u.id);
    return (
      <div key={u.id} className="space-y-1">
        <div
          className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
          style={{ marginLeft: depth * 16 }}
        >
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm flex-1">{u.name}</span>
          {u.unit_type ? <Badge variant="outline" className="text-[10px]">{u.unit_type}</Badge> : null}
          {isAdmin ? (
            <Button variant="ghost" size="sm" onClick={() => handleArchive(u.id)} aria-label={t('common.archive')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
        {kids.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  const roots = childrenOf(null);

  return (
    <div className="space-y-3" data-help-region="workspace.organization">
      <p className="text-sm text-muted-foreground">{t('organization.structure.description')}</p>

      {isAdmin ? (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('organization.structure.unit_name')}
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" />
            </div>
            <div className="min-w-[180px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('organization.structure.parent_unit')}
              </label>
              <Select value={parentId || '__none'} onValueChange={(v) => setParentId(v === '__none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('organization.structure.no_parent')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t('organization.structure.no_parent')}</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={creating || !name.trim()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> {t('organization.structure.add_unit')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : roots.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{t('organization.structure.empty')}</div>
      ) : (
        <div className="space-y-1">{roots.map((r) => renderNode(r, 0))}</div>
      )}
    </div>
  );
}
