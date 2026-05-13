import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Trophy, Medal, Calendar, HandHeart, HeartHandshake, UserCheck, Lock, Award } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useAchievementsCatalog, useMemberAchievements, useMemberStreaks } from '@/hooks/useEngagement';
import { Skeleton } from '@/components/ui/skeleton';

// Lucide icon name → component map. Keep narrow; the migration only seeds
// names that exist here. Adding a new seed icon requires updating this map.
const ICON_MAP: Record<string, typeof Flame> = {
  Flame, Trophy, Medal, Calendar, HandHeart, HeartHandshake, UserCheck, Award,
};

interface Props {
  workspaceId: string;
  membershipId: string;
  /** When true, shows team-relative wording instead of self ("they" vs "you"). */
  isOtherMember?: boolean;
}

/**
 * AchievementsPanel — Top-20 Rank 14, shipped v3.18.0.
 *
 * Renders the badge wall + streak counters for a member. Read-only; awards
 * happen server-side via `engagement_record_event` RPC triggered by other UI
 * flows (clock-in, leave submit, shift swap accept, profile complete).
 *
 * Self-determination-theory aligned: emphasizes mastery (progress toward
 * locked badges) and autonomy (per-member opt-out respected by the RPC).
 * No leaderboards, no public shaming.
 */
export function AchievementsPanel({ workspaceId, membershipId, isOtherMember = false }: Props) {
  const { t } = useI18n();
  const { data: catalog, isLoading: loadingCatalog } = useAchievementsCatalog();
  const { data: earned, isLoading: loadingEarned } = useMemberAchievements(workspaceId, membershipId);
  const { data: streaks, isLoading: loadingStreaks } = useMemberStreaks(workspaceId, membershipId);

  const earnedIds = useMemo(() => new Set((earned ?? []).map(e => e.achievement_id)), [earned]);
  const streakByType = useMemo(() => {
    const m = new Map<string, { current: number; longest: number }>();
    for (const s of streaks ?? []) m.set(s.streak_type, { current: s.current_count, longest: s.longest_count });
    return m;
  }, [streaks]);

  const isLoading = loadingCatalog || loadingEarned || loadingStreaks;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Group by category for visual hierarchy
  const grouped = new Map<string, typeof catalog>();
  for (const ach of catalog ?? []) {
    const arr = grouped.get(ach.category) ?? [];
    arr.push(ach);
    grouped.set(ach.category, arr);
  }

  return (
    <div className="space-y-4">
      {/* Streak counters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            {t('engagement.streaks_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {streakByType.size === 0 ? (
            <p className="text-xs text-muted-foreground">{t(isOtherMember ? 'engagement.no_streaks_other' : 'engagement.no_streaks_self')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from(streakByType.entries()).map(([type, s]) => (
                <div key={type} className="rounded-lg border bg-background/60 p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t(`engagement.streak_${type}` as 'engagement.streak_punctuality')}</div>
                  <div className="text-lg font-bold">{s.current}</div>
                  <div className="text-[10px] text-muted-foreground">{t('engagement.streak_longest', { count: s.longest })}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badge wall — earned + locked */}
      {Array.from(grouped.entries()).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              {t(`engagement.category_${category}` as 'engagement.category_attendance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(items ?? []).map(ach => {
                const isEarned = earnedIds.has(ach.id);
                const Icon = ICON_MAP[ach.icon] ?? Award;
                const earnedRow = (earned ?? []).find(e => e.achievement_id === ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`rounded-lg border p-3 flex flex-col items-center text-center gap-1.5 transition-colors ${
                      isEarned
                        ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                        : 'border-dashed border-muted-foreground/30 bg-muted/40 opacity-70'
                    }`}
                    title={t(`engagement.achievement_${ach.key}_desc` as 'engagement.achievement_punctual_5_days_desc')}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isEarned ? 'bg-amber-200 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      {isEarned ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                    </div>
                    <div className="text-xs font-medium">{t(`engagement.achievement_${ach.key}_name` as 'engagement.achievement_punctual_5_days_name')}</div>
                    {isEarned && earnedRow ? (
                      <Badge variant="outline" className="text-[10px]">
                        {new Date(earnedRow.earned_at).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {t('engagement.locked_threshold', { threshold: ach.threshold })}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
