import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, User as UserIcon } from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface Membership {
  id: string;
  user_id: string;
  manager_id: string | null;
  org_unit_id: string | null;
  role: string | null;
  status: string;
  business_role: string | null;
}

interface ProfileMap {
  [userId: string]: { display_name: string };
}

interface Node extends Membership {
  display_name: string;
  children: Node[];
}

export function OrgChart({ workspaceId, isAdmin }: Props) {
  const t = useT();
  const [members, setMembers] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  void isAdmin;

  const load = useCallback(async () => {
    setLoading(true);

    const { data: memberships, error } = await (supabase as any)
      .from('enterprise_memberships')
      .select('id, user_id, manager_id, org_unit_id, role, status, business_role')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[org_chart] load error', error.message);
      setMembers([]);
    } else {
      setMembers((memberships as Membership[]) || []);
    }

    const ids = ((memberships as Membership[]) || []).map((m) => m.user_id);
    if (ids.length > 0) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', ids);
      const map: ProfileMap = {};
      (prof || []).forEach((p: any) => {
        map[p.user_id] = { display_name: p.display_name || 'Unknown' };
      });
      setProfiles(map);
    }

    // Best-effort fetch latest snapshot timestamp
    const { data: snap } = await (supabase as any)
      .from('enterprise_org_chart_snapshots')
      .select('generated_at')
      .eq('workspace_id', workspaceId)
      .order('generated_at', { ascending: false })
      .limit(1);
    if (snap && snap[0]) setSnapshotAt(snap[0].generated_at);

    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo<Node[]>(() => {
    const enriched: Node[] = members.map((m) => ({
      ...m,
      display_name: profiles[m.user_id]?.display_name ?? 'Unknown',
      children: [],
    }));
    const byId = new Map(enriched.map((n) => [n.id, n] as const));
    const roots: Node[] = [];
    enriched.forEach((n) => {
      if (n.manager_id && byId.has(n.manager_id)) {
        byId.get(n.manager_id)!.children.push(n);
      } else {
        roots.push(n);
      }
    });
    return roots;
  }, [members, profiles]);

  const filterTerm = search.trim().toLowerCase();
  const matches = (n: Node): boolean => {
    if (!filterTerm) return true;
    return (
      n.display_name.toLowerCase().includes(filterTerm) ||
      (n.business_role || '').toLowerCase().includes(filterTerm)
    );
  };

  const renderNode = (n: Node, depth: number) => {
    const visibleSelf = matches(n);
    const visibleChildren = n.children.filter((c) => isAnyVisible(c));
    if (!visibleSelf && visibleChildren.length === 0) return null;
    return (
      <div key={n.id} className="space-y-1">
        <div
          className={`flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 ${
            visibleSelf ? '' : 'opacity-60'
          }`}
          style={{ marginLeft: depth * 18 }}
        >
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{n.display_name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {n.business_role || '—'}
            </div>
          </div>
          {n.children.length > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {n.children.length} {t('organization.chart.members')}
            </Badge>
          ) : null}
        </div>
        {visibleChildren.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  const isAnyVisible = (n: Node): boolean => {
    if (matches(n)) return true;
    return n.children.some(isAnyVisible);
  };

  const handleRegenerate = async () => {
    // Compose snapshot payload from current in-memory tree
    const payload = {
      generated_client_at: new Date().toISOString(),
      roots: tree.map(stripChildren),
      member_count: members.length,
    };
    const { error } = await (supabase as any)
      .from('enterprise_org_chart_snapshots')
      .insert({ workspace_id: workspaceId, payload });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[org_chart_snapshot] insert error', error.message);
    } else {
      setSnapshotAt(new Date().toISOString());
    }
  };

  const totalRendered = members.length;

  return (
    <div className="space-y-3" data-help-region="workspace.organization">
      <p className="text-sm text-muted-foreground">{t('organization.chart.description')}</p>

      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="h-8"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {totalRendered} {t('organization.chart.members')}
            {snapshotAt ? ` · ${new Date(snapshotAt).toLocaleString()}` : ''}
          </div>
          <Button onClick={handleRegenerate} size="sm" variant="outline">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t('organization.chart.regenerate')}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : members.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{t('organization.chart.no_data')}</div>
      ) : (
        <div className="space-y-1">{tree.map((r) => renderNode(r, 0))}</div>
      )}
    </div>
  );
}

function stripChildren(n: Node): any {
  const { children, ...rest } = n;
  return { ...rest, children: children.map(stripChildren) };
}
