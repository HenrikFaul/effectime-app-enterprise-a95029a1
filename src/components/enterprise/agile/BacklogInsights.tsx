import { useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Activity, AlertTriangle, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Cyberpunk helpers ────────────────────────────────────────────────────────

const PRIORITY_NEON: Record<string, { fill: string; shadow: string; label: string }> = {
  '1':        { fill: '#ff3b30', shadow: 'rgba(255,59,48,0.7)',   label: 'P1' },
  'critical': { fill: '#ff3b30', shadow: 'rgba(255,59,48,0.7)',   label: 'P1' },
  'highest':  { fill: '#ff3b30', shadow: 'rgba(255,59,48,0.7)',   label: 'P1' },
  '2':        { fill: '#ff9f0a', shadow: 'rgba(255,159,10,0.7)',  label: 'P2' },
  'high':     { fill: '#ff9f0a', shadow: 'rgba(255,159,10,0.7)',  label: 'P2' },
  '3':        { fill: '#ffd60a', shadow: 'rgba(255,214,10,0.6)',  label: 'P3' },
  'medium':   { fill: '#ffd60a', shadow: 'rgba(255,214,10,0.6)',  label: 'P3' },
  '4':        { fill: '#34c759', shadow: 'rgba(52,199,89,0.6)',   label: 'P4' },
  'low':      { fill: '#34c759', shadow: 'rgba(52,199,89,0.6)',   label: 'P4' },
};
const DEFAULT_NEON = { fill: '#818cf8', shadow: 'rgba(129,140,248,0.6)', label: '—' };

function dotStyle(issue: Record<string, unknown>) {
  const p = String(issue.priority ?? '').toLowerCase();
  const n = PRIORITY_NEON[p] ?? DEFAULT_NEON;
  return { background: n.fill, boxShadow: `0 0 5px ${n.shadow}, 0 0 10px ${n.shadow}` };
}

const DONE_STATUSES = new Set(['done', 'closed', 'resolved', 'completed', 'removed', 'accepted']);

const NEXUS_SCANLINE = {
  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(99,102,241,0.04) 3px, rgba(99,102,241,0.04) 4px)',
} as React.CSSProperties;

interface BacklogInsightsProps {
  issues: Record<string, unknown>[];
  provider: 'jira' | 'azure_devops';
}

const TYPE_COLORS = [
  '#6366f1', '#22c55e', '#3b82f6', '#ef4444', '#f59e0b',
  '#8b5cf6', '#14b8a6', '#ec4899', '#f97316', '#84cc16',
];

const STATUS_BG: Record<string, string> = {
  done: 'bg-emerald-500', closed: 'bg-emerald-500', resolved: 'bg-emerald-500', completed: 'bg-emerald-500',
  'in progress': 'bg-sky-500', active: 'bg-sky-500', doing: 'bg-sky-500',
  'in review': 'bg-violet-500', review: 'bg-violet-500', design: 'bg-violet-500',
  'to do': 'bg-slate-400', new: 'bg-slate-400', open: 'bg-slate-400', backlog: 'bg-slate-400',
  requested: 'bg-slate-400', 'in planning': 'bg-indigo-400',
  blocked: 'bg-rose-500', impediment: 'bg-rose-500',
};
function statusBg(s: string): string {
  return STATUS_BG[s.toLowerCase()] ?? 'bg-muted-foreground/40';
}

