import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  X,
  Users,
  MapPin,
  Briefcase,
  Building2,
  Star,
  CalendarDays,
} from 'lucide-react';

// ─── shared helpers (duplicated from OrgChart to keep components independent) ───

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

// ─── types ────────────────────────────────────────────────────────────────────

export interface PremiumNode {
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
  display_name: string;
  avatar_url?: string | null;
  children: PremiumNode[];
  depth: number;
  reportsCount: number;
}

interface OrgUnitMap {
  [id: string]: string;
}

interface DrawerData {
  node: PremiumNode;
  managerName: string | null;
  orgUnitName: string | null;
  skillCount: number;
}

interface Props {
  tree: PremiumNode[];
  matches: (n: PremiumNode) => boolean;
  isAnyVisible: (n: PremiumNode) => boolean;
  workspaceId: string;
  allNodes: PremiumNode[];
}

// ─── main premium view ────────────────────────────────────────────────────────

export function OrgChartPremiumView({ tree, matches, isAnyVisible, workspaceId, allNodes }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<DrawerData | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrgUnitMap>({});

  useEffect(() => {
    (supabase as any)
      .from('enterprise_org_units')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .then(({ data }: any) => {
        const map: OrgUnitMap = {};
        (data || []).forEach((u: any) => { map[u.id] = u.name; });
        setOrgUnits(map);
      });
  }, [workspaceId]);

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const openDrawer = useCallback(
    async (node: PremiumNode) => {
      const managerNode = node.manager_id
        ? allNodes.find((n) => n.id === node.manager_id)
        : null;
      const managerName = managerNode?.display_name ?? null;
      const orgUnitName = node.org_unit_id ? (orgUnits[node.org_unit_id] ?? null) : null;

      const { count } = await (supabase as any)
        .from('enterprise_member_skills')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('membership_id', node.id);

      setDrawer({ node, managerName, orgUnitName, skillCount: count ?? 0 });
    },
    [allNodes, orgUnits, workspaceId],
  );

  const closeDrawer = () => setDrawer(null);

  const visibleRoots = tree.filter(isAnyVisible);

  return (
    <div className="relative flex gap-0 overflow-hidden">
      {/* chart surface */}
      <div
        className={[
          'org-chart-scroll flex-1 overflow-x-auto rounded-xl border',
          'bg-gradient-to-b from-muted/10 via-background to-background',
          'p-8 transition-all duration-300',
          drawer ? 'pr-4' : '',
        ].join(' ')}
      >
        <div className="flex flex-row items-start gap-10 min-w-max justify-center">
          {visibleRoots.map((root) => (
            <PremiumBranch
              key={root.id}
              node={root}
              collapsed={collapsed}
              onToggle={toggle}
              matches={matches}
              isAnyVisible={isAnyVisible}
              onSelect={openDrawer}
              selectedId={drawer?.node.id ?? null}
              orgUnits={orgUnits}
            />
          ))}
        </div>
      </div>

      {/* detail drawer */}
      <EmployeeDrawer data={drawer} onClose={closeDrawer} orgUnits={orgUnits} />
    </div>
  );
}

// ─── branch (recursive) ───────────────────────────────────────────────────────

interface BranchProps {
  node: PremiumNode;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  matches: (n: PremiumNode) => boolean;
  isAnyVisible: (n: PremiumNode) => boolean;
  onSelect: (n: PremiumNode) => void;
  selectedId: string | null;
  orgUnits: OrgUnitMap;
}

