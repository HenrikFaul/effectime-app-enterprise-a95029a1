import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Network,
  Users,
  List,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';
import { OrgChartPremiumView, PremiumNode } from './OrgChartPremiumView';
import { MemberProfileSheet } from '../MemberProfileSheet';

type ViewStyle = 'tree' | 'premium' | 'list';

const VIEW_STYLE_KEY = 'org_chart_view_style';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
  /** When provided, the MemberProfileSheet's "Bővebb adatok" deep-links can switch top-level workspace tabs. */
  onNavigateTab?: (tab: string) => void;
  /** Current authenticated user id (used by MemberProfileSheet for self-only sections such as notification prefs). */
  userId?: string;
}

interface Membership {
  id: string;
  user_id: string;
  manager_id: string | null;
  org_unit_id: string | null;
  role: string | null;
  status: string;
  business_role: string | null;
  location: string | null;
  city: string | null;
  team: string | null;
  joined_at: string | null;
  office_id?: string | null;
}

interface ProfileMap {
  [userId: string]: { display_name: string; avatar_url?: string | null };
}

interface Node extends Membership {
  display_name: string;
  avatar_url?: string | null;
  children: Node[];
  depth: number;
  reportsCount: number;
}

const AVATAR_PALETTE = [
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-indigo-600',
  'from-fuchsia-400 to-purple-600',
  'from-amber-400 to-orange-600',
  'from-rose-400 to-pink-600',
  'from-lime-400 to-green-600',
  'from-cyan-400 to-blue-600',
  'from-violet-400 to-indigo-600',
];

function paletteFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function OrgChart({ workspaceId, isAdmin, onNavigateTab, userId }: Props) {
  const t = useT();
  const [members, setMembers] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [profileMember, setProfileMember] = useState<any | null>(null);
  const [view, setView] = useState<ViewStyle>(() => {
    try {
      const saved = localStorage.getItem(VIEW_STYLE_KEY);
      if (saved === 'tree' || saved === 'premium' || saved === 'list') return saved;
    } catch {
      // localStorage unavailable
    }
    return 'premium';
  });
  void isAdmin;

  const setViewAndPersist = (v: ViewStyle) => {
    setView(v);
    try { localStorage.setItem(VIEW_STYLE_KEY, v); } catch { /* ignore */ }
  };

  const load = useCallback(async () => {
    setLoading(true);

    const { data: memberships, error } = await (supabase as any)
      .from('enterprise_memberships')
      .select('id, user_id, manager_id, org_unit_id, role, status, business_role, location, city, team, joined_at, office_id')
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
        .select('user_id, display_name, avatar_url')
        .in('user_id', ids);
      const map: ProfileMap = {};
      (prof || []).forEach((p: any) => {
        map[p.user_id] = {
          display_name: p.display_name || 'Unknown',
          avatar_url: p.avatar_url,
        };
      });
      setProfiles(map);
    }

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
    const enriched = members.map<Node>((m) => ({
      ...m,
      display_name: profiles[m.user_id]?.display_name ?? 'Unknown',
      avatar_url: profiles[m.user_id]?.avatar_url ?? null,
      children: [],
      depth: 0,
      reportsCount: 0,
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
    const setDepthsAndCounts = (n: Node, depth: number): number => {
      n.depth = depth;
      let sum = n.children.length;
      n.children.forEach((c) => {
        sum += setDepthsAndCounts(c, depth + 1);
      });
      n.reportsCount = sum;
      return sum;
    };
    roots.forEach((r) => setDepthsAndCounts(r, 0));
    const sortRec = (arr: Node[]) => {
      arr.sort((a, b) => b.reportsCount - a.reportsCount || a.display_name.localeCompare(b.display_name));
      arr.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }, [members, profiles]);

  // flatten all nodes for premium view lookups
  const allNodes = useMemo<Node[]>(() => {
    const flat: Node[] = [];
    const visit = (n: Node) => { flat.push(n); n.children.forEach(visit); };
    tree.forEach(visit);
    return flat;
  }, [tree]);

  // Membership rows in the shape MemberProfileSheet expects.
  // PremiumNode → Member: same primary fields plus optional office_id pulled from the raw membership row.
  const allMembersForProfile = useMemo(() => {
    const officeById = new Map(members.map((m) => [m.id, m.office_id ?? null] as const));
    return allNodes.map((n) => ({
      id: n.id,
      user_id: n.user_id,
      role: n.role || 'member',
      status: n.status,
      team: n.team,
      location: n.location,
      business_role: n.business_role,
      joined_at: n.joined_at,
      display_name: n.display_name,
      city: n.city,
      office_id: officeById.get(n.id) ?? null,
    }));
  }, [allNodes, members]);

  const openProfileFor = (node: PremiumNode) => {
    const found = allMembersForProfile.find((m) => m.id === node.id);
    if (found) setProfileMember(found);
  };

  const filterTerm = search.trim().toLowerCase();
  const matches = (n: Node): boolean => {
    if (!filterTerm) return true;
    return (
      n.display_name.toLowerCase().includes(filterTerm) ||
      (n.business_role || '').toLowerCase().includes(filterTerm) ||
      (n.role || '').toLowerCase().includes(filterTerm) ||
      (n.team || '').toLowerCase().includes(filterTerm)
    );
  };
  const isAnyVisible = (n: Node): boolean => matches(n) || n.children.some(isAnyVisible);

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const handleRegenerate = async () => {
    const payload = {
      generated_client_at: new Date().toISOString(),
      roots: tree.map(stripChildren),
      member_count: members.length,
    };
    const { error } = await (supabase as any)
      .from('enterprise_org_chart_snapshots')
      .insert({ workspace_id: workspaceId, payload });
    if (!error) setSnapshotAt(new Date().toISOString());
  };

  return (
    <div className="space-y-4" data-help-region="workspace.organization">
      <p className="text-sm text-muted-foreground">{t('organization.chart.description')}</p>

      {/* ── toolbar ── */}
      <Card className="border-primary/10 bg-gradient-to-br from-card to-card/60">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          {/* search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="h-9"
            />
          </div>

          {/* view style switcher */}
          <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
            <Button
              variant={view === 'premium' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setViewAndPersist('premium')}
              title={t('organization.chart.view_premium')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('organization.chart.view_premium')}</span>
            </Button>
            <Button
              variant={view === 'tree' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setViewAndPersist('tree')}
              title={t('organization.chart.view_tree')}
            >
              <Network className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('organization.chart.view_tree')}</span>
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setViewAndPersist('list')}
              title={t('organization.chart.view_list')}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('organization.chart.view_list')}</span>
            </Button>
          </div>

          {/* member count + snapshot */}
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {members.length} {t('organization.chart.members')}
            {snapshotAt ? ` · ${new Date(snapshotAt).toLocaleString()}` : ''}
          </div>

          {view === 'premium' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setFullscreenOpen(true)}
              title={t('org_chart_panel.open_full_view_title')}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('org_chart_panel.full_view_label')}</span>
            </Button>
          )}

          <Button onClick={handleRegenerate} size="sm" variant="outline" className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('organization.chart.regenerate')}
          </Button>
        </CardContent>
      </Card>

      {/* ── fullscreen popup ── */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-border/40">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('organization.chart.title') || 'Szervezeti diagram'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-2">
            <OrgChartPremiumView
              tree={tree as PremiumNode[]}
              matches={matches as (n: PremiumNode) => boolean}
              isAnyVisible={isAnyVisible as (n: PremiumNode) => boolean}
              workspaceId={workspaceId}
              allNodes={allNodes as PremiumNode[]}
              containerHeight="calc(90vh - 80px)"
              onOpenMemberProfile={openProfileFor}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── content ── */}
      {loading ? (
        <OrgChartSkeleton />
      ) : members.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{t('organization.chart.no_data')}</div>
      ) : view === 'premium' ? (
        <OrgChartPremiumView
          tree={tree as PremiumNode[]}
          matches={matches as (n: PremiumNode) => boolean}
          isAnyVisible={isAnyVisible as (n: PremiumNode) => boolean}
          workspaceId={workspaceId}
          allNodes={allNodes as PremiumNode[]}
          onOpenMemberProfile={openProfileFor}
        />
      ) : view === 'tree' ? (
        <div className="org-chart-scroll relative overflow-x-auto rounded-xl border bg-gradient-to-b from-muted/20 via-background to-background p-6">
          <div className="flex flex-row items-start gap-8 min-w-max justify-center">
            {tree.filter(isAnyVisible).map((root) => (
              <TreeBranch
                key={root.id}
                node={root}
                collapsed={collapsed}
                onToggle={toggle}
                matches={matches}
                isAnyVisible={isAnyVisible}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {tree.map((r) => (
            <ListNode
              key={r.id}
              node={r}
              depth={0}
              collapsed={collapsed}
              onToggle={toggle}
              matches={matches}
              isAnyVisible={isAnyVisible}
            />
          ))}
        </div>
      )}

      <MemberProfileSheet
        open={!!profileMember}
        onOpenChange={(o) => !o && setProfileMember(null)}
        member={profileMember}
        workspaceId={workspaceId}
        allMembers={allMembersForProfile as any}
        isAdmin={isAdmin}
        showEmail={!!userId && profileMember?.user_id === userId}
        onNavigateTab={(tab) => {
          if (onNavigateTab) {
            setProfileMember(null);
            setFullscreenOpen(false);
            onNavigateTab(tab);
          }
        }}
      />
    </div>
  );
}

/* ─── skeleton loading state ─────────────────────────────────────────────── */