function nameToHsl(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 50%)`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

export function BacklogInsights({ issues }: BacklogInsightsProps) {
  const { t } = useI18n();

  const stats = useMemo(() => {
    const total = issues.length;
    if (total === 0) return null;

    const storyPoints = issues.reduce((sum, i) => sum + (Number(i.story_points) || 0), 0);
    const unassigned = issues.filter(i => !i.assignee_name).length;
    const highPriority = issues.filter(i => {
      const p = String(i.priority ?? '').toLowerCase();
      return p === 'critical' || p === 'highest' || p === 'high' || p === '1' || p === '2';
    }).length;

    const typeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const assigneeCounts: Record<string, number> = {};

    for (const i of issues) {
      const type = (i.issue_type as string) || 'Unknown';
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      const status = (i.status as string) || 'Unknown';
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      const a = (i.assignee_name as string) || '';
      if (a) assigneeCounts[a] = (assigneeCounts[a] ?? 0) + 1;
    }

    const typePairs = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const statusPairs = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const topAssignees = Object.entries(assigneeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // ── NEXUS data ────────────────────────────────────────────────────────────
    const doneCount = issues.filter(i => DONE_STATUSES.has(String(i.status ?? '').toLowerCase())).length;

    // Group issues by type for dot matrix (sorted by count desc)
    const issuesByType: { type: string; items: typeof issues }[] = typePairs.slice(0, 8).map(([type]) => ({
      type,
      items: issues.filter(i => (i.issue_type as string || 'Unknown') === type),
    }));

    // Priority distribution for signal bars
    const prioBuckets: Record<string, { fill: string; shadow: string; label: string; count: number }> = {};
    for (const issue of issues) {
      const p = String(issue.priority ?? '').toLowerCase();
      const n = PRIORITY_NEON[p] ?? DEFAULT_NEON;
      if (!prioBuckets[n.label]) prioBuckets[n.label] = { ...n, count: 0 };
      prioBuckets[n.label].count++;
    }
    const prioritySignal = Object.values(prioBuckets).sort((a, b) => a.label.localeCompare(b.label));

    return { total, storyPoints, unassigned, highPriority, typePairs, statusPairs, topAssignees, doneCount, issuesByType, prioritySignal };
  }, [issues]);

  if (!stats) {
    return (
      <div className="rounded-xl border bg-card/50 p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground min-h-[200px]">
        <Activity className="h-8 w-8 opacity-20" />
        <p className="text-xs">{t('backlog_insights.no_data')}</p>
      </div>
    );
  }

  // Donut via conic-gradient
  let cumPct = 0;
  const conicStops = stats.typePairs.slice(0, 8).map(([, count], idx) => {
    const pct = (count / stats.total) * 100;
    const stop = `${TYPE_COLORS[idx % TYPE_COLORS.length]} ${cumPct.toFixed(1)}% ${(cumPct + pct).toFixed(1)}%`;
    cumPct += pct;
    return stop;
  });

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">{t('backlog_insights.title')}</span>
        </div>
        <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {stats.total} {t('backlog_insights.items')}
        </span>
      </div>

      <div className="p-4 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-lg p-3 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-500/20">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" /> {t('backlog_insights.story_points')}
            </div>
            <div className="text-2xl font-bold text-violet-600 dark:text-violet-400 leading-none">
              {stats.storyPoints}
            </div>
          </div>

          <div className={cn(
            'rounded-lg p-3 border',
            stats.unassigned > 0
              ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20'
              : 'bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-500/20',
          )}>
            <div className={cn(
              'text-[10px] uppercase tracking-wide mb-1 flex items-center gap-1',
              stats.unassigned > 0 ? 'text-amber-600/70' : 'text-emerald-600/70',
            )}>
              <Users className="h-2.5 w-2.5" /> {t('backlog_insights.unassigned')}
            </div>
            <div className={cn(
              'text-2xl font-bold leading-none',
              stats.unassigned > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
            )}>
              {stats.unassigned}
            </div>
          </div>

          <div className={cn(
            'rounded-lg p-3 border',
            stats.highPriority > 0
              ? 'bg-gradient-to-br from-rose-500/10 to-red-500/5 border-rose-500/20'
              : 'bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-500/20',
          )}>
            <div className={cn(
              'text-[10px] uppercase tracking-wide mb-1 flex items-center gap-1',
              stats.highPriority > 0 ? 'text-rose-600/70' : 'text-emerald-600/70',
            )}>
              <AlertTriangle className="h-2.5 w-2.5" /> {t('backlog_insights.high_priority')}
            </div>
            <div className={cn(
              'text-2xl font-bold leading-none',
              stats.highPriority > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
            )}>
              {stats.highPriority}
            </div>
          </div>
        </div>

        {/* Type donut + Status bars */}
        <div className="grid grid-cols-[auto_1fr] gap-5 items-start">
          {/* Donut */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
              {t('backlog_insights.type_distribution')}
            </div>
            <div className="relative w-[72px] h-[72px]">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(${conicStops.join(', ')})` }}
              />
              <div className="absolute inset-[23%] rounded-full bg-card flex items-center justify-center shadow-inner">
                <span className="text-[11px] font-bold">{stats.total}</span>
              </div>
            </div>
            <div className="space-y-0.5 w-full">
              {stats.typePairs.slice(0, 6).map(([name, count], idx) => (
                <div key={name} className="flex items-center gap-1.5 min-w-0">
                  <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[idx % TYPE_COLORS.length] }} />
                  <span className="text-[9px] text-muted-foreground truncate flex-1">{name}</span>
                  <span className="text-[9px] font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status bars */}
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('backlog_insights.status_distribution')}
            </div>
            <div className="space-y-2">
              {stats.statusPairs.map(([status, count]) => {
                const pct = Math.round((count / stats.total) * 100);
                return (
                  <div key={status}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] truncate max-w-[120px]" title={status}>{status}</span>
                      <span className="text-[10px] font-semibold shrink-0 ml-1">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', statusBg(status))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top assignees */}
        {stats.topAssignees.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t('backlog_insights.top_assignees')}
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.topAssignees.map(([name, count]) => (
                <div
                  key={name}
                  title={name}
                  className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1 hover:bg-muted/60 transition-colors"
                >
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                    style={{ background: nameToHsl(name) }}
                  >
                    {initials(name)}
                  </div>
                  <span className="text-[10px] max-w-[64px] truncate">{firstName(name)}</span>
                  <span className="text-[9px] font-semibold bg-primary/10 text-primary rounded-full px-1.5 py-px leading-none">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── NEXUS — full-bleed footer ──────────────────────────────────────── */}
      <NexusPanel stats={stats} />
    </div>
  );
}

// ── NEXUS sub-component ──────────────────────────────────────────────────────

interface NexusStats {
  total: number;
  doneCount: number;
  issuesByType: { type: string; items: Record<string, unknown>[] }[];
  prioritySignal: { fill: string; shadow: string; label: string; count: number }[];
}

function NexusPanel({ stats }: { stats: NexusStats }) {
  const { t } = useI18n();
  const { total, doneCount, issuesByType, prioritySignal } = stats;

  // SVG completion arc
  const R = 30;
  const CIRC = 2 * Math.PI * R;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const arcDash = (pct / 100) * CIRC;
  // Start arc from top: dashoffset = CIRC/4
  const arcOffset = CIRC / 4;

  return (
    <div className="overflow-hidden border-t border-indigo-500/25 bg-slate-950 relative">
      {/* Scanline texture */}
      <div className="absolute inset-0 pointer-events-none" style={NEXUS_SCANLINE} />

      {/* Header bar */}
      <div className="relative flex items-center justify-between px-3 py-2 border-b border-indigo-500/20">
        <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {t('backlog_insights.nexus_title')}
        </div>
        <span className="font-mono text-[9px] text-indigo-400/60">
          {total} {t('backlog_insights.nexus_nodes')}
        </span>
      </div>

      <div className="relative p-3 grid grid-cols-[auto_1fr] gap-4 items-start">
        {/* Completion arc */}
        <div className="flex flex-col items-center gap-1">
          <div className="font-mono text-[9px] text-indigo-400/60 uppercase tracking-wider mb-1">
            {t('backlog_insights.nexus_resolved')}
          </div>
          <div className="relative">
            <svg width="84" height="84" viewBox="0 0 84 84">
              {/* Outer decorative ring */}
              <circle cx="42" cy="42" r="40" fill="none" stroke="rgba(99,102,241,0.08)" strokeWidth="1" />
              {/* Track */}
              <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="6" />
              {/* Progress arc */}
              <circle
                cx="42" cy="42" r={R}
                fill="none"
                stroke="url(#nexusArcGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${arcDash} ${CIRC}`}
                strokeDashoffset={arcOffset}
                style={{ transition: 'stroke-dasharray 1s ease' }}
              />
              <defs>
                <linearGradient id="nexusArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              {/* Inner tick marks */}
              {[0, 90, 180, 270].map(deg => {
                const rad = (deg * Math.PI) / 180;
                const x1 = 42 + 36 * Math.cos(rad);
                const y1 = 42 + 36 * Math.sin(rad);
                const x2 = 42 + 38 * Math.cos(rad);
                const y2 = 42 + 38 * Math.sin(rad);
                return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(99,102,241,0.3)" strokeWidth="1" />;
              })}
              {/* Center text */}
              <text x="42" y="38" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="700" fontFamily="monospace">{pct}%</text>
              <text x="42" y="52" textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="7" fontFamily="monospace">DONE</text>
            </svg>
          </div>
          {/* Mini stats below arc */}
          <div className="font-mono text-[9px] text-slate-500 text-center">
            <span className="text-cyan-400">{doneCount}</span> / {total}
          </div>
        </div>

        {/* Work Fabric dot matrix */}
        <div className="min-w-0">
          <div className="font-mono text-[9px] text-indigo-400/60 uppercase tracking-wider mb-2">
            {t('backlog_insights.nexus_fabric')}
          </div>
          <div className="space-y-2">
            {issuesByType.map(({ type, items }) => (
              <div key={type} className="flex items-center gap-2 min-w-0">
                <span
                  className="font-mono text-[9px] text-slate-400 shrink-0 w-20 truncate text-right"
                  title={type}
                >
                  {type}
                </span>
                <div className="w-px h-3 bg-indigo-500/30 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {items.slice(0, 30).map((issue, i) => (
                    <div
                      key={i}
                      title={`${issue.external_key ?? '#'} ${String(issue.summary ?? '').slice(0, 40)}`}
                      className="w-[7px] h-[7px] rounded-full cursor-help transition-transform hover:scale-150"
                      style={dotStyle(issue)}
                    />
                  ))}
                  {items.length > 30 && (
                    <span className="font-mono text-[8px] text-indigo-400/50 leading-[7px]">+{items.length - 30}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Priority Signal — horizontal neon bars */}
      {prioritySignal.length > 0 && (
        <div className="relative border-t border-indigo-500/15 px-3 py-2.5">
          <div className="font-mono text-[9px] text-indigo-400/60 uppercase tracking-wider mb-2">
            {t('backlog_insights.nexus_signal')}
          </div>
          <div className="space-y-1.5">
            {prioritySignal.map(({ fill, shadow, label, count }) => {
              const pct = Math.max(4, Math.round((count / total) * 100));
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="font-mono text-[9px] w-5 shrink-0 text-right" style={{ color: fill }}>{label}</span>
                  <div className="flex-1 h-2 rounded-sm bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-700"
                      style={{ width: `${pct}%`, background: fill, boxShadow: `0 0 6px ${shadow}` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] shrink-0 tabular-nums" style={{ color: fill }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