function PremiumBranch({
  node,
  collapsed,
  onToggle,
  matches,
  isAnyVisible,
  onSelect,
  selectedId,
  orgUnits,
}: BranchProps) {
  const isCollapsed = collapsed[node.id] === true;
  const visibleChildren = node.children.filter(isAnyVisible);
  const hasChildren = visibleChildren.length > 0;
  const dim = !matches(node);
  const isSelected = selectedId === node.id;

  return (
    <div className="flex flex-col items-center">
      <PremiumCard
        node={node}
        dim={dim}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        isSelected={isSelected}
        onToggle={() => onToggle(node.id)}
        onSelect={() => onSelect(node)}
        orgUnits={orgUnits}
      />

      {hasChildren && !isCollapsed && (
        <>
          {/* vertical drop from card bottom */}
          <div className="w-px h-5 bg-border/60" />

          {/* horizontal + child columns */}
          <div className="relative flex items-start gap-8">
            {visibleChildren.length > 1 && (
              <div
                className="absolute top-0 left-[calc(50%_-_1px_+_theme(spacing.16))] right-[calc(50%_-_1px_+_theme(spacing.16))] h-px bg-border/60"
                style={{
                  left: '24px',
                  right: '24px',
                }}
                aria-hidden="true"
              />
            )}
            {visibleChildren.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-border/60" />
                <PremiumBranch
                  node={child}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  matches={matches}
                  isAnyVisible={isAnyVisible}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  orgUnits={orgUnits}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── premium card ─────────────────────────────────────────────────────────────

interface CardProps {
  node: PremiumNode;
  dim?: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  orgUnits: OrgUnitMap;
}

function PremiumCard({
  node,
  dim,
  hasChildren,
  isCollapsed,
  isSelected,
  onToggle,
  onSelect,
  orgUnits,
}: CardProps) {
  const grad = paletteFor(node.user_id);
  const init = initials(node.display_name);
  const unitName = node.org_unit_id ? orgUnits[node.org_unit_id] : null;

  return (
    <div
      className={[
        'group relative w-[196px] rounded-xl border',
        'bg-card/95 backdrop-blur-sm cursor-pointer',
        'shadow-sm transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30',
        isSelected
          ? 'border-primary/50 shadow-md ring-1 ring-primary/20'
          : 'border-border/50',
        dim ? 'opacity-40' : '',
      ].join(' ')}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-label={`${node.display_name} részleteinek megnyitása`}
    >
      {/* gradient top accent */}
      <div className={`h-0.5 w-full rounded-t-xl bg-gradient-to-r ${grad}`} />

      <div className="p-3 flex items-start gap-2.5">
        {/* avatar */}
        <div className="flex-shrink-0 mt-0.5">
          {node.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={node.avatar_url}
              alt={node.display_name}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-border shadow-sm"
            />
          ) : (
            <div
              className={`h-9 w-9 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-[11px] font-bold ring-1 ring-border/50 shadow-sm`}
            >
              {init}
            </div>
          )}
        </div>

        {/* text block */}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-tight truncate text-foreground">
            {node.display_name}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
            {node.business_role || node.role || '—'}
          </div>
        </div>
      </div>

      {/* meta row */}
      <div className="px-3 pb-3 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {unitName && (
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 max-w-[100px] truncate font-normal"
            >
              <Building2 className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
              <span className="truncate">{unitName}</span>
            </Badge>
          )}
          {hasChildren && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 gap-0.5 font-normal"
            >
              <Users className="h-2.5 w-2.5" />
              {node.children.length}
              {node.reportsCount > node.children.length && (
                <span className="opacity-50">/{node.reportsCount}</span>
              )}
            </Badge>
          )}
        </div>

        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex-shrink-0 text-muted-foreground hover:text-primary rounded p-0.5 hover:bg-accent/60 transition-colors"
            aria-label={isCollapsed ? 'Kibontás' : 'Összecsukás'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── employee detail drawer ───────────────────────────────────────────────────

interface DrawerProps {
  data: DrawerData | null;
  onClose: () => void;
  orgUnits: OrgUnitMap;
}

function EmployeeDrawer({ data, onClose, orgUnits }: DrawerProps) {
  const isOpen = data !== null;

  return (
    <div
      className={[
        'flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out',
        isOpen ? 'w-[300px] opacity-100' : 'w-0 opacity-0',
      ].join(' ')}
    >
      {data && (
        <div className="w-[300px] h-full flex flex-col border-l bg-card/95 backdrop-blur-sm rounded-r-xl overflow-y-auto">
          {/* header */}
          <div className="flex items-start justify-between p-4 border-b">
            <div className="flex items-center gap-3 min-w-0">
              {(() => {
                const grad = paletteFor(data.node.user_id);
                const init = initials(data.node.display_name);
                return data.node.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.node.avatar_url}
                    alt={data.node.display_name}
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-border flex-shrink-0"
                  />
                ) : (
                  <div
                    className={`h-11 w-11 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-sm font-bold ring-2 ring-border/50 flex-shrink-0`}
                  >
                    {init}
                  </div>
                );
              })()}
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{data.node.display_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {data.node.business_role || data.node.role || '—'}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* body */}
          <div className="flex-1 p-4 space-y-3">
            {/* org unit */}
            {data.orgUnitName && (
              <DrawerRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Szervezeti egység"
                value={data.orgUnitName}
              />
            )}

            {/* team */}
            {data.node.team && (
              <DrawerRow
                icon={<Users className="h-3.5 w-3.5" />}
                label="Csapat"
                value={data.node.team}
              />
            )}

            {/* role */}
            {data.node.role && (
              <DrawerRow
                icon={<Briefcase className="h-3.5 w-3.5" />}
                label="Szerepkör"
                value={data.node.role}
              />
            )}

            {/* manager */}
            {data.managerName ? (
              <DrawerRow
                icon={<Star className="h-3.5 w-3.5" />}
                label="Vezető"
                value={data.managerName}
              />
            ) : (
              <DrawerRow
                icon={<Star className="h-3.5 w-3.5" />}
                label="Vezető"
                value="—"
              />
            )}

            {/* direct reports */}
            <DrawerRow
              icon={<Users className="h-3.5 w-3.5" />}
              label="Közvetlen beosztottak"
              value={
                data.node.children.length > 0
                  ? `${data.node.children.length} fő (összesen ${data.node.reportsCount})`
                  : 'Nincs'
              }
            />

            {/* location */}
            {(data.node.city || data.node.location) && (
              <DrawerRow
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Helyszín"
                value={data.node.city || data.node.location || '—'}
              />
            )}

            {/* skills */}
            {data.skillCount > 0 && (
              <DrawerRow
                icon={<Star className="h-3.5 w-3.5" />}
                label="Készségek"
                value={`${data.skillCount} bejegyzett készség`}
              />
            )}

            {/* joined */}
            {data.node.joined_at && (
              <DrawerRow
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Csatlakozott"
                value={new Date(data.node.joined_at).toLocaleDateString('hu-HU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              />
            )}

            {/* org unit map — direct reports list */}
            {data.node.children.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Közvetlen beosztottak listája
                </div>
                <div className="space-y-1.5">
                  {data.node.children.slice(0, 8).map((child) => {
                    const childGrad = paletteFor(child.user_id);
                    const childInit = initials(child.display_name);
                    return (
                      <div
                        key={child.id}
                        className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5"
                      >
                        {child.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={child.avatar_url}
                            alt={child.display_name}
                            className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`h-6 w-6 rounded-full bg-gradient-to-br ${childGrad} text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0`}
                          >
                            {childInit}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium truncate">{child.display_name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {child.business_role || child.role || '—'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {data.node.children.length > 8 && (
                    <div className="text-[10px] text-muted-foreground text-center py-1">
                      + {data.node.children.length - 8} további
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-xs font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
