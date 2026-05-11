import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  workspaceId: string;
  filteredUserIds: string[];
  range: { from: Date; to: Date };
}

interface SkillStat {
  skill_id: string;
  name: string;
  color: string;
  total: number;
  available: number;
  onLeave: number;
}

interface PositionStat {
  role: string;
  total: number;
  available: number;
  onLeave: number;
}

export function SkillCapacityReport({ workspaceId, filteredUserIds, range }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [skillStats, setSkillStats] = useState<SkillStat[]>([]);
  const [positionStats, setPositionStats] = useState<PositionStat[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [onLeaveCount, setOnLeaveCount] = useState(0);

  useEffect(() => {
    if (filteredUserIds.length === 0) {
      setSkillStats([]);
      setPositionStats([]);
      setTotalMembers(0);
      setOnLeaveCount(0);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      const from = format(range.from, 'yyyy-MM-dd');
      const to = format(range.to, 'yyyy-MM-dd');

      const [memRes, leaveRes] = await Promise.all([
        (supabase as any)
          .from('enterprise_memberships')
          .select('id, user_id, business_role')
          .eq('workspace_id', workspaceId)
          .in('user_id', filteredUserIds)
          .eq('status', 'active'),
        (supabase as any)
          .from('leave_requests')
          .select('user_id, start_date, end_date, status')
          .eq('workspace_id', workspaceId)
          .in('user_id', filteredUserIds)
          .in('status', ['approved', 'pending'])
          .lte('start_date', to)
          .gte('end_date', from),
      ]);

      if (cancelled) return;

      const memberships: any[] = memRes.data || [];
      const membershipIds = memberships.map((m: any) => m.id);
      const memberByUserId = Object.fromEntries(memberships.map((m: any) => [m.user_id, m]));
      const membershipToUserId = Object.fromEntries(memberships.map((m: any) => [m.id, m.user_id]));

      const onLeaveUserIds = new Set<string>();
      (leaveRes.data || []).forEach((l: any) => {
        if (l.status === 'approved') onLeaveUserIds.add(l.user_id);
      });

      const total = filteredUserIds.length;
      const onLeave = onLeaveUserIds.size;

      // Skills
      const skillStatsMap: Record<string, SkillStat> = {};
      if (membershipIds.length > 0) {
        const { data: memberSkills } = await (supabase as any)
          .from('enterprise_member_skills')
          .select('membership_id, skill_id, enterprise_skills(id, name, color)')
          .in('membership_id', membershipIds);

        if (!cancelled) {
          (memberSkills || []).forEach((ms: any) => {
            const skill = ms.enterprise_skills;
            if (!skill) return;
            const userId = membershipToUserId[ms.membership_id];
            if (!userId) return;

            if (!skillStatsMap[skill.id]) {
              skillStatsMap[skill.id] = {
                skill_id: skill.id,
                name: skill.name,
                color: skill.color || '#6366f1',
                total: 0,
                available: 0,
                onLeave: 0,
              };
            }
            skillStatsMap[skill.id].total++;
            if (onLeaveUserIds.has(userId)) {
              skillStatsMap[skill.id].onLeave++;
            } else {
              skillStatsMap[skill.id].available++;
            }
          });
        }
      }

      // Positions
      const roleMap: Record<string, PositionStat> = {};
      filteredUserIds.forEach(userId => {
        const m = memberByUserId[userId];
        const role = m?.business_role || t('skill_capacity_report.no_role');
        if (!roleMap[role]) roleMap[role] = { role, total: 0, available: 0, onLeave: 0 };
        roleMap[role].total++;
        if (onLeaveUserIds.has(userId)) {
          roleMap[role].onLeave++;
        } else {
          roleMap[role].available++;
        }
      });

      if (!cancelled) {
        setTotalMembers(total);
        setOnLeaveCount(onLeave);
        setSkillStats(
          Object.values(skillStatsMap).sort((a, b) => b.total - a.total).slice(0, 10),
        );
        setPositionStats(
          Object.values(roleMap).sort((a, b) => b.total - a.total).slice(0, 8),
        );
        setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [workspaceId, filteredUserIds, range]);

  const availableCount = totalMembers - onLeaveCount;
  const availabilityPct = totalMembers > 0 ? Math.round((availableCount / totalMembers) * 100) : 0;

  if (filteredUserIds.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t mt-4">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{t('skill_capacity_report.card_title')}</h3>
        <Badge variant="outline" className="text-[10px]">
          {format(range.from, 'yyyy.MM.dd')} – {format(range.to, 'MM.dd')}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">{totalMembers} tag</Badge>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GlassCard
            label={t('skill_capacity_report.label_filtered_members')}
            value={totalMembers}
            colorClass="bg-blue-500/10 border-blue-200 dark:border-blue-800"
            textClass="text-blue-700 dark:text-blue-300"
          />
          <GlassCard
            label={t('skill_capacity_report.label_available')}
            value={availableCount}
            colorClass="bg-emerald-500/10 border-emerald-200 dark:border-emerald-800"
            textClass="text-emerald-700 dark:text-emerald-300"
          />
          <GlassCard
            label={t('skill_capacity_report.label_approved_leave')}
            value={onLeaveCount}
            colorClass="bg-rose-500/10 border-rose-200 dark:border-rose-800"
            textClass="text-rose-700 dark:text-rose-300"
          />
          <GlassCard
            label={t('skill_capacity_report.label_availability_rate')}
            value={`${availabilityPct}%`}
            colorClass="bg-purple-500/10 border-purple-200 dark:border-purple-800"
            textClass="text-purple-700 dark:text-purple-300"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Skills progress bars */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('skill_capacity_report.skill_availability_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-7" />
                ))}
              </div>
            ) : skillStats.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {t('skill_capacity_report.no_skill_data')}
              </p>
            ) : (
              <div className="space-y-3">
                {skillStats.map(s => (
                  <div key={s.skill_id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">
                        {t('skill_capacity_report.available_count', { available: s.available, total: s.total } as any)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: s.total > 0 ? `${(s.available / s.total) * 100}%` : '0%',
                          backgroundColor: s.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Positions stacked bar */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('skill_capacity_report.position_capacity_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : positionStats.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {t('skill_capacity_report.no_position_data')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, positionStats.length * 28)}>
                <BarChart
                  data={positionStats}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis
                    dataKey="role"
                    type="category"
                    tick={{ fontSize: 10 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(v: any, name: any) => [
                      v,
                      name === 'available' ? t('skill_capacity_report.available_bar') : t('skill_capacity_report.away_bar'),
                    ]}
                  />
                  <Bar
                    dataKey="available"
                    name={t('skill_capacity_report.available_bar')}
                    fill="#10b981"
                    stackId="a"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="onLeave"
                    name={t('skill_capacity_report.away_bar')}
                    fill="#f43f5e"
                    stackId="a"
                    radius={[0, 3, 3, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GlassCard({
  label,
  value,
  colorClass,
  textClass,
}: {
  label: string;
  value: number | string;
  colorClass: string;
  textClass: string;
}) {
  return (
    <div className={cn('rounded-xl border p-3 backdrop-blur-sm', colorClass)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', textClass)}>{value}</p>
    </div>
  );
}
