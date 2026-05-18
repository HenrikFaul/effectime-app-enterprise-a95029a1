import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ClipboardList, Zap, Clock, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';
import { useOpenShiftRequests, useClaimOpenShift, useJoinWaitlist } from '@/hooks/useOpenShifts';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  workspaceId: string;
  membershipId?: string;
  noCard?: boolean;
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

export function OpenShiftPanel({ workspaceId, membershipId, noCard }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: requests = [], isLoading: isShiftsLoading } = useOpenShiftRequests(workspaceId);
  const { data: memberProfile, isLoading: isProfileLoading } = useMemberProfile(membershipId);
  const claim = useClaimOpenShift();
  const joinWaitlist = useJoinWaitlist();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [waitlistingId, setWaitlistingId] = useState<string | null>(null);

  // Employee's own shift assignments — used to hide irrelevant open shifts on occupied days
  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-shift-assignments', workspaceId, userId],
    enabled: !!workspaceId && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('enterprise_shift_assignments')
        .select('shift_date')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);
      return (data ?? []) as { shift_date: string }[];
    },
  });
  const myAssignedDates = useMemo(() => new Set(myAssignments.map(a => a.shift_date)), [myAssignments]);

  // Dates where this user is the filled assignee — derived directly from the already-fresh
  // requests list so the filter stays correct immediately after a successful claim (before
  // the myAssignments cache has time to re-fetch).
  const myFilledDates = useMemo(() =>
    new Set(requests.filter(r => r.status === 'filled' && !!userId && r.filled_by_user_id === userId).map(r => r.shift_date)),
    [requests, userId]
  );

  const isLoading = isShiftsLoading || (!!membershipId && isProfileLoading);

  // Filter to open shifts matching member's role/skills, plus filled shifts (for waitlist).
  // Any shift on a day the employee is already assigned to is hidden — except their own
  // accepted shift ("Beosztva"), which is always shown.
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const visible = requests.filter(r => {
    if (r.shift_date < todayStr) return false;
    if (r.status === 'cancelled') return false;
    // Always show the shift the user themselves was assigned to ("Beosztva" exception)
    const isMyAssignment = r.status === 'filled' && !!userId && r.filled_by_user_id === userId;
    // Hide any other shift on a day already occupied (from DB query OR from in-memory filled list)
    if (!isMyAssignment && !!userId && (myAssignedDates.has(r.shift_date) || myFilledDates.has(r.shift_date))) return false;
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

  const shiftListContent = (
    <div className="space-y-2">
      {open.map(req => {
        // Was the current user personally targeted/invited for this shift?
        const isInvited = !!userId && (
          (req.target_user_ids ?? []).includes(userId) ||
          // Targeted broadcast: target_user_ids is set AND non-empty
          ((req.target_user_ids ?? []).length > 0 && (req.notified_user_ids ?? []).includes(userId))
        );

        return (
          <div
            key={req.id}
            className={`flex items-center justify-between gap-2 rounded border px-3 py-2 ${
              isInvited
                ? 'bg-emerald-50/60 dark:bg-emerald-900/15 border-emerald-300 dark:border-emerald-700'
                : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
            }`}
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
              {isInvited && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                  {t('open_shifts.invited_label')}
                </p>
              )}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  className={`shrink-0 gap-1 ${
                    isInvited
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0'
                      : ''
                  }`}
                  disabled={claim.isPending && claimingId === req.id}
                >
                  {claim.isPending && claimingId === req.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : isInvited
                      ? <Check className="h-3 w-3" />
                      : <Zap className="h-3 w-3" />}
                  {isInvited ? t('open_shifts.accept') : t('open_shifts.claim')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isInvited ? t('open_shifts.confirm_accept_title') : t('open_shifts.confirm_title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('open_shifts.confirm_desc', {
                      date: format(new Date(`${req.shift_date}T00:00:00`), 'EEEE, d MMMM yyyy', { locale: dateFnsLocale }),
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('open_shifts.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleClaim(req.id)}>
                    {isInvited ? t('open_shifts.accept') : t('open_shifts.confirm_claim')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      })}

      {/* Filled shifts */}
      {filled.map(req => {
        const iAssigned = !!userId && req.filled_by_user_id === userId;

        return (
          <div
            key={req.id}
            className={`flex items-center justify-between gap-2 rounded border px-3 py-2 ${
              iAssigned
                ? 'bg-emerald-50/60 dark:bg-emerald-900/15 border-emerald-300 dark:border-emerald-700'
                : 'bg-muted/30 border-muted-foreground/20 opacity-75'
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {format(new Date(`${req.shift_date}T00:00:00`), 'EEEE, d MMMM', { locale: dateFnsLocale })}
              </p>
              <p className="text-xs text-muted-foreground">
                {iAssigned ? t('open_shifts.assigned_to_you') : t('open_shifts.filled_label')}
                {req.business_role && ` · ${req.business_role}`}
              </p>
            </div>
            {iAssigned ? (
              <Badge className="shrink-0 gap-1 bg-emerald-600 hover:bg-emerald-600 text-white border-0">
                <CheckCircle2 className="h-3 w-3" />
                {t('open_shifts.assigned_badge')}
              </Badge>
            ) : membershipId && (
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
        );
      })}
    </div>
  );

  if (noCard) {
    return (
      <div>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 rounded" />)}</div>
        ) : open.length === 0 && filled.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('open_shifts.empty')}</p>
        ) : (
          shiftListContent
        )}
      </div>
    );
  }

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
          shiftListContent
        )}
      </CardContent>
    </Card>
  );
}
