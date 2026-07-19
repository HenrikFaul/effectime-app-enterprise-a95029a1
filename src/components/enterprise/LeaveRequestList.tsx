import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { logAuditEvent } from '@/lib/auditLog';
import { toast } from 'sonner';
import { LeaveRequestDialog } from './LeaveRequestDialog';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
  userRole: string;
  canViewOwn?: boolean;
  canViewTeam?: boolean;
  refreshKey?: number;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  cancelled: 'outline',
  withdrawn: 'outline',
  expired: 'outline',
};

export function LeaveRequestList({ workspaceId, userId, userRole, canViewOwn = true, canViewTeam = false, refreshKey = 0 }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [committedQueryScope, setCommittedQueryScope] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);

  const isAdmin = userRole === 'owner' || userRole === 'resourceAssistant';
  // Admin always sees all; otherwise respect canViewTeam
  const showAllRequests = isAdmin || canViewTeam;
  const queryScope = JSON.stringify([
    workspaceId,
    userId,
    showAllRequests,
    refreshKey,
    refreshRevision,
  ]);

  const fetchRequests = useCallback(async () => {
    const requestId = ++requestSequenceRef.current;
    const queryScopeSnapshot = queryScope;
    setLoading(true);
    try {
      let query = supabase
        .from('leave_requests')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      // If not admin and no team view permission, only show own.
      if (!showAllRequests) query = query.eq('user_id', userId);

      const { data, error: queryError } = await query;
      if (requestId !== requestSequenceRef.current) return;
      if (queryError) throw new Error('leave_query_failed');
      const items = data || [];
      const profileMap: Record<string, string> = {};

      const userIds = [...new Set(items.map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        if (requestId !== requestSequenceRef.current) return;
        if (profileError) throw new Error('profile_query_failed');
        (profileData || []).forEach(p => {
          profileMap[p.user_id] = p.display_name || t('approval_inbox.unknown');
        });
      }
      if (requestId !== requestSequenceRef.current) return;

      setRequests(items);
      setProfiles(profileMap);
      setCommittedQueryScope(queryScopeSnapshot);
    } catch (err) {
      if (requestId !== requestSequenceRef.current) return;
      console.error(
        '[LeaveRequestList] Failed to fetch leave requests',
        err instanceof Error ? err.message : 'unknown_failure',
      );
      setRequests([]);
      setProfiles({});
      setCommittedQueryScope(queryScopeSnapshot);
    } finally {
      if (requestId === requestSequenceRef.current) setLoading(false);
    }
  }, [queryScope, showAllRequests, t, userId, workspaceId]);

  // Query scope includes the effective access context; cleanup prevents a
  // broader obsolete response from committing after a permission downgrade.
  useEffect(() => {
    void fetchRequests();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [fetchRequests]);

  const handleCancel = async (id: string) => {
    const reason = window.prompt(t('approval_inbox.cancel_prompt')) ?? '';
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' as any, cancellation_reason: reason.trim() || null } as any)
      .eq('id', id);
    if (error) {
      toast.error(t('approval_inbox.cancel_failed'));
    } else {
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'leave_request.cancelled',
        target_id: id,
        target_type: 'leave_request',
        metadata: { reason: reason.trim() || null },
      });
      toast.success(t('approval_inbox.cancelled'));
      setRefreshRevision(current => current + 1);
    }
  };

  const handleWithdraw = async (id: string) => {
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' as any })
      .eq('id', id);
    if (error) {
      toast.error(t('approval_inbox.withdraw_failed'));
    } else {
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'leave_request.withdrawn',
        target_id: id,
        target_type: 'leave_request',
        metadata: { reason: 'Approved leave withdrawn by requester' },
      });
      toast.success(t('approval_inbox.withdrawn'));
      setRefreshRevision(current => current + 1);
    }
  };

  if (loading || committedQueryScope !== queryScope) {
    return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> {t('approval_inbox.new_request')}
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            {showAllRequests
              ? t('approval_inbox.no_workspace_requests')
              : t('approval_inbox.no_own_requests')}
          </CardContent>
        </Card>
      ) : (
        requests.map((req) => {
          const isCancelled = req.status === 'cancelled';
          const statusVariant = STATUS_VARIANTS[req.status] ?? 'outline';
          return (
            <Card key={req.id} className={isCancelled ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>{profiles[req.user_id] || t('approval_inbox.unknown')}</span>
                    <Badge variant={statusVariant} className="text-xs">{t(`approval_inbox.status_${req.status}` as any)}</Badge>
                    <Badge variant="outline" className="text-xs">{t(`approval_inbox.type_${req.leave_type}` as any)}</Badge>
                  </div>
                  <p className={`text-xs text-muted-foreground ${isCancelled ? 'line-through' : ''}`}>
                    {format(new Date(req.start_date), 'yyyy.MM.dd', { locale: dateFnsLocale })} – {format(new Date(req.end_date), 'yyyy.MM.dd', { locale: dateFnsLocale })}
                  </p>
                  {req.comment && <p className="text-xs text-muted-foreground truncate">{req.comment}</p>}
                  {req.review_comment && (
                    <p className="text-xs text-muted-foreground italic">{t('approval_inbox.review_decision', { comment: req.review_comment })}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  {req.user_id === userId && (req.status === 'pending' || req.status === 'draft') && (
                    <Button variant="ghost" size="sm" onClick={() => handleCancel(req.id)} className="text-destructive text-xs">
                      {t('approval_inbox.cancel_action')}
                    </Button>
                  )}
                  {req.user_id === userId && req.status === 'approved' && (
                    <Button variant="ghost" size="sm" onClick={() => handleWithdraw(req.id)} className="text-destructive text-xs">
                      {t('approval_inbox.withdraw_action')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <LeaveRequestDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        workspaceId={workspaceId}
        userId={userId}
        onCreated={() => setRefreshRevision(current => current + 1)}
      />
    </div>
  );
}