function OrgChartSkeleton() {
  return (
    <div className="rounded-xl border bg-gradient-to-b from-muted/10 via-background to-background p-8 overflow-hidden">
      <div className="flex flex-col items-center gap-5 animate-pulse">
        <div className="w-48 h-20 rounded-xl bg-muted/60" />
        <div className="w-px h-5 bg-muted/40" />
        <div className="flex gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-5">
              <div className="w-px h-5 bg-muted/40" />
              <div className="w-48 h-20 rounded-xl bg-muted/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── classic tree view (unchanged) ─────────────────────────────────────── */

interface BranchProps {
  node: Node;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  matches: (n: Node) => boolean;
  isAnyVisible: (n: Node) => boolean;
}

function TreeBranch({ node, collapsed, onToggle, matches, isAnyVisible }: BranchProps) {
  const isCollapsed = collapsed[node.id] === true;
  const visibleChildren = node.children.filter(isAnyVisible);
  const hasChildren = visibleChildren.length > 0;
  const dim = !matches(node);

  return (
    <div className="flex flex-col items-center">
      <PersonCard
        node={node}
        dim={dim}
        canToggle={hasChildren}
        collapsed={isCollapsed}
        onToggle={() => onToggle(node.id)}
      />

      {hasChildren && !isCollapsed && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="relative flex items-start gap-6 pt-0">
            {visibleChildren.length > 1 && (
              <div
                className="absolute top-0 left-6 right-6 h-px bg-border"
                aria-hidden="true"
              />
            )}
            {visibleChildren.map((child) => (
              <div key={child.id} className="flex flex-col items-center pt-0">
                <div className="w-px h-6 bg-border" />
                <TreeBranch
                  node={child}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  matches={matches}
                  isAnyVisible={isAnyVisible}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface CardProps {
  node: Node;
  dim?: boolean;
  canToggle?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

function PersonCard({ node, dim, canToggle, collapsed, onToggle }: CardProps) {
  const t = useT();
  const grad = paletteFor(node.user_id);
  const init = initials(node.display_name);

  return (
    <div
      className={[
        'group relative w-[220px] rounded-xl border bg-card/80 backdrop-blur-sm',
        'shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200',
        'border-border hover:border-primary/40',
        dim ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className={`h-1 w-full rounded-t-xl bg-gradient-to-r ${grad}`} />

      <div className="p-3 flex items-center gap-3">
        {node.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.avatar_url}
            alt={node.display_name}
            className="h-11 w-11 rounded-full object-cover ring-2 ring-background shadow"
          />
        ) : (
          <div
            className={`h-11 w-11 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-sm font-bold ring-2 ring-background shadow`}
          >
            {init}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{node.display_name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {node.business_role || '—'}
          </div>
        </div>
      </div>

      <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {node.role && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {node.role}
            </Badge>
          )}
          {node.children.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-0.5">
              <Users className="h-2.5 w-2.5" />
              {node.children.length}
              {node.reportsCount > node.children.length && (
                <span className="opacity-60">/{node.reportsCount}</span>
              )}
            </Badge>
          )}
        </div>
        {canToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-muted-foreground hover:text-primary rounded-md p-0.5 hover:bg-accent transition-colors"
            aria-label={collapsed ? t('org_chart_panel.expand_aria') : t('org_chart_panel.collapse_aria')}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── list view (unchanged) ──────────────────────────────────────────────── */

interface ListProps {
  node: Node;
  depth: number;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  matches: (n: Node) => boolean;
  isAnyVisible: (n: Node) => boolean;
}

function ListNode({ node, depth, collapsed, onToggle, matches, isAnyVisible }: ListProps) {
  const visibleChildren = node.children.filter(isAnyVisible);
  const isCollapsed = collapsed[node.id] === true;
  const grad = paletteFor(node.user_id);
  const init = initials(node.display_name);

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 rounded-lg border bg-card/70 px-2 py-1.5 hover:bg-accent/40 transition-colors ${
          matches(node) ? '' : 'opacity-60'
        }`}
        style={{ marginLeft: depth * 24 }}
      >
        {visibleChildren.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="text-muted-foreground hover:text-primary"
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <div
          className={`h-7 w-7 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-[10px] font-bold`}
        >
          {init}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{node.display_name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {node.business_role || '—'}
          </div>
        </div>
        {node.children.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            <Users className="h-2.5 w-2.5 mr-0.5" /> {node.children.length}
          </Badge>
        )}
      </div>
      {!isCollapsed && visibleChildren.map((c) => (
        <ListNode
          key={c.id}
          node={c}
          depth={depth + 1}
          collapsed={collapsed}
          onToggle={onToggle}
          matches={matches}
          isAnyVisible={isAnyVisible}
        />
      ))}
    </div>
  );
}

function stripChildren(n: Node): any {
  const { children, ...rest } = n;
  return { ...rest, children: children.map(stripChildren) };
}
