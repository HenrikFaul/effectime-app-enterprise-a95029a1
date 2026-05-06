import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Server, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
  userId: string;
}

interface Membership {
  id: string;
  user_id: string;
  display_name?: string;
}

interface SystemRow {
  id: string;
  name: string;
}

interface AccessRequest {
  id: string;
  member_id: string;
  system_id: string;
  status: string;
  reason: string | null;
  requested_at: string;
  decided_at: string | null;
}

const STATUSES = ['pending', 'approved', 'provisioning', 'granted', 'rejected', 'revoked', 'cancelled'] as const;

export function AccessInbox({ workspaceId, isAdmin, userId }: Props) {
  const t = useT();
  const [members, setMembers] = useState<Membership[]>([]);
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [memberId, setMemberId] = useState('');
  const [systemId, setSystemId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: ms }, { data: sys }, { data: req }] = await Promise.all([
      (supabase as any).from('enterprise_memberships').select('id, user_id').eq('workspace_id', workspaceId).eq('status', 'active'),
      (supabase as any).from('enterprise_access_systems').select('id, name').eq('workspace_id', workspaceId).is('archived_at', null).order('name'),
      (supabase as any).from('enterprise_access_requests').select('*').eq('workspace_id', workspaceId).order('requested_at', { ascending: false }),
    ]);

    const ids = ((ms as any[]) || []).map((m: any) => m.user_id);
    if (ids.length > 0) {
      const { data: prof } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids);
      const nameMap = new Map((prof || []).map((p: any) => [p.user_id, p.display_name || 'Unknown']));
      setMembers(((ms as any[]) || []).map((m: any) => ({ ...m, display_name: nameMap.get(m.user_id) })));
    } else {
      setMembers([]);
    }
    setSystems((sys as SystemRow[]) || []);
    setRequests((req as AccessRequest[]) || []);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!memberId || !systemId) return;
    setBusy(true);
    const { data, error } = await (supabase as any)
      .from('enterprise_access_requests')
      .insert({
        workspace_id: workspaceId,
        member_id: memberId,
        system_id: systemId,
        reason: reason.trim() || null,
        status: 'pending',
        requested_by: userId,
      })
      .select('id')
      .single();
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    if (data) {
      await (supabase as any).from('enterprise_access_decisions').insert({
        request_id: data.id,
        action: 'submit',
        actor_id: userId,
      });
    }
    setBusy(false);
    setMemberId('');
    setSystemId('');
    setReason('');
    toast.success(t('common.save'));
    load();
  };

  const decide = async (req: AccessRequest, action: 'approve' | 'reject' | 'revoke' | 'cancel' | 'mark_granted') => {
    const newStatus =
      action === 'approve' ? 'approved' :
      action === 'reject' ? 'rejected' :
      action === 'revoke' ? 'revoked' :
      action === 'cancel' ? 'cancelled' :
      action === 'mark_granted' ? 'granted' : req.status;

    const { error } = await (supabase as any)
      .from('enterprise_access_requests')
      .update({ status: newStatus, decided_at: new Date().toISOString(), decided_by: userId })
      .eq('id', req.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await (supabase as any).from('enterprise_access_decisions').insert({
      request_id: req.id,
      action: action === 'mark_granted' ? 'approve' : action,
      actor_id: userId,
    });
    load();
  };

  const memberName = (mid: string) => members.find((m) => m.id === mid)?.display_name || '—';
  const systemName = (sid: string) => systems.find((s) => s.id === sid)?.name || '—';

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('access.requests_description')}</p>

      {isAdmin ? (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[180px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('access.member')}</label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('access.system')}</label>
              <Select value={systemId} onValueChange={setSystemId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {systems.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('access.reason')}</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="" />
            </div>
            <Button size="sm" onClick={submit} disabled={busy || !memberId || !systemId}>
              <Plus className="h-4 w-4 mr-1" /> {t('access.request')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {requests.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{t('access.no_requests')}</div>
      ) : (
        <div className="space-y-1">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-medium truncate">{memberName(r.member_id)}</div>
                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <Server className="h-3 w-3" /> {systemName(r.system_id)}
                  {r.reason ? <> · {r.reason}</> : null}
                </div>
              </div>
              <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'granted' || r.status === 'approved' ? 'default' : 'outline'} className="text-[10px]">
                {STATUSES.includes(r.status as any) ? t(`access.statuses.${r.status}`) : r.status}
              </Badge>
              {isAdmin && r.status === 'pending' ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => decide(r, 'approve')}>{t('access.actions.approve')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => decide(r, 'reject')}>{t('access.actions.reject')}</Button>
                </>
              ) : null}
              {isAdmin && r.status === 'approved' ? (
                <Button size="sm" variant="outline" onClick={() => decide(r, 'mark_granted')}>{t('access.actions.mark_granted')}</Button>
              ) : null}
              {isAdmin && (r.status === 'granted' || r.status === 'approved') ? (
                <Button size="sm" variant="ghost" onClick={() => decide(r, 'revoke')}>{t('access.actions.revoke')}</Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
