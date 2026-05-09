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
 *
 * Pan / Zoom:
 *  - Mouse drag to pan (click-vs-drag distinguished by 6px threshold)
 *  - Mouse wheel to zoom
 *  - Zoom +/- buttons at bottom center (Google Maps style)
 *  - Reset button returns to 100% / (0,0)
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
  Plus,
  Minus,
  RotateCcw,
} from 'lucide-react';

// ─── constants ────────────────────────────────────────────────────────────────

/** Fixed card width in px — must match the w-48 (192px) class on PremiumCard */
const CARD_W = 192;
const CARD_HALF = CARD_W / 2; // 96

/** Gap between sibling columns in px — must match gap-6 (24px) */
const SIBLING_GAP = 24;
void SIBLING_GAP;

/** Pan / Zoom limits */
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.15;
/** Pixel threshold: mouse must move more than this to count as a drag vs click */
const DRAG_THRESHOLD = 6;

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
  /** CSS height of the chart canvas (default: '520px'). Pass taller value for popup mode. */
  containerHeight?: string;
}

// ─── root component ───────────────────────────────────────────────────────────

export function OrgChartPremiumView({
  tree,
  matches,
  isAnyVisible,
  workspaceId,
  allNodes,
  containerHeight = '520px',
}: ViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<DrawerPayload | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrgUnitMap>({});

  // ── Pan / Zoom state ──────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Drag tracking (mutable refs to avoid stale closure issues)
  const isDragging = useRef(false);
  const hasDragged = useRef(false);   // true once mouse moved > threshold
  const lastPos = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

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

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    hasDragged.current = false;
    lastPos.current = { x: e.clientX, y: e.clientY };
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    const totalDx = Math.abs(e.clientX - dragStart.current.x);
    const totalDy = Math.abs(e.clientY - dragStart.current.y);
    if (totalDx > DRAG_THRESHOLD || totalDy > DRAG_THRESHOLD) {
      hasDragged.current = true;
    }
    setOffsetX((x) => x + dx);
    setOffsetY((y) => y + dy);
  }, []);

  const stopDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = false;
    e.currentTarget.style.cursor = 'grab';
  }, []);

  // Capture-phase click: swallow the event when the user dragged (prevents card open)
  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (hasDragged.current) {
      e.stopPropagation();
      hasDragged.current = false;
    }
  }, []);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, parseFloat((s + delta).toFixed(2)))));
  }, []);

  // ── Zoom buttons ──────────────────────────────────────────────────────────
  const zoomIn  = () => setScale((s) => Math.min(MAX_SCALE, parseFloat((s + ZOOM_STEP).toFixed(2))));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, parseFloat((s - ZOOM_STEP).toFixed(2))));
  const resetView = () => { setScale(1); setOffsetX(0); setOffsetY(0); };

  const visibleRoots = tree.filter(isAnyVisible);

  return (
    <div className="relative flex overflow-hidden rounded-xl border border-border/40">
      {/* ── chart canvas ── */}
      <div
        className="flex-1 relative overflow-hidden select-none"
        style={{
          background: 'hsl(var(--background))',
          height: containerHeight,
          cursor: 'grab',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onClickCapture={onClickCapture}
        onWheel={onWheel}
      >
        {/* dot-grid background (fixed to container, not scrolled) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, hsl(var(--border) / 0.3) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Transformable content layer */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transformOrigin: '50% 0',
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
            // Disable transition while dragging for instant response; smooth for zoom buttons
            transition: isDragging.current ? 'none' : 'transform 0.18s ease',
            padding: '40px',
          }}
        >
          <div className="flex flex-row items-start gap-6 justify-center min-w-max">
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

        {/* ── Zoom controls (bottom-center, Google Maps style) ── */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1
                     rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm shadow-lg px-1 py-1"
          onMouseDown={(e) => e.stopPropagation()}  // don't start drag from controls
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            className="h-7 w-7 rounded-lg flex items-center justify-center
                       text-muted-foreground hover:text-foreground hover:bg-accent
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Kicsinyítés (−)"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={resetView}
            className="h-7 min-w-[52px] rounded-lg px-2 text-[11px] font-semibold
                       text-muted-foreground hover:text-foreground hover:bg-accent
                       transition-colors tabular-nums"
            title="Visszaállítás 100%-ra"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            className="h-7 w-7 rounded-lg flex items-center justify-center
                       text-muted-foreground hover:text-foreground hover:bg-accent
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Nagyítás (+)"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <div className="w-px h-4 bg-border/50 mx-0.5" />

          <button
            type="button"
            onClick={resetView}
            className="h-7 w-7 rounded-lg flex items-center justify-center
                       text-muted-foreground hover:text-foreground hover:bg-accent
                       transition-colors"
            title="Nézet visszaállítása"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>

        {/* ── Hint label (fades after first interaction) ── */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span className="text-[10px] text-muted-foreground/40 select-none">
            Húzd a diagramot • görgővel nagyíts
          </span>
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
