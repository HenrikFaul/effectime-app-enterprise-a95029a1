import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ClipboardList, Zap, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';
import { useOpenShiftRequests, useClaimOpenShift, useJoinWaitlist } from '@/hooks/useOpenShifts';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  workspaceId: string;
  membershipId?: string;
}

function useMemberProfile(membershipId: string | undefined) {
  return useQuery({
    queryKey: ['member-profile-for-shifts', membershipId],
    enabled: !!membershipId,
    staleTime: 60_000,
    queryFn: async () => {
      const [memRes, skillRes] = await Promise.all([
        (supabase as any).from('enterprise_memberships')
          .select('business_role')
          .eq('id', membershipId)
          .maybeSingle(),
        (supabase as any).from('enterprise_member_skills')
          .select('skill_id')
          .eq('membership_id', membershipId),
      ]);
      return {
        businessRole: (memRes.data?.business_role ?? null) as string | null,
        skillIds: ((skillRes.data ?? []) as { skill_id: string }[]).map(s => s.skill_id),
      };
    },
  });
}

export function OpenShiftPanel({ workspaceId, membershipId }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const { data: requests = [], isLoading: isShiftsLoading } = useOpenShiftRequests(workspaceId);
  const { data: memberProfile, isLoading: isProfileLoading } = useMemberProfile(membershipId);
  const claim = useClaimOpenShift();
  const joinWaitlist = useJoinWaitlist();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [waitlistingId, setWaitlistingId] = useState<string | null>(null);

  const isLoading = isShiftsLoading || (!!membershipId && isProfileLoading);

  // Filter to open shifts matching member's role/skills, plus filled shifts (for waitlist)
  const visible = requests.filter(r => {
    if (r.status === 'cancelled') return false;
    if (!memberProfile) return !membershipId;
    const roleMatch = !r.business_role || r.business_role === memberProfile.businessRole;
    const effectiveSkillIds: string[] = r.skill_ids?.length ? r.skill_ids : (r.skill_id ? [r.skill_id] : []);
    const skillMatch = effectiveSkillIds.length === 0 ||
      effectiveSkillIds.some(sid => memberProfile.skillIds.includes(sid));
    return roleMatch && skillMatch;
  });
  const open = visible.filter(r => r.status === 'open');
  const filled = visible.filter(r => r.status === 'filled');

  const handleJoinWaitlist = async (requestId: string) => {
    setWaitlistingId(requestId);
    try {
      await joinWaitlist.mutateAsync(requestId);
      toast.success(t('open_shifts.waitlist_joined'));
    } catch {
      toast.error(t('open_shifts.waitlist_error'));
    } finally {
      setWaitlistingId(null);
    }
  };

  const handleClaim = async (requestId: string) => {
    setClaimingId(requestId);
    try {
      await claim.mutateAsync(requestId);
      toast.success(t('open_shifts.claim_success'));
    } catch (err: any) {
      const msg = (err?.message ?? '') + (err?.code ?? '');
      if (msg.includes('request_not_open')) {
        toast.error(t('open_shifts.already_filled'));
      } else if (msg.includes('already_assigned')) {
        toast.error(t('open_shifts.already_assigned'));
      } else if (msg.includes('not_member')) {
        toast.error(t('open_shifts.not_member'));
      } else if (msg.includes('not_authenticated')) {
        toast.error(t('open_shifts.not_authenticated'));
      } else if (msg.includes('request_not_found')) {
        toast.error(t('open_shifts.not_found'));
      } else {
        toast.error(t('open_shifts.claim_error'));
      }
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          {t('open_shifts.title')}
          {open.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">{open.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-14 rounded" />)}
          </div>
        ) : open.length === 0 && filled.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('open_shifts.empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {open.map(req => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-2 rounded border px-3 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {format(new Date(`${req.shift_date}T00:00:00`), 'EEEE, d MMMM', { locale: dateFnsLocale })}
                  </p>
                  {(req.business_role || req.notes) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {[req.business_role, req.notes].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      className="shrink-0 gap-1"
                      disabled={claim.isPending && claimingId === req.id}
                    >
                      <Zap className="h-3 w-3" />
                      {t('open_shifts.claim')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('open_shifts.confirm_title')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('open_shifts.confirm_desc', {
                          date: format(new Date(`${req.shift_date}T00:00:00`), 'EEEE, d MMMM yyyy', { locale: dateFnsLocale }),
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('open_shifts.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleClaim(req.id)}>
                        {t('open_shifts.confirm_claim')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}

            {/* Filled shifts — show waitlist option */}
            {filled.map(req => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-2 rounded border px-3 py-2 bg-muted/30 border-muted-foreground/20 opacity-75"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {format(new Date(`${req.shift_date}T00:00:00`), 'EEEE, d MMMM', { locale: dateFnsLocale })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('open_shifts.filled_label')}
                    {req.business_role && ` · ${req.business_role}`}
                  </p>
                </div>
                {membershipId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1 text-xs"
                    disabled={joinWaitlist.isPending && waitlistingId === req.id}
                    onClick={() => handleJoinWaitlist(req.id)}
                  >
                    {joinWaitlist.isPending && waitlistingId === req.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Clock className="h-3 w-3" />}
                    {t('open_shifts.join_waitlist')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
