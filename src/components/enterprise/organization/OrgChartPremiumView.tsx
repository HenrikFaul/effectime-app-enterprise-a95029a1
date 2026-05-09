/**
 * OrgChartPremiumView — premium card-based hierarchy view
 *
 * Layout model:
 *  - Parent card centred above its children row
 *  - Vertical drop: 1px line from card bottom → horizontal bar
 *  - Horizontal bar: spans from centre of first child column → centre of last child column
 *    (calculated as left: CARD_HALF, right: CARD_HALF for fixed-width 192px cards)
 *  - Each child gets a 1px vertical stub from the bar → its own card
 *  - Clicking a card opens the right-side EmployeeDrawer
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  ChevronUp,
  X,
  Users,
  MapPin,
  Briefcase,
  Building2,
  Star,
  CalendarDays,
  UserCircle,
} from 'lucide-react';

// ─── constants ────────────────────────────────────────────────────────────────

/** Fixed card width in px — must match the w-48 (192px) class on PremiumCard */
const CARD_W = 192;
const CARD_HALF = CARD_W / 2; // 96

/** Gap between sibling columns in px — must match gap-6 (24px) */
const SIBLING_GAP = 24;
void SIBLING_GAP;

// ─── colour palette ───────────────────────────────────────────────────────────

const AVATAR_PALETTE: [string, string][] = [
  ['#10b981', '#0d9488'], // emerald → teal
  ['#38bdf8', '#6366f1'], // sky → indigo
  ['#e879f9', '#a855f7'], // fuchsia → purple
  ['#fbbf24', '#f97316'], // amber → orange
  ['#fb7185', '#ec4899'], // rose → pink
  ['#a3e635', '#22c55e'], // lime → green
  ['#22d3ee', '#3b82f6'], // cyan → blue
  ['#8b5cf6', '#6366f1'], // violet → indigo
];

function paletteFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
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

interface DrawerPayload {
  node: PremiumNode;
  managerName: string | null;
  orgUnitName: string | null;
  skillCount: number;
}

interface ViewProps {
  tree: PremiumNode[];
  matches: (n: PremiumNode) => boolean;
  isAnyVisible: (n: PremiumNode) => boolean;
  workspaceId: string;
  allNodes: PremiumNode[];
}

// ─── root component ───────────────────────────────────────────────────────────

