/**
 * GiGanttIcBoard — Effectime's flagship branded planning board
 * Premium Gantt experience: hierarchy, dependencies, milestones, schedule intelligence
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Calendar, Check, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, Clock, Filter, Maximize, Minimize,
  Search, Sparkles, Users, X, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GiGanttIssueRow {
  external_key: string;
  summary: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  issue_type: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  reporter_email: string | null;
  parent_key: string | null;
  sprint_name: string | null;
  team_name: string | null;
  start_date: string | null;
  due_date: string | null;
  labels: string[] | null;
  story_points: number | null;
  url: string | null;
  original_estimate_hours?: number | null;
  remaining_hours?: number | null;
  completed_hours?: number | null;
  capacity_risk?: string | null;
}

type ZoomMode = 'week' | 'month' | 'quarter';

interface GanttNode {
  issue: GiGanttIssueRow;
  children: GanttNode[];
}

interface VisibleRow {
  issue: GiGanttIssueRow;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

interface TimelineRange {
  viewStart: string;
  totalDays: number;
}

interface HeaderSegment {
  label: string;
  xPx: number;
  widthPx: number;
  isPrimary?: boolean;
  isCurrent?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROW_H = 40;
const HEADER_H = 52;          // two-row header
const LEFT_W = 292;
const BAR_H = 20;
const MILESTONE_SIZE = 14;
const BAR_Y = Math.floor((ROW_H - BAR_H) / 2);

const DAY_PX: Record<ZoomMode, number> = {
  week:    12,   // 12 px/day → 84px/week, comfortable reading
  month:   4.5,  // 4.5px/day → ~135px/month
  quarter: 2,    // 2px/day   → ~60px/month
};

// Padding days added before/after data extent per zoom
const PAD_DAYS: Record<ZoomMode, number> = { week: 14, month: 21, quarter: 30 };

// Minimum total view span per zoom
const MIN_SPAN_DAYS: Record<ZoomMode, number> = { week: 84, month: 180, quarter: 365 };

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function fmtISO(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtISO(d);
}
function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}
function todayISO(): string { return fmtISO(new Date()); }
function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t.getTime() - y0.getTime()) / 86_400_000) + 1) / 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree Builder  (parent_key → hierarchy)
// ─────────────────────────────────────────────────────────────────────────────

function buildTree(issues: GiGanttIssueRow[]): Map<string, GanttNode> {
  const byKey = new Map<string, GanttNode>();
  for (const issue of issues) byKey.set(issue.external_key, { issue, children: [] });

  for (const node of byKey.values()) {
    const pk = node.issue.parent_key;
    if (pk && byKey.has(pk)) byKey.get(pk)!.children.push(node);
  }
  const sortFn = (a: GanttNode, b: GanttNode) =>
    (a.issue.start_date ?? a.issue.due_date ?? '9999').localeCompare(
      b.issue.start_date ?? b.issue.due_date ?? '9999',
    );
  for (const node of byKey.values()) node.children.sort(sortFn);
  return byKey;
}

function getRoots(byKey: Map<string, GanttNode>): GanttNode[] {
  return Array.from(byKey.values())
    .filter((n) => !n.issue.parent_key || !byKey.has(n.issue.parent_key))
    .sort((a, b) =>
      (a.issue.start_date ?? a.issue.due_date ?? '9999').localeCompare(
        b.issue.start_date ?? b.issue.due_date ?? '9999',
      ),
    );
}

function flattenTree(
  roots: GanttNode[],
  expandedKeys: Set<string>,
  depth = 0,
): VisibleRow[] {
  const out: VisibleRow[] = [];
  for (const node of roots) {
    const isExpanded = expandedKeys.has(node.issue.external_key);
    out.push({
      issue: node.issue,
      depth,
      hasChildren: node.children.length > 0,
      isExpanded,
    });
    if (isExpanded && node.children.length > 0) {
      out.push(...flattenTree(node.children, expandedKeys, depth + 1));
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline & Header
// ─────────────────────────────────────────────────────────────────────────────

function computeTimeline(issues: GiGanttIssueRow[], zoom: ZoomMode): TimelineRange {
  const today = todayISO();
  const dates: string[] = [today];
  for (const i of issues) {
    if (i.start_date) dates.push(i.start_date);
    if (i.due_date) dates.push(i.due_date);
  }
  const minD = dates.reduce((a, b) => (a < b ? a : b));
  const maxD = dates.reduce((a, b) => (a > b ? a : b));
  const pad = PAD_DAYS[zoom];
  let viewStart = addDays(minD, -pad);
  // Clamp viewStart: don't go before 1 year ago
  const oneYearAgo = addDays(today, -365);
  if (viewStart < oneYearAgo) viewStart = oneYearAgo;
  const rawEnd = addDays(maxD, pad);
  const minEnd = addDays(viewStart, MIN_SPAN_DAYS[zoom]);
  const viewEnd = rawEnd > minEnd ? rawEnd : minEnd;
  const totalDays = daysBetween(viewStart, viewEnd) + 1;
  return { viewStart, totalDays };
}

function buildPrimarySegments(
  viewStart: string, totalDays: number, dayPx: number, zoom: ZoomMode,
): HeaderSegment[] {
  const today = todayISO();
  const segs: HeaderSegment[] = [];
  const seen = new Set<string>();

  if (zoom === 'week') {
    // Primary = months
    let cur = new Date(Date.UTC(...(viewStart.split('-').map(Number) as [number, number, number])));
    cur.setUTCDate(1);
    while (true) {
      const ms = fmtISO(cur);
      const next = new Date(cur); next.setUTCMonth(next.getUTCMonth() + 1);
      const me = fmtISO(next);
      const dayOff = Math.max(0, daysBetween(viewStart, ms));
      if (dayOff >= totalDays) break;
      const dayLen = Math.min(daysBetween(ms, me), totalDays - dayOff);
      if (dayLen > 0 && !seen.has(ms)) {
        seen.add(ms);
        segs.push({
          label: cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
          xPx: dayOff * dayPx,
          widthPx: dayLen * dayPx,
          isCurrent: ms <= today && today < me,
        });
      }
      cur = next;
    }
  } else if (zoom === 'month') {
    // Primary = quarters
    let cur = new Date(Date.UTC(...(viewStart.split('-').map(Number) as [number, number, number])));
    cur.setUTCDate(1);
    while (true) {
      const qMonth = Math.floor(cur.getUTCMonth() / 3) * 3;
      const qStart = new Date(Date.UTC(cur.getUTCFullYear(), qMonth, 1));
      const qEnd = new Date(qStart); qEnd.setUTCMonth(qEnd.getUTCMonth() + 3);
      const qs = fmtISO(qStart); const qe = fmtISO(qEnd);
      const dayOff = Math.max(0, daysBetween(viewStart, qs));
      if (dayOff >= totalDays) break;
      if (!seen.has(qs)) {
        seen.add(qs);
        const dayLen = Math.min(daysBetween(qs, qe), totalDays - dayOff);
        if (dayLen > 0) {
          segs.push({
            label: `Q${Math.floor(qMonth / 3) + 1} ${qStart.getUTCFullYear()}`,
            xPx: dayOff * dayPx,
            widthPx: dayLen * dayPx,
            isCurrent: qs <= today && today < qe,
          });
        }
      }
      cur.setUTCMonth(cur.getUTCMonth() + 3);
    }
  } else {
    // Primary = years
    let year = parseISO(viewStart).getUTCFullYear();
    while (true) {
      const ys = `${year}-01-01`;
      const ye = `${year + 1}-01-01`;
      const dayOff = Math.max(0, daysBetween(viewStart, ys));
      if (dayOff >= totalDays) break;
      const dayLen = Math.min(daysBetween(ys, ye), totalDays - dayOff);
      if (dayLen > 0) {
        segs.push({
          label: String(year),
          xPx: dayOff * dayPx,
          widthPx: dayLen * dayPx,
          isCurrent: ys <= today && today < ye,
        });
      }
      year++;
    }
  }
  return segs;
}

function buildSecondarySegments(
  viewStart: string, totalDays: number, dayPx: number, zoom: ZoomMode,
): HeaderSegment[] {
  const today = todayISO();
  const segs: HeaderSegment[] = [];

  if (zoom === 'week') {
    // Secondary = weeks (Mon-aligned)
    let weekCur = parseISO(viewStart);
    const dow = weekCur.getUTCDay();
    weekCur.setUTCDate(weekCur.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    while (true) {
      const ws = fmtISO(weekCur);
      const we = addDays(ws, 7);
      const dayOff = daysBetween(viewStart, ws);
      if (dayOff >= totalDays) break;
      const clampedOff = Math.max(0, dayOff);
      const dayLen = Math.min(7, totalDays - clampedOff);
      if (dayLen > 0) {
        segs.push({
          label: `W${isoWeekNumber(weekCur)}`,
          xPx: clampedOff * dayPx,
          widthPx: dayLen * dayPx,
          isCurrent: ws <= today && today < we,
        });
      }
      weekCur.setUTCDate(weekCur.getUTCDate() + 7);
    }
  } else if (zoom === 'month') {
    // Secondary = months
    let cur = parseISO(viewStart); cur.setUTCDate(1);
    while (true) {
      const ms = fmtISO(cur);
      const next = new Date(cur); next.setUTCMonth(next.getUTCMonth() + 1);
      const me = fmtISO(next);
      const dayOff = Math.max(0, daysBetween(viewStart, ms));
      if (dayOff >= totalDays) break;
      const dayLen = Math.min(daysBetween(ms, me), totalDays - dayOff);
      if (dayLen > 0) {
        segs.push({
          label: cur.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
          xPx: dayOff * dayPx,
          widthPx: dayLen * dayPx,
          isCurrent: ms <= today && today < me,
        });
      }
      cur = next;
    }
  } else {
    // Quarter zoom: secondary = months (abbreviated)
    let cur = parseISO(viewStart); cur.setUTCDate(1);
    while (true) {
      const ms = fmtISO(cur);
      const next = new Date(cur); next.setUTCMonth(next.getUTCMonth() + 1);
      const me = fmtISO(next);
      const dayOff = Math.max(0, daysBetween(viewStart, ms));
      if (dayOff >= totalDays) break;
      const dayLen = Math.min(daysBetween(ms, me), totalDays - dayOff);
      if (dayLen > 0) {
        segs.push({
          label: cur.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
          xPx: dayOff * dayPx,
          widthPx: dayLen * dayPx,
          isCurrent: ms <= today && today < me,
        });
      }
      cur = next;
    }
  }
  return segs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Epic:     { bg: 'rgba(139,92,246,0.82)',  border: 'rgba(167,139,250,0.5)', text: '#e9d5ff' },
  Story:    { bg: 'rgba(20,184,166,0.82)',   border: 'rgba(45,212,191,0.5)',  text: '#ccfbf1' },
  Task:     { bg: 'rgba(56,189,248,0.82)',   border: 'rgba(125,211,252,0.5)', text: '#e0f2fe' },
  Bug:      { bg: 'rgba(239,68,68,0.78)',    border: 'rgba(252,165,165,0.5)', text: '#fee2e2' },
  'Sub-task':{ bg: 'rgba(245,158,11,0.78)', border: 'rgba(252,211,77,0.4)',  text: '#fef3c7' },
  Milestone:{ bg: 'rgba(251,191,36,0.92)',   border: 'rgba(253,224,71,0.6)', text: '#fefce8' },
};
const DONE_COLORS   = { bg: 'rgba(34,197,94,0.68)',   border: 'rgba(74,222,128,0.4)',  text: '#dcfce7' };
const OVERDUE_COLORS = { bg: 'rgba(239,68,68,0.82)',  border: 'rgba(248,113,113,0.5)', text: '#fee2e2' };
const DEFAULT_COLORS = { bg: 'rgba(99,102,241,0.78)', border: 'rgba(165,180,252,0.4)', text: '#e0e7ff' };

function getBarColors(issue: GiGanttIssueRow) {
  const today = todayISO();
  const isDone = issue.status === 'Done' || issue.status === 'Closed';
  const isOverdue = !isDone && !!issue.due_date && issue.due_date < today;
  if (isDone) return DONE_COLORS;
  if (isOverdue) return OVERDUE_COLORS;
  return TYPE_COLORS[issue.issue_type ?? ''] ?? DEFAULT_COLORS;
}

function getProgress(issue: GiGanttIssueRow): number {
  if (issue.status === 'Done' || issue.status === 'Closed') return 1;
  if (issue.original_estimate_hours && issue.completed_hours) {
    return Math.min(1, Math.max(0, issue.completed_hours / issue.original_estimate_hours));
  }
  if (issue.status === 'In Review') return 0.65;
  if (issue.status === 'In Progress') return 0.4;
  return 0;
}

function getStatusDot(status: string | null): string {
  switch (status) {
    case 'Done': case 'Closed': return 'bg-emerald-400';
    case 'In Progress': return 'bg-sky-400';
    case 'In Review': return 'bg-violet-400';
    case 'To Do': case 'Open': case 'Backlog': return 'bg-slate-400';
    default: return 'bg-slate-500';
  }
}

function getPriorityIcon(p: string | null) {
  if (!p) return null;
  const pl = p.toLowerCase();
  if (pl === 'highest' || pl === 'critical') return <span className="text-red-400 text-[9px] font-black">↑↑</span>;
  if (pl === 'high') return <span className="text-orange-400 text-[9px] font-bold">↑</span>;
  if (pl === 'low') return <span className="text-blue-400 text-[9px]">↓</span>;
  if (pl === 'lowest') return <span className="text-slate-400 text-[9px]">↓↓</span>;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface GiGanttIcBoardProps {
  issues: GiGanttIssueRow[];
  onOpen?: (key: string) => void;
}

export function GiGanttIcBoard({ issues, onOpen }: GiGanttIcBoardProps) {
  const [zoom, setZoom] = useState<ZoomMode>('month');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    // Auto-expand all epics on mount
    const s = new Set<string>();
    for (const i of issues) if (i.issue_type === 'Epic') s.add(i.external_key);
    return s;
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fullscreen, setFullscreen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = todayISO();
  const dayPx = DAY_PX[zoom];

  // Filtered issues
  const filtered = useMemo(() => {
    let list = issues;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.summary?.toLowerCase().includes(q) ||
          i.external_key.toLowerCase().includes(q) ||
          i.assignee_name?.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== 'all') {
      list = list.filter((i) => (i.issue_type ?? '').toLowerCase() === typeFilter.toLowerCase());
    }
    return list;
  }, [issues, search, typeFilter]);

  // Build hierarchy tree
  const { byKey, roots } = useMemo(() => {
    const bk = buildTree(filtered);
    return { byKey: bk, roots: getRoots(bk) };
  }, [filtered]);

  // Flatten to visible rows
  const visibleRows = useMemo(
    () => flattenTree(roots, expandedKeys),
    [roots, expandedKeys],
  );

  // Timeline math
  const { viewStart, totalDays } = useMemo(
    () => computeTimeline(filtered.filter((i) => i.start_date || i.due_date), zoom),
    [filtered, zoom],
  );
  const chartWidth = totalDays * dayPx;

  // Header segments
  const primarySegs = useMemo(
    () => buildPrimarySegments(viewStart, totalDays, dayPx, zoom),
    [viewStart, totalDays, dayPx, zoom],
  );
  const secondarySegs = useMemo(
    () => buildSecondarySegments(viewStart, totalDays, dayPx, zoom),
    [viewStart, totalDays, dayPx, zoom],
  );

  // Today x position
  const todayX = useMemo(() => daysBetween(viewStart, today) * dayPx, [viewStart, today, dayPx]);

  // Bar position calculator
  const barPos = useCallback(
    (issue: GiGanttIssueRow) => {
      const s = issue.start_date ?? issue.due_date;
      const e = issue.due_date ?? issue.start_date;
      if (!s || !e) return null;
      const left = Math.max(0, daysBetween(viewStart, s)) * dayPx;
      const right = (daysBetween(viewStart, e) + 1) * dayPx;
      const width = Math.max(8, right - left);
      return { left, width };
    },
    [viewStart, dayPx],
  );

  // Dependency line data (parent bar → child bar)
  const depLines = useMemo(() => {
    const rowIdx = new Map<string, number>();
    visibleRows.forEach((r, idx) => rowIdx.set(r.issue.external_key, idx));
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (const row of visibleRows) {
      const pk = row.issue.parent_key;
      if (!pk) continue;
      const pIdx = rowIdx.get(pk);
      const cIdx = rowIdx.get(row.issue.external_key);
      if (pIdx === undefined || cIdx === undefined) continue;
      const pPos = barPos(byKey.get(pk)!.issue);
      const cPos = barPos(row.issue);
      if (!pPos || !cPos) continue;
      const x1 = pPos.left + pPos.width;
      const y1 = pIdx * ROW_H + BAR_Y + BAR_H / 2;
      const x2 = cPos.left;
      const y2 = cIdx * ROW_H + BAR_Y + BAR_H / 2;
      lines.push({ x1, y1, x2, y2 });
    }
    return lines;
  }, [visibleRows, byKey, barPos]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedKeys(new Set(Array.from(byKey.keys())));
  }, [byKey]);

  const collapseAll = useCallback(() => {
    setExpandedKeys(new Set());
  }, []);

  const jumpToToday = useCallback(() => {
    if (!scrollRef.current) return;
    const containerW = scrollRef.current.clientWidth - LEFT_W;
    scrollRef.current.scrollLeft = Math.max(0, todayX - containerW / 2);
  }, [todayX]);

  const selectedIssue = useMemo(
    () => (selectedKey ? issues.find((i) => i.external_key === selectedKey) ?? null : null),
    [selectedKey, issues],
  );

  const datedCount = filtered.filter((i) => i.start_date || i.due_date).length;
  const issueTypes = useMemo(
    () => ['all', ...Array.from(new Set(issues.map((i) => i.issue_type).filter(Boolean))) as string[]],
    [issues],
  );

  if (issues.length === 0) return <GiGanttEmptyState />;

  return (
    <div
      ref={boardRef}
      className={cn(
        'relative flex flex-col bg-[#0d0f14] rounded-xl border border-white/8 shadow-2xl',
        'transition-all duration-300',
        fullscreen ? 'fixed inset-2 z-50' : '',
      )}
      style={{ minHeight: fullscreen ? 'auto' : 420 }}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8 bg-[#12151d] rounded-t-xl flex-wrap">
        {/* Brand */}
        <div className="flex items-center gap-1.5 mr-2">
          <Sparkles className="h-3.5 w-3.5 text-teal-400" />
          <span className="text-xs font-semibold tracking-tight">
            <span className="text-teal-400">Gi</span>
            <span className="text-white/90">Gantt</span>
            <span className="text-teal-400 italic">Ic</span>
          </span>
          <Badge className="h-3.5 text-[8px] px-1 bg-teal-500/20 text-teal-300 border-teal-500/30 ml-0.5">
            BOARD
          </Badge>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Zoom controls */}
        <div className="flex rounded-md overflow-hidden border border-white/10">
          {(['week', 'month', 'quarter'] as ZoomMode[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={cn(
                'px-2 py-1 text-[10px] font-medium transition-colors capitalize',
                zoom === z
                  ? 'bg-teal-500/25 text-teal-300'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5',
              )}
            >
              {z}
            </button>
          ))}
        </div>

        {/* Today jump */}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px] text-white/50 hover:text-teal-300 hover:bg-teal-500/10"
          onClick={jumpToToday}
        >
          <Calendar className="h-3 w-3 mr-1" />
          Today
        </Button>

        {/* Expand / collapse */}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px] text-white/40 hover:text-white/70"
          onClick={expandAll}
          title="Expand all"
        >
          <ChevronDown className="h-3 w-3 mr-0.5" /> All
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px] text-white/40 hover:text-white/70"
          onClick={collapseAll}
          title="Collapse all"
        >
          <ChevronUp className="h-3 w-3 mr-0.5" /> None
        </Button>

        <div className="w-px h-4 bg-white/10" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-6 pl-6 pr-2 text-[10px] bg-white/5 border border-white/8 rounded text-white/70 placeholder:text-white/25 focus:outline-none focus:border-teal-500/40 w-36"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <Filter className="h-3 w-3 text-white/30" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-6 text-[10px] bg-white/5 border border-white/8 rounded text-white/60 focus:outline-none focus:border-teal-500/40 px-1"
          >
            {issueTypes.map((t) => (
              <option key={t} value={t} className="bg-[#0d0f14]">
                {t === 'all' ? 'All types' : t}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-white/30">
            {visibleRows.length} rows · {datedCount} scheduled
          </span>

          {/* Fullscreen toggle */}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-white/30 hover:text-white/60"
            onClick={() => setFullscreen((f) => !f)}
          >
            {fullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* ── Board area ── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Main scroll container */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          style={{ maxHeight: fullscreen ? 'calc(100vh - 80px)' : 520 }}
        >
          {/* Total width sets the scroll region */}
          <div style={{ width: LEFT_W + chartWidth, position: 'relative' }}>

            {/* ── Sticky header ── */}
            <div
              className="sticky top-0 z-20 flex border-b border-white/10"
              style={{ height: HEADER_H }}
            >
              {/* Top-left anchor (sticky both axes) */}
              <div
                className="sticky left-0 z-30 flex flex-col justify-end bg-[#12151d] border-r border-white/10 px-3 py-1.5"
                style={{ width: LEFT_W, minWidth: LEFT_W }}
              >
                <span className="text-[9px] font-semibold uppercase tracking-widest text-white/30">
                  Task
                </span>
              </div>

              {/* Timeline header */}
              <div style={{ width: chartWidth, position: 'relative', flex: 'none' }}>
                {/* Primary segments (months / quarters / years) */}
                <div
                  className="absolute top-0 left-0 right-0 flex border-b border-white/8"
                  style={{ height: HEADER_H / 2 }}
                >
                  {primarySegs.map((seg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'absolute top-0 bottom-0 flex items-center border-r border-white/8 px-2 overflow-hidden',
                        seg.isCurrent ? 'bg-teal-500/8' : '',
                      )}
                      style={{ left: seg.xPx, width: seg.widthPx }}
                    >
                      <span
                        className={cn(
                          'text-[9px] font-semibold tracking-wide truncate whitespace-nowrap',
                          seg.isCurrent ? 'text-teal-400' : 'text-white/40',
                        )}
                      >
                        {seg.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Secondary segments (weeks / months) */}
                <div
                  className="absolute left-0 right-0 flex"
                  style={{ top: HEADER_H / 2, height: HEADER_H / 2 }}
                >
                  {secondarySegs.map((seg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'absolute top-0 bottom-0 flex items-center justify-center border-r border-white/6 px-1 overflow-hidden',
                        seg.isCurrent ? 'bg-teal-500/12 text-teal-300' : 'text-white/30',
                      )}
                      style={{ left: seg.xPx, width: seg.widthPx }}
                    >
                      <span className="text-[8px] font-medium tracking-wide truncate">
                        {seg.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Data rows ── */}
            <div style={{ position: 'relative' }}>

              {/* SVG overlay: dependency lines + today marker */}
              <svg
                style={{
                  position: 'absolute',
                  left: LEFT_W,
                  top: 0,
                  width: chartWidth,
                  height: Math.max(visibleRows.length * ROW_H, 1),
                  pointerEvents: 'none',
                  zIndex: 6,
                  overflow: 'visible',
                }}
              >
                <defs>
                  <marker
                    id="gg-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 Z" fill="rgba(20,184,166,0.55)" />
                  </marker>
                </defs>

                {/* Today vertical line */}
                {todayX >= 0 && todayX <= chartWidth && (
                  <line
                    x1={todayX}
                    y1={0}
                    x2={todayX}
                    y2={visibleRows.length * ROW_H}
                    stroke="rgba(20,184,166,0.55)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                )}

                {/* Today label */}
                {todayX >= 0 && todayX <= chartWidth && (
                  <text
                    x={todayX + 3}
                    y={11}
                    fill="rgba(20,184,166,0.75)"
                    fontSize="8"
                    fontWeight="600"
                    fontFamily="system-ui,sans-serif"
                  >
                    TODAY
                  </text>
                )}

                {/* Dependency connector lines */}
                {depLines.map((l, i) => {
                  const mx = (l.x1 + l.x2) / 2;
                  return (
                    <path
                      key={i}
                      d={`M${l.x1},${l.y1} C${mx},${l.y1} ${mx},${l.y2} ${l.x2},${l.y2}`}
                      fill="none"
                      stroke="rgba(20,184,166,0.28)"
                      strokeWidth={1.5}
                      markerEnd="url(#gg-arrow)"
                    />
                  );
                })}
              </svg>

              {/* Row rendering */}
              {visibleRows.map((row, idx) => {
                const pos = barPos(row.issue);
                const colors = getBarColors(row.issue);
                const progress = getProgress(row.issue);
                const isMilestone = row.issue.issue_type === 'Milestone';
                const isSelected = row.issue.external_key === selectedKey;
                const isHovered = row.issue.external_key === hoveredKey;
                const isOverdue =
                  !['Done', 'Closed'].includes(row.issue.status ?? '') &&
                  !!row.issue.due_date &&
                  row.issue.due_date < today;

                return (
                  <div
                    key={row.issue.external_key}
                    className={cn(
                      'flex border-b transition-colors duration-100 cursor-pointer group',
                      isSelected
                        ? 'border-teal-500/20 bg-teal-500/8'
                        : isHovered
                        ? 'border-white/8 bg-white/4'
                        : 'border-white/5 hover:bg-white/3',
                    )}
                    style={{ height: ROW_H }}
                    onClick={() =>
                      setSelectedKey(isSelected ? null : row.issue.external_key)
                    }
                    onMouseEnter={() => setHoveredKey(row.issue.external_key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    {/* ── Left task cell ── */}
                    <div
                      className={cn(
                        'sticky left-0 z-10 flex items-center gap-1.5 px-2 border-r border-white/8 overflow-hidden',
                        isSelected ? 'bg-teal-950/70' : 'bg-[#0d0f14] group-hover:bg-[#111418]',
                      )}
                      style={{ width: LEFT_W, minWidth: LEFT_W, paddingLeft: 8 + row.depth * 18 }}
                    >
                      {/* Expand toggle */}
                      {row.hasChildren ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(row.issue.external_key);
                          }}
                          className="h-4 w-4 flex items-center justify-center shrink-0 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
                        >
                          {row.isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        <span className="h-4 w-4 shrink-0" />
                      )}

                      {/* Status dot */}
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full shrink-0', getStatusDot(row.issue.status))}
                      />

                      {/* Summary */}
                      <span
                        className={cn(
                          'text-[11px] font-medium truncate flex-1 leading-none',
                          isSelected ? 'text-teal-200' : 'text-white/80',
                        )}
                      >
                        {row.issue.summary ?? row.issue.external_key}
                      </span>

                      {/* Priority icon */}
                      <span className="shrink-0">{getPriorityIcon(row.issue.priority)}</span>

                      {/* Overdue badge */}
                      {isOverdue && (
                        <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                      )}

                      {/* SP badge */}
                      {typeof row.issue.story_points === 'number' && (
                        <span className="text-[9px] font-bold text-white/25 shrink-0">
                          {row.issue.story_points}
                        </span>
                      )}
                    </div>

                    {/* ── Chart cell ── */}
                    <div
                      style={{ width: chartWidth, position: 'relative', flex: 'none' }}
                    >
                      {/* Alternating column tint for secondary segments */}
                      {secondarySegs
                        .filter((_, si) => si % 2 === 0)
                        .map((seg, si) => (
                          <div
                            key={si}
                            className="absolute top-0 bottom-0 bg-white/[0.015]"
                            style={{ left: seg.xPx, width: seg.widthPx }}
                          />
                        ))}

                      {/* Task bar */}
                      {pos && !isMilestone && (
                        <div
                          className="absolute overflow-hidden select-none transition-shadow"
                          style={{
                            left: pos.left,
                            width: pos.width,
                            top: BAR_Y,
                            height: BAR_H,
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            borderRadius: row.issue.issue_type === 'Epic' ? 4 : 3,
                            boxShadow: isSelected
                              ? `0 0 0 1.5px rgba(20,184,166,0.6), 0 2px 8px rgba(0,0,0,0.4)`
                              : `0 1px 4px rgba(0,0,0,0.3)`,
                          }}
                          title={`${row.issue.summary} · ${row.issue.start_date ?? '?'} → ${row.issue.due_date ?? '?'}`}
                        >
                          {/* Progress fill */}
                          {progress > 0 && (
                            <div
                              className="absolute top-0 left-0 bottom-0 opacity-40"
                              style={{
                                width: `${progress * 100}%`,
                                background: 'rgba(255,255,255,0.35)',
                              }}
                            />
                          )}
                          {/* Bar label */}
                          {pos.width > 50 && (
                            <span
                              className="absolute inset-0 flex items-center px-1.5 text-[9px] font-semibold tracking-tight truncate"
                              style={{ color: colors.text }}
                            >
                              {row.issue.assignee_name
                                ? row.issue.assignee_name.split(' ')[0]
                                : row.issue.external_key}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Milestone diamond */}
                      {pos && isMilestone && (
                        <div
                          className="absolute"
                          style={{
                            left: pos.left + pos.width / 2 - MILESTONE_SIZE / 2,
                            top: BAR_Y + (BAR_H - MILESTONE_SIZE) / 2,
                            width: MILESTONE_SIZE,
                            height: MILESTONE_SIZE,
                            background: 'rgba(251,191,36,0.9)',
                            border: '1.5px solid rgba(253,224,71,0.7)',
                            transform: 'rotate(45deg)',
                            boxShadow: '0 0 6px rgba(251,191,36,0.4)',
                          }}
                          title={`Milestone: ${row.issue.summary}`}
                        />
                      )}

                      {/* No date indicator */}
                      {!pos && (
                        <div className="absolute inset-y-0 right-3 flex items-center">
                          <span className="text-[9px] text-white/15">no dates</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Empty state within board */}
              {visibleRows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Activity className="h-8 w-8 text-white/10 mb-3" />
                  <p className="text-sm text-white/25">No tasks match the current filters</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Details Inspector Panel ── */}
        {selectedIssue && (
          <DetailsPanel
            issue={selectedIssue}
            allIssues={issues}
            onClose={() => setSelectedKey(null)}
            onOpenExternal={onOpen}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-white/6 bg-[#0a0c10] rounded-b-xl">
        {/* Legend */}
        {Object.entries(TYPE_COLORS)
          .slice(0, 5)
          .map(([type, colors]) => (
            <span key={type} className="flex items-center gap-1">
              <span
                className="h-2 w-3 rounded-sm inline-block"
                style={{ background: colors.bg }}
              />
              <span className="text-[9px] text-white/25">{type}</span>
            </span>
          ))}
        <span className="flex items-center gap-1">
          <span
            className="h-2 w-3 rounded-sm inline-block"
            style={{ background: DONE_COLORS.bg }}
          />
          <span className="text-[9px] text-white/25">Done</span>
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-2 w-3 rounded-sm inline-block"
            style={{ background: OVERDUE_COLORS.bg }}
          />
          <span className="text-[9px] text-white/25">Overdue</span>
        </span>
        <span className="ml-auto text-[9px] text-white/20">
          GiGanttIc · zoom: {zoom} · {totalDays}d span · {(chartWidth / 1000).toFixed(1)}k px
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Details Panel
// ─────────────────────────────────────────────────────────────────────────────

function DetailsPanel({
  issue,
  allIssues,
  onClose,
  onOpenExternal,
}: {
  issue: GiGanttIssueRow;
  allIssues: GiGanttIssueRow[];
  onClose: () => void;
  onOpenExternal?: (key: string) => void;
}) {
  const parent = allIssues.find((i) => i.external_key === issue.parent_key);
  const children = allIssues.filter((i) => i.parent_key === issue.external_key);
  const colors = getBarColors(issue);
  const progress = getProgress(issue);
  const today = todayISO();
  const isOverdue =
    !['Done', 'Closed'].includes(issue.status ?? '') &&
    !!issue.due_date &&
    issue.due_date < today;
  const duration =
    issue.start_date && issue.due_date
      ? daysBetween(issue.start_date, issue.due_date) + 1
      : null;

  return (
    <div
      className="w-72 shrink-0 border-l border-white/10 bg-[#0f1219] flex flex-col overflow-hidden"
      style={{ maxHeight: 520 }}
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-3 border-b border-white/8">
        <div
          className="mt-0.5 h-2.5 w-2.5 rounded-sm shrink-0"
          style={{ background: colors.bg }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-white/90 leading-snug line-clamp-2">
            {issue.summary ?? issue.external_key}
          </p>
          <p className="text-[9px] text-white/35 mt-0.5 font-mono">{issue.external_key}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Status & type row */}
        <div className="flex items-center gap-2 flex-wrap">
          {issue.issue_type && (
            <Badge
              className="text-[9px] px-1.5 py-0 border"
              style={{
                background: colors.bg,
                borderColor: colors.border,
                color: colors.text,
              }}
            >
              {issue.issue_type}
            </Badge>
          )}
          {issue.status && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-white/50 border-white/15">
              {issue.status}
            </Badge>
          )}
          {isOverdue && (
            <Badge className="text-[9px] px-1.5 py-0 bg-red-500/20 text-red-300 border-red-500/30">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Overdue
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        {progress > 0 && (
          <div>
            <div className="flex justify-between text-[9px] text-white/35 mb-1">
              <span>Progress</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress * 100}%`,
                  background: 'linear-gradient(90deg, rgba(20,184,166,0.8), rgba(45,212,191,0.9))',
                }}
              />
            </div>
          </div>
        )}

        {/* Schedule */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25">Schedule</p>
          <div className="grid grid-cols-2 gap-1.5">
            <FieldCell label="Start" value={issue.start_date ?? '—'} icon={<Calendar className="h-2.5 w-2.5" />} />
            <FieldCell label="Due" value={issue.due_date ?? '—'} icon={<Calendar className="h-2.5 w-2.5" />} highlight={isOverdue} />
            {duration !== null && (
              <FieldCell label="Duration" value={`${duration}d`} icon={<Clock className="h-2.5 w-2.5" />} />
            )}
            {typeof issue.story_points === 'number' && (
              <FieldCell label="Story Pts" value={String(issue.story_points)} />
            )}
          </div>
        </div>

        {/* Effort */}
        {(issue.original_estimate_hours != null || issue.completed_hours != null) && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25">Effort</p>
            <div className="grid grid-cols-2 gap-1.5">
              {issue.original_estimate_hours != null && (
                <FieldCell label="Estimate" value={`${issue.original_estimate_hours}h`} />
              )}
              {issue.completed_hours != null && (
                <FieldCell label="Logged" value={`${issue.completed_hours}h`} />
              )}
              {issue.remaining_hours != null && (
                <FieldCell label="Remaining" value={`${issue.remaining_hours}h`} />
              )}
            </div>
          </div>
        )}

        {/* People */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25">People</p>
          <div className="space-y-1">
            {issue.assignee_name && (
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-full bg-teal-500/25 border border-teal-500/30 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-teal-300">
                    {issue.assignee_name[0]}
                  </span>
                </div>
                <span className="text-[10px] text-white/60">{issue.assignee_name}</span>
                <span className="text-[9px] text-white/25">assignee</span>
              </div>
            )}
            {issue.reporter_email && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3 w-3 text-white/25" />
                <span className="text-[10px] text-white/40 truncate">{issue.reporter_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Hierarchy */}
        {(parent || children.length > 0) && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25">Hierarchy</p>
            {parent && (
              <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                <ChevronUp className="h-3 w-3 text-violet-400" />
                <span className="text-white/30">Parent:</span>
                <span className="font-mono text-violet-300">{parent.external_key}</span>
                <span className="truncate text-white/40">{parent.summary}</span>
              </div>
            )}
            {children.slice(0, 5).map((c) => (
              <div key={c.external_key} className="flex items-center gap-1.5 text-[10px] text-white/40">
                <ChevronDown className="h-3 w-3 text-teal-400" />
                <span className="font-mono text-teal-300/70">{c.external_key}</span>
                <span className="truncate text-white/35">{c.summary}</span>
              </div>
            ))}
            {children.length > 5 && (
              <p className="text-[9px] text-white/25">+{children.length - 5} more children</p>
            )}
          </div>
        )}

        {/* Labels */}
        {issue.labels && issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((l) => (
              <span
                key={l}
                className="text-[8px] px-1.5 py-0.5 rounded bg-white/6 text-white/35 border border-white/8"
              >
                {l}
              </span>
            ))}
          </div>
        )}

        {/* Risk signal */}
        {issue.capacity_risk === 'high' && (
          <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-3 w-3 text-red-400" />
            <span className="text-[10px] text-red-300">High capacity risk flagged</span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-white/8 flex gap-2">
        {onOpenExternal && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-[10px] border-white/15 text-white/50 hover:text-white hover:border-teal-500/50 hover:bg-teal-500/10"
            onClick={() => onOpenExternal(issue.external_key)}
          >
            Open in Jira
          </Button>
        )}
        {issue.url && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[10px] text-white/30 hover:text-teal-300"
            onClick={() => window.open(issue.url!, '_blank')}
          >
            ↗
          </Button>
        )}
      </div>
    </div>
  );
}

function FieldCell({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white/4 rounded px-2 py-1.5">
      <p className="text-[8px] text-white/25 uppercase tracking-wider mb-0.5">{label}</p>
      <p
        className={cn(
          'text-[10px] font-medium flex items-center gap-1',
          highlight ? 'text-red-300' : 'text-white/65',
        )}
      >
        {icon && <span className="text-white/25">{icon}</span>}
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty / Loading States
// ─────────────────────────────────────────────────────────────────────────────

function GiGanttEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-[#0d0f14] rounded-xl border border-white/8">
      <Sparkles className="h-10 w-10 text-teal-500/30 mb-4" />
      <p className="text-sm font-semibold text-white/30 mb-1">
        <span className="text-teal-400">Gi</span>Gantt<span className="text-teal-400 italic">Ic</span>
      </p>
      <p className="text-xs text-white/20">
        No issues to display. Sync your integration first.
      </p>
    </div>
  );
}

export function GiGanttLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-[#0d0f14] rounded-xl border border-white/8">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-teal-400 animate-pulse" />
        <span className="text-xs font-semibold text-white/40">
          <span className="text-teal-400">Gi</span>Gantt<span className="text-teal-400 italic">Ic</span>
        </span>
      </div>
      <div className="h-1 w-32 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full w-1/3 bg-teal-500/60 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
