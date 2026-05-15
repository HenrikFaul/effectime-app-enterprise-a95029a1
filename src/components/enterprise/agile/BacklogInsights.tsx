import { useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Activity, AlertTriangle, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

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

    return { total, storyPoints, unassigned, highPriority, typePairs, statusPairs, topAssignees };
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
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden h-full">
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
    </div>
  );
}