export function OrgChartPremiumView({
  tree,
  matches,
  isAnyVisible,
  workspaceId,
  allNodes,
}: ViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<DrawerPayload | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrgUnitMap>({});
  const drawerOpen = drawer !== null;

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

  const toggle = useCallback((id: string) => {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }, []);

  const openDrawer = useCallback(
    async (node: PremiumNode) => {
      // same node → close
      if (drawer?.node.id === node.id) { setDrawer(null); return; }

      const managerNode = node.manager_id ? allNodes.find((n) => n.id === node.manager_id) : null;
      const managerName = managerNode?.display_name ?? null;
      const orgUnitName = node.org_unit_id ? (orgUnits[node.org_unit_id] ?? null) : null;

      const { count } = await (supabase as any)
        .from('enterprise_member_skills')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('membership_id', node.id);

      setDrawer({ node, managerName, orgUnitName, skillCount: count ?? 0 });
    },
    [allNodes, orgUnits, workspaceId, drawer],
  );

  const visibleRoots = tree.filter(isAnyVisible);

  return (
    <div className="relative flex overflow-hidden rounded-xl border border-border/40">
      {/* ── chart surface ── */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: 'hsl(var(--background))' }}
      >
        {/* subtle grid background */}
        <div
          className="min-w-max min-h-full px-10 py-10"
          style={{
            backgroundImage:
              'radial-gradient(circle, hsl(var(--border) / 0.3) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        >
          {/* roots row */}
          <div className="flex flex-row items-start gap-6 justify-center">
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
      </div>

      {/* ── side drawer ── */}
      <EmployeeDrawer data={drawer} onClose={() => setDrawer(null)} isOpen={drawerOpen} />
    </div>
  );
}

// ─── recursive branch ─────────────────────────────────────────────────────────

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
  const unitName = node.org_unit_id ? orgUnits[node.org_unit_id] : null;

  return (
    <div className="flex flex-col items-center">
      {/* ── node card ── */}
      <PremiumCard
        node={node}
        unitName={unitName}
        dim={dim}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        isSelected={isSelected}
        onToggle={() => onToggle(node.id)}
        onSelect={() => onSelect(node)}
      />

      {/* ── connector + children ── */}
      {hasChildren && !isCollapsed && (
        <ChildrenConnector visibleChildren={visibleChildren}>
          {visibleChildren.map((child) => (
            <div key={child.id} className="flex flex-col items-center">
              {/* stub from horizontal bar down to child */}
              <div className="w-px h-6" style={{ background: 'hsl(var(--border) / 0.5)' }} />
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
        </ChildrenConnector>
      )}
    </div>
  );
}

// ─── connector (vertical drop + optional horizontal bar) ─────────────────────

function ChildrenConnector({
  visibleChildren,
  children,
}: {
  visibleChildren: PremiumNode[];
  children: React.ReactNode;
}) {
  const onlyOne = visibleChildren.length === 1;
  const connectorRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* vertical drop from parent card bottom */}
      <div className="w-px h-6" style={{ background: 'hsl(var(--border) / 0.5)' }} />

      {/* children row with horizontal bar */}
      <div ref={connectorRef} className="relative flex items-start gap-6">
        {/* horizontal bar spanning first-child-centre → last-child-centre */}
        {!onlyOne && (
          <div
            className="absolute top-0 h-px pointer-events-none"
            style={{
              left: `${CARD_HALF}px`,
              right: `${CARD_HALF}px`,
              background: 'hsl(var(--border) / 0.5)',
            }}
          />
        )}
        {children}
      </div>
    </>
  );
}

// ─── node card ────────────────────────────────────────────────────────────────

interface CardProps {
  node: PremiumNode;
  unitName: string | null;
  dim: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function PremiumCard({
  node,
  unitName,
  dim,
  hasChildren,
  isCollapsed,
  isSelected,
  onToggle,
  onSelect,
}: CardProps) {
  const [c1, c2] = paletteFor(node.user_id);
  const init = initials(node.display_name);

  return (
    <div
      className={[
        'group relative w-48 rounded-2xl cursor-pointer select-none',
        'transition-all duration-200',
        'border',
        isSelected
          ? 'border-primary/60 shadow-lg shadow-primary/10'
          : 'border-border/40 shadow-sm',
        'hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5',
        dim ? 'opacity-40' : '',
      ].join(' ')}
      style={{ background: 'hsl(var(--card))' }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-pressed={isSelected}
      aria-label={`${node.display_name} megnyitása`}
    >
      {/* coloured accent bar */}
      <div
        className="h-[3px] w-full rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}
      />

      <div className="px-3 pt-2.5 pb-1 flex items-start gap-2.5">
        {/* avatar */}
        <div className="flex-shrink-0 mt-px">
          {node.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={node.avatar_url}
              alt={node.display_name}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-border/60"
            />
          ) : (
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-1 ring-white/10"
              style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
            >
              {init}
            </div>
          )}
        </div>

        {/* text */}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight truncate text-foreground">
            {node.display_name}
          </p>
          <p className="text-[11px] leading-snug truncate mt-0.5"
             style={{ color: 'hsl(var(--muted-foreground))' }}>
            {node.business_role || node.role || '—'}
          </p>
        </div>
      </div>

      {/* meta row */}
      <div className="px-3 pb-2.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0 flex-wrap">
          {unitName && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium max-w-[100px] truncate"
              style={{
                background: 'hsl(var(--muted) / 0.8)',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              <Building2 className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{unitName}</span>
            </span>
          )}
          {node.reportsCount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: 'hsl(var(--muted) / 0.8)',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              <Users className="h-2.5 w-2.5" />
              {node.reportsCount}
            </span>
          )}
        </div>

        {hasChildren && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="flex-shrink-0 rounded-full p-0.5 transition-colors hover:bg-accent"
            style={{ color: 'hsl(var(--muted-foreground))' }}
            aria-label={isCollapsed ? 'Kibontás' : 'Összecsukás'}
          >
            {isCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── employee detail drawer ───────────────────────────────────────────────────

interface DrawerProps {
  data: DrawerPayload | null;
  onClose: () => void;
  isOpen: boolean;
}

function EmployeeDrawer({ data, onClose, isOpen }: DrawerProps) {
  return (
    <div
      className="flex-shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-in-out border-l border-border/40"
      style={{ width: isOpen ? '296px' : '0px', opacity: isOpen ? 1 : 0 }}
    >
      {data && (
        <div className="w-[296px] h-full flex flex-col" style={{ background: 'hsl(var(--card))' }}>
          <DrawerHeader node={data.node} onClose={onClose} />
          <ScrollArea className="flex-1">
            <DrawerBody data={data} />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function DrawerHeader({ node, onClose }: { node: PremiumNode; onClose: () => void }) {
  const [c1, c2] = paletteFor(node.user_id);
  const init = initials(node.display_name);

  return (
    <div className="border-b border-border/40">
      {/* accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }} />

      <div className="flex items-start justify-between px-4 pt-3 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {node.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={node.avatar_url}
              alt={node.display_name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-border/60 flex-shrink-0"
            />
          ) : (
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ring-2 ring-white/10"
              style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
            >
              {init}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{node.display_name}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {node.business_role || node.role || '—'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0 ml-2"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DrawerBody({ data }: { data: DrawerPayload }) {
  const { node, managerName, orgUnitName, skillCount } = data;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* basic info section */}
      <section className="space-y-2.5">
        {orgUnitName && (
          <DrawerField icon={<Building2 className="h-3.5 w-3.5" />} label="Szervezeti egység" value={orgUnitName} />
        )}
        {node.team && (
          <DrawerField icon={<Users className="h-3.5 w-3.5" />} label="Csapat" value={node.team} />
        )}
        {node.role && (
          <DrawerField icon={<Briefcase className="h-3.5 w-3.5" />} label="Szerepkör" value={node.role} />
        )}
        <DrawerField
          icon={<Star className="h-3.5 w-3.5" />}
          label="Vezető"
          value={managerName ?? '—'}
        />
      </section>

      <Divider />

      {/* team section */}
      <section className="space-y-2.5">
        <DrawerField
          icon={<Users className="h-3.5 w-3.5" />}
          label="Közvetlen beosztottak"
          value={
            node.children.length > 0
              ? `${node.children.length} közvetlen${node.reportsCount > node.children.length ? ` (összesen ${node.reportsCount})` : ''}`
              : 'Nincs'
          }
        />
      </section>

      {/* direct reports mini list */}
      {node.children.length > 0 && (
        <div className="space-y-1.5">
          {node.children.slice(0, 6).map((child) => (
            <MiniPersonRow key={child.id} node={child} />
          ))}
          {node.children.length > 6 && (
            <p className="text-[10px] text-center py-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              + {node.children.length - 6} további
            </p>
          )}
        </div>
      )}

      <Divider />

      {/* extra info section */}
      <section className="space-y-2.5">
        {(node.city || node.location) && (
          <DrawerField
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Helyszín"
            value={node.city || node.location || '—'}
          />
        )}
        {skillCount > 0 && (
          <DrawerField
            icon={<Star className="h-3.5 w-3.5" />}
            label="Készségek"
            value={`${skillCount} bejegyzett készség`}
          />
        )}
        {node.joined_at && (
          <DrawerField
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="Csatlakozott"
            value={new Date(node.joined_at).toLocaleDateString('hu-HU', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        )}
      </section>
    </div>
  );
}

function DrawerField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {label}
        </p>
        <p className="text-[12px] font-medium truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function MiniPersonRow({ node }: { node: PremiumNode }) {
  const [c1, c2] = paletteFor(node.user_id);
  const init = initials(node.display_name);
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2 py-1.5"
      style={{ background: 'hsl(var(--muted) / 0.4)' }}
    >
      {node.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={node.avatar_url}
          alt={node.display_name}
          className="h-6 w-6 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          {init}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium truncate">{node.display_name}</p>
        <p className="text-[10px] truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {node.business_role || node.role || '—'}
        </p>
      </div>
      {node.reportsCount > 0 && (
        <Badge variant="outline" className="text-[9px] ml-auto flex-shrink-0 h-4 px-1">
          <UserCircle className="h-2.5 w-2.5 mr-0.5" />
          {node.reportsCount}
        </Badge>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px" style={{ background: 'hsl(var(--border) / 0.5)' }} />;
}
