import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { logAuditEvent } from '@/lib/auditLog';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import { LeaveRequestDialog } from './LeaveRequestDialog';

interface Props {
  workspaceId: string;
  userId: string;
  userRole: string;
  canViewOwn?: boolean;
  canViewTeam?: boolean;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Piszkozat', variant: 'outline' },
  pending: { label: 'Függőben', variant: 'secondary' },
  approved: { label: 'Jóváhagyva', variant: 'default' },
  rejected: { label: 'Elutasítva', variant: 'destructive' },
  cancelled: { label: 'Visszavonva', variant: 'outline' },
  withdrawn: { label: 'Lemondva', variant: 'outline' },
  expired: { label: 'Lejárt', variant: 'outline' },
};

const TYPE_MAP: Record<string, string> = {
  vacation: 'Szabadság',
  sick_leave: 'Betegszabadság',
  unpaid_leave: 'Fizetés nélküli',
  other: 'Egyéb',
};

export function LeaveRequestList({ workspaceId, userId, userRole, canViewOwn = true, canViewTeam = false }: Props) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const isAdmin = userRole === 'owner' || userRole === 'resourceAssistant';
  // Admin always sees all; otherwise respect canViewTeam
  const showAllRequests = isAdmin || canViewTeam;

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('leave_requests')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    // If not admin and no team view permission, only show own
    if (!showAllRequests) {
      query = query.eq('user_id', userId);
    }

    const { data } = await query;
    const items = (data as any[]) || [];
    setRequests(items);

    // Fetch display names
    const userIds = [...new Set(items.map(r => r.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);
      const map: Record<string, string> = {};
      (profileData || []).forEach((p: any) => { map[p.user_id] = p.display_name || 'Ismeretlen'; });
      setProfiles(map);
    }

    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [workspaceId]);

  const handleCancel = async (id: string) => {
    const reason = window.prompt('Visszavonás indoka (opcionális):') ?? '';
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' as any, cancellation_reason: reason.trim() || null } as any)
      .eq('id', id);
    if (error) {
      toast.error('Hiba a visszavonáskor');
    } else {
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'leave_request.cancelled',
        target_id: id,
        target_type: 'leave_request',
        metadata: { reason: reason.trim() || null },
      });
      toast.success('Kérelem visszavonva');
      fetchRequests();
    }
  };

  const handleWithdraw = async (id: string) => {
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' as any })
      .eq('id', id);
    if (error) {
      toast.error('Hiba a lemondáskor');
    } else {
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'leave_request.withdrawn',
        target_id: id,
        target_type: 'leave_request',
        metadata: { reason: 'Jóváhagyott szabadság lemondva a kérelmező által' },
      });
      toast.success('Szabadság lemondva');
      fetchRequests();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Új kérelem
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            {showAllRequests
              ? 'Nincs távolléti kérelem ebben a munkaterületben.'
              : 'Nincs saját távolléti kérelmed.'}
          </CardContent>
        </Card>
      ) : (
        requests.map((req) => {
          const isCancelled = req.status === 'cancelled';
          const status = STATUS_MAP[req.status] || STATUS_MAP.pending;
          return (
            <Card key={req.id} className={isCancelled ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>{profiles[req.user_id] || 'Ismeretlen'}</span>
                    <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    <Badge variant="outline" className="text-xs">{TYPE_MAP[req.leave_type] || req.leave_type}</Badge>
                  </div>
                  <p className={`text-xs text-muted-foreground ${isCancelled ? 'line-through' : ''}`}>
                    {format(new Date(req.start_date), 'yyyy.MM.dd', { locale: hu })} – {format(new Date(req.end_date), 'yyyy.MM.dd', { locale: hu })}
                  </p>
                  {req.comment && <p className="text-xs text-muted-foreground truncate">{req.comment}</p>}
                  {req.review_comment && (
                    <p className="text-xs text-muted-foreground italic">Döntés: {req.review_comment}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  {req.user_id === userId && (req.status === 'pending' || req.status === 'draft') && (
                    <Button variant="ghost" size="sm" onClick={() => handleCancel(req.id)} className="text-destructive text-xs">
                      Visszavonás
                    </Button>
                  )}
                  {req.user_id === userId && req.status === 'approved' && (
                    <Button variant="ghost" size="sm" onClick={() => handleWithdraw(req.id)} className="text-destructive text-xs">
                      Lemondás
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
        onCreated={fetchRequests}
      />
    </div>
  );
}
