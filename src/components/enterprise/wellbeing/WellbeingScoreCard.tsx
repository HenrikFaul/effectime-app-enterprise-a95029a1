import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Heart, Info, AlertCircle } from 'lucide-react';

interface Props {
  workspaceId: string;
  userId: string;
}

interface WellbeingComponents {
  overtime_score?: number;
  leave_utilization_score?: number;
  weekend_density_score?: number;
  schedule_stability_score?: number;
  recovery_score?: number;
}

interface ScoreData {
  score: number;
  components: WellbeingComponents;
  calculated_at: string;
}

interface QuotaBalance {
  leave_type: string;
  initial_days: number;
  carryover_days: number;
  manual_adjustment_days: number;
  used_days: number;
}

function scoreLabel(score: number, t: (key: string) => string): string {
  if (score >= 70) return t('wellbeing.interpretation_healthy');
  if (score >= 40) return t('wellbeing.interpretation_monitor');
  return t('wellbeing.interpretation_at_risk');
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'bg-green-100 text-green-800 border-green-300';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-red-100 text-red-800 border-red-300';
}

function scoreRingClass(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

const COMPONENT_KEYS: Array<{ key: keyof WellbeingComponents; labelKey: string }> = [
  { key: 'overtime_score', labelKey: 'wellbeing.component_overtime' },
  { key: 'leave_utilization_score', labelKey: 'wellbeing.component_leave_util' },
  { key: 'weekend_density_score', labelKey: 'wellbeing.component_weekend' },
  { key: 'schedule_stability_score', labelKey: 'wellbeing.component_schedule' },
  { key: 'recovery_score', labelKey: 'wellbeing.component_recovery' },
];

export function WellbeingScoreCard({ workspaceId, userId }: Props) {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [quotaBalances, setQuotaBalances] = useState<QuotaBalance[]>([]);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [hasQuotaTable, setHasQuotaTable] = useState(true);

  const loadScore = useCallback(async () => {
    setLoading(true);

    // Resolve membership id for this user in this workspace
    const { data: membership } = await supabase
      .from('enterprise_memberships')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      setScoreData(null);
      setLoading(false);
      return;
    }

    const { data: ws } = await (supabase as any)
      .from('wellbeing_scores')
      .select('score, components, calculated_at')
      .eq('workspace_id', workspaceId)
      .eq('membership_id', (membership as any).id)
      .maybeSingle();

    setScoreData(ws ?? null);
    setLoading(false);
  }, [workspaceId, userId]);

  const loadQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      const { data: membership } = await supabase
        .from('enterprise_memberships')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (!membership) {
        setHasQuotaTable(false);
        setQuotaLoading(false);
        return;
      }

      const { data: balances, error } = await (supabase as any)
        .from('enterprise_leave_quota_balances')
        .select('leave_type, initial_days, carryover_days, manual_adjustment_days, used_days')
        .eq('workspace_id', workspaceId)
        .eq('membership_id', (membership as any).id)
        .eq('year', new Date().getFullYear());

      if (error) {
        setHasQuotaTable(false);
      } else {
        setQuotaBalances(balances || []);
        setHasQuotaTable(true);
      }
    } catch {
      setHasQuotaTable(false);
    } finally {
      setQuotaLoading(false);
    }
  }, [workspaceId, userId]);

  useEffect(() => {
    loadScore();
    loadQuota();
  }, [loadScore, loadQuota]);

  const totalAvailableDays = quotaBalances.reduce((acc, b) => {
    const total = (b.initial_days ?? 0) + (b.carryover_days ?? 0) + (b.manual_adjustment_days ?? 0);
    return acc + total - (b.used_days ?? 0);
  }, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-20 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-500" />
          {t('wellbeing.score_card_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {scoreData === null ? (
          /* No score yet */
          <div className="flex flex-col items-center gap-3 py-6 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">{t('wellbeing.no_score_yet')}</p>
            <p className="text-xs">{t('wellbeing.no_score_hint')}</p>
          </div>
        ) : (
          <>
            {/* Large score badge */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${scoreBadgeClass(scoreData.score)}`}
              >
                <span className={`text-3xl font-bold ${scoreRingClass(scoreData.score)}`}>
                  {scoreData.score}
                </span>
              </div>
              <Badge className={scoreBadgeClass(scoreData.score)} variant="outline">
                {scoreLabel(scoreData.score, t)}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {t('wellbeing.calculated_at')}{' '}
                {new Date(scoreData.calculated_at).toLocaleDateString()}
              </p>
            </div>

            {/* Component breakdown */}
            {scoreData.components && Object.keys(scoreData.components).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('wellbeing.breakdown_title')}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t('wellbeing.breakdown_factor')}</TableHead>
                      <TableHead className="text-xs text-right">{t('wellbeing.breakdown_score')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPONENT_KEYS.map(({ key, labelKey }) => {
                      const val = scoreData.components[key];
                      if (val === undefined) return null;
                      return (
                        <TableRow key={key}>
                          <TableCell className="text-xs py-1.5">{t(labelKey)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5 font-medium">
                            <span className={val >= 70 ? 'text-green-600' : val >= 40 ? 'text-yellow-600' : 'text-red-600'}>
                              {val}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Leave hint */}
            {scoreData.score < 60 && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-700 space-y-0.5">
                  <p className="font-medium">{t('wellbeing.leave_hint_title')}</p>
                  {quotaLoading ? (
                    <Skeleton className="h-3 w-32" />
                  ) : hasQuotaTable && quotaBalances.length > 0 ? (
                    <p>
                      {t('wellbeing.leave_hint_with_days').replace(
                        '{{days}}',
                        String(Math.max(0, Math.round(totalAvailableDays))),
                      )}
                    </p>
                  ) : (
                    <p>{t('wellbeing.leave_hint_no_data')}</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
