import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Cake, PartyPopper, ChevronDown } from 'lucide-react';
import { format, getMonth, getDate } from 'date-fns';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

interface Milestone {
  id: string;
  name: string;
  type: 'birthday' | 'anniversary';
  date: Date;
}

/** Returns count of milestones falling within the next `days` calendar days from now. */
function checkUpcomingEvents(milestones: Milestone[], days = 7): number {
  const now = new Date();
  // Strip time to midnight for stable day-boundary comparisons
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  return milestones.filter(item => {
    // Project this year's occurrence
    let next = new Date(today.getFullYear(), getMonth(item.date), getDate(item.date));
    // If already passed this year, move to next year (handles leap-year birthday on Feb 29 gracefully)
    if (next < today) {
      next = new Date(today.getFullYear() + 1, getMonth(item.date), getDate(item.date));
    }
    return next >= today && next <= cutoff;
  }).length;
}

/** Returns true if the milestone falls within the next `days` calendar days. */
function isWithinWindow(item: Milestone, days = 7): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  let next = new Date(today.getFullYear(), getMonth(item.date), getDate(item.date));
  if (next < today) next = new Date(today.getFullYear() + 1, getMonth(item.date), getDate(item.date));
  return next >= today && next <= cutoff;
}

export function BirthdayAnniversaryWidget({ workspaceId }: Props) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: memberships }, { data: profiles }] = await Promise.all([
        (supabase as any)
          .from('enterprise_memberships')
          .select('id,user_id,joined_at')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),
        (supabase as any)
          .from('profiles')
          .select('user_id,display_name,preferences'),
      ]);

      const profileMap = new Map<string, any>(
        (profiles || []).map((p: any) => [p.user_id, p]),
      );
      const built: Milestone[] = [];

      (memberships || []).forEach((m: any) => {
        const profile = profileMap.get(m.user_id);
        const displayName = profile?.display_name || 'Ismeretlen';

        if (m.joined_at) {
          built.push({
            id: `ann-${m.id}`,
            name: displayName,
            type: 'anniversary',
            date: new Date(m.joined_at),
          });
        }

        const birthdayRaw = profile?.preferences?.birthday;
        if (birthdayRaw) {
          built.push({
            id: `bday-${m.id}`,
            name: displayName,
            type: 'birthday',
            date: new Date(birthdayRaw),
          });
        }
      });

      setRows(built);
      setLoading(false);
    };

    load();
  }, [workspaceId]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const withDistance = rows.map(item => {
      const d = new Date(now.getFullYear(), getMonth(item.date), getDate(item.date));
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...item, nextDate: d, diff };
    });
    return withDistance.sort((a, b) => a.diff - b.diff).slice(0, 6);
  }, [rows]);

  const soonCount = useMemo(() => checkUpcomingEvents(rows, 7), [rows]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cake className="h-4 w-4 text-primary" />
              {t('birthday_widget.card_title')}
              {soonCount > 0 && !loading && (
                <span className="bg-red-500 text-white rounded-full text-xs font-bold px-2 py-0.5 ml-1 leading-none">
                  {soonCount}
                </span>
              )}
            </CardTitle>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-1 border-t">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {t('birthday_widget.empty')}
              </p>
            ) : (
              <div className="space-y-2 pt-2">
                {upcoming.map(item => {
                  const soon = isWithinWindow(item, 7);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between border rounded-md p-2 transition-colors',
                        soon && 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {item.type === 'birthday' ? (
                          <Cake className="h-3.5 w-3.5 text-pink-500" />
                        ) : (
                          <PartyPopper className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium leading-none">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {item.type === 'birthday' ? t('birthday_widget.type_birthday') : t('birthday_widget.type_anniversary')} ·{' '}
                            {format(item.nextDate, 'yyyy.MM.dd')}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn('text-[10px]', soon && 'border-red-300 text-red-600 dark:text-red-400')}
                      >
                        {item.diff <= 0 ? 'Ma' : `${item.diff} nap`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
