import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Wallet } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
  year?: number;
}

interface Balance {
  quota_id: string;
  leave_type: string;
  year: number;
  initial_days: number;
  carryover_days: number;
  manual_adjustment_days: number;
  consumed_days: number;
  refunded_days: number;
  available_days: number;
  carryover_expires_at: string | null;
}

export function QuotaBalanceCard({ workspaceId, userId, year = new Date().getFullYear() }: Props) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  const TYPE_LABELS: Record<string, string> = {
    vacation: t('leave_request.type_vacation'),
    sick_leave: t('leave_request.type_sick_leave'),
    unpaid_leave: t('leave_request.type_unpaid_leave'),
    other: t('leave_request.type_other'),
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Find own membership
      const { data: m } = await supabase
        .from('enterprise_memberships')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!m) { setLoading(false); return; }
      const { data } = await (supabase as any)
        .from('enterprise_leave_quota_balances')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('membership_id', m.id)
        .eq('year', year);
      setBalances((data as Balance[]) || []);
      setLoading(false);
    })();
  }, [workspaceId, userId, year]);

  if (loading) return null;
  if (balances.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          {t('quota_balance.title', { year })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {balances.map((b) => {
          const total = Number(b.initial_days) + Number(b.carryover_days) + Number(b.manual_adjustment_days);
          const consumed = Math.abs(Number(b.consumed_days) + Number(b.refunded_days));
          const pct = total > 0 ? Math.min(100, (consumed / total) * 100) : 0;
          return (
            <div key={b.quota_id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{TYPE_LABELS[b.leave_type] || b.leave_type}</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {Number(b.available_days).toFixed(1)} / {total.toFixed(1)} {t('quota_balance.days_unit')}
                </Badge>
              </div>
              <Progress value={pct} className="h-1.5" />
              {b.carryover_days > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {t('quota_balance.carryover', { n: Number(b.carryover_days).toFixed(1) })}
                  {b.carryover_expires_at && <>{' '}{t('quota_balance.expires', { date: b.carryover_expires_at })}</>}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
