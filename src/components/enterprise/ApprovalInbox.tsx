import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAuditEvent } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, X, Filter, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  cancelled: 'outline',
  expired: 'outline',
};

export function ApprovalInbox({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [memberInfo, setMemberInfo] = useState<Record<string, { team: string | null; role: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [requesterFilter, setRequesterFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [teams, setTeams] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('leave_requests')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);
    if (typeFilter !== 'all') query = query.eq('leave_type', typeFilter as any);
    if (dateFrom) query = query.gte('start_date', format(dateFrom, 'yyyy-MM-dd'));
    if (dateTo) query = query.lte('end_date', format(dateTo, 'yyyy-MM-dd'));

    const { data, error: queryErr } = await query;
    if (queryErr) {
      console.error('[ApprovalInbox] Failed to fetch leave requests:', queryErr.message);
      setLoading(false);
      return;
    }
    let items = (data as any[]) || [];
    setSelectedIds(new Set());

    const userIds = [...new Set(items.map(r => r.user_id))];
    const mMap: Record<string, { team: string | null; role: string | null }> = {};
    if (userIds.length > 0) {
      const [{ data: profileData }, { data: memData }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name').in('user_id', userIds),
        supabase.from('enterprise_memberships').select('user_id, team, business_role').eq('workspace_id', workspaceId).in('user_id', userIds),
      ]);
      const pMap: Record<string, string> = {};
      (profileData || []).forEach((p: any) => { pMap[p.user_id] = p.display_name || t('approval_inbox.unknown'); });
      setProfiles(pMap);

      const tSet = new Set<string>(); const rSet = new Set<string>();
      (memData || []).forEach((m: any) => {
        mMap[m.user_id] = { team: m.team, role: m.business_role };
        if (m.team) tSet.add(m.team);
        if (m.business_role) rSet.add(m.business_role);
      });
      setMemberInfo(mMap);
      setTeams(Array.from(tSet).sort());
      setRoles(Array.from(rSet).sort());
    }

    // Client-side filters — use local mMap (freshly fetched), not stale memberInfo state
    if (teamFilter !== 'all') items = items.filter(r => mMap[r.user_id]?.team === teamFilter);
    if (roleFilter !== 'all') items = items.filter(r => mMap[r.user_id]?.role === roleFilter);
    if (requesterFilter !== 'all') items = items.filter(r => r.user_id === requesterFilter);

    setRequests(items);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [workspaceId, statusFilter, typeFilter, dateFrom, dateTo]);
  // Re-filter on client-side filter changes
  useEffect(() => {
    if (!loading) fetchRequests();
  }, [teamFilter, roleFilter, requesterFilter]);

  const handleDecision = async (requestId: string, decision: 'approved' | 'rejected') => {
    setProcessing(true);
    const reviewComment = commentMap[requestId] || null;

    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({ status: decision as any, reviewer_id: userId, reviewed_at: new Date().toISOString(), review_comment: reviewComment })
      .eq('id', requestId);

    if (updateError) { toast.error(t('approval_inbox.decision_failed')); setProcessing(false); return; }

    await supabase.from('approval_decisions').insert({
      leave_request_id: requestId, workspace_id: workspaceId, decided_by: userId, decision: decision as any, comment: reviewComment,
    });

    await logAuditEvent({
      workspace_id: workspaceId, actor_id: userId,
      action: decision === 'approved' ? 'leave_request.approved' : 'leave_request.rejected',
      target_id: requestId, target_type: 'leave_request',
      affected_user_id: requests.find(r => r.id === requestId)?.user_id,
      metadata: { comment: reviewComment },
    });

    const req = requests.find(r => r.id === requestId);
    if (req) {
      const { data: reqUserAuth } = await supabase.from('profiles').select('display_name').eq('user_id', req.user_id).maybeSingle();
      const reviewerName = profiles[userId] || 'Admin';
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'leave-decision',
          recipientUserId: req.user_id,
          idempotencyKey: `leave-decision-${requestId}-${decision}`,
          templateData: {
            employeeName: reqUserAuth?.display_name || t('common.colleague'), decision,
            startDate: format(new Date(req.start_date), 'yyyy.MM.dd', { locale: dateFnsLocale }),
            endDate: format(new Date(req.end_date), 'yyyy.MM.dd', { locale: dateFnsLocale }),
            leaveType: t(`approval_inbox.type_${req.leave_type}` as any) || req.leave_type, reviewerName, reviewComment,
          },
        },
      }).catch(err => console.warn('Email notification failed:', err));
    }

    toast.success(decision === 'approved' ? t('approval_inbox.approved') : t('approval_inbox.rejected'));
    setCommentMap(prev => { const n = { ...prev }; delete n[requestId]; return n; });
    fetchRequests();
    setProcessing(false);
  };

  const handleBulkDecision = async (decision: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    for (const id of selectedIds) {
      const { error: bulkUpdateErr } = await supabase.from('leave_requests').update({ status: decision as any, reviewer_id: userId, reviewed_at: new Date().toISOString() }).eq('id', id);
      if (bulkUpdateErr) { console.error('[ApprovalInbox] Bulk update failed for', id, bulkUpdateErr.message); continue; }
      const { error: bulkInsertErr } = await supabase.from('approval_decisions').insert({ leave_request_id: id, workspace_id: workspaceId, decided_by: userId, decision: decision as any });
      if (bulkInsertErr) console.error('[ApprovalInbox] Bulk approval_decisions insert failed for', id, bulkInsertErr.message);
    }
    toast.success(decision === 'approved' ? t('approval_inbox.bulk_approved', { count: selectedIds.size }) : t('approval_inbox.bulk_rejected', { count: selectedIds.size }));
    fetchRequests();
    setProcessing(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    const pendingIds = requests.filter(r => r.status === 'pending').map(r => r.id);
    setSelectedIds(prev => prev.size === pendingIds.length ? new Set() : new Set(pendingIds));
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const uniqueRequesters = [...new Set(requests.map(r => r.user_id))];

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      {/* Basic Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('approval_inbox.filter_all_status')}</SelectItem>
            <SelectItem value="pending">{t('approval_inbox.filter_pending')}</SelectItem>
            <SelectItem value="approved">{t('approval_inbox.filter_approved')}</SelectItem>
            <SelectItem value="rejected">{t('approval_inbox.filter_rejected')}</SelectItem>
            <SelectItem value="cancelled">{t('approval_inbox.filter_cancelled')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('approval_inbox.filter_all_types')}</SelectItem>
            <SelectItem value="vacation">{t('approval_inbox.type_vacation')}</SelectItem>
            <SelectItem value="sick_leave">{t('approval_inbox.type_sick_leave')}</SelectItem>
            <SelectItem value="unpaid_leave">{t('approval_inbox.type_unpaid_leave')}</SelectItem>
            <SelectItem value="other">{t('approval_inbox.type_other')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? t('approval_inbox.filter_hide') : t('approval_inbox.filter_advanced')}
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="flex flex-wrap items-end gap-2 p-3 rounded-md border bg-muted/30">
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">{t('approval_inbox.filter_requester')}</label>
            <Select value={requesterFilter} onValueChange={setRequesterFilter}>
              <SelectTrigger className="w-[150px] h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('approval_inbox.filter_all_status')}</SelectItem>
                {uniqueRequesters.map(uid => <SelectItem key={uid} value={uid}>{profiles[uid] || t('approval_inbox.unknown')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">{t('approval_inbox.filter_team')}</label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('approval_inbox.filter_all_status')}</SelectItem>
                {teams.map(team => <SelectItem key={team} value={team}>{team}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">{t('approval_inbox.filter_position')}</label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('approval_inbox.filter_all_status')}</SelectItem>
                {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">{t('approval_inbox.filter_from')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-8 text-xs mt-0.5", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {dateFrom ? format(dateFrom, 'MM.dd', { locale: dateFnsLocale }) : '–'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={dateFnsLocale} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">{t('approval_inbox.filter_to')}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-8 text-xs mt-0.5", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {dateTo ? format(dateTo, 'MM.dd', { locale: dateFnsLocale }) : '–'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={dateFnsLocale} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          {(dateFrom || dateTo || teamFilter !== 'all' || roleFilter !== 'all' || requesterFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setTeamFilter('all'); setRoleFilter('all'); setRequesterFilter('all'); }}>
              {t('approval_inbox.filter_clear')}
            </Button>
          )}
        </div>
      )}

      {/* Bulk actions */}
      {statusFilter === 'pending' && pendingRequests.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={toggleSelectAll}>
            {selectedIds.size === pendingRequests.length ? t('approval_inbox.deselect_all') : t('approval_inbox.select_all')}
          </Button>
          {selectedIds.size > 0 && (
            <>
              <Button size="sm" className="text-xs h-8" onClick={() => handleBulkDecision('approved')} disabled={processing}>
                <Check className="h-3 w-3 mr-1" /> {t('approval_inbox.bulk_approve', { count: selectedIds.size })}
              </Button>
              <Button variant="destructive" size="sm" className="text-xs h-8" onClick={() => handleBulkDecision('rejected')} disabled={processing}>
                <X className="h-3 w-3 mr-1" /> {t('approval_inbox.bulk_reject', { count: selectedIds.size })}
              </Button>
            </>
          )}
        </div>
      )}

      {requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            {t('approval_inbox.no_requests', { status: statusFilter !== 'all' ? t(`approval_inbox.filter_${statusFilter}` as any).toLowerCase() : '' })}
          </CardContent>
        </Card>
      ) : (
        requests.map((req) => {
          const statusVariant = STATUS_VARIANTS[req.status] || 'secondary';
          const statusLabel = t(`approval_inbox.status_${req.status}` as any) || req.status;
          const typeLabel = t(`approval_inbox.type_${req.leave_type}` as any) || req.leave_type;
          const isPending = req.status === 'pending';
          const mi = memberInfo[req.user_id];
          return (
            <Card key={req.id} className={selectedIds.has(req.id) ? 'border-primary' : ''}>
              <CardContent className="py-3 px-4 space-y-2">
                <div className="flex items-start gap-3">
                  {isPending && statusFilter === 'pending' && (
                    <Checkbox checked={selectedIds.has(req.id)} onCheckedChange={() => toggleSelect(req.id)} className="mt-1" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{profiles[req.user_id] || t('approval_inbox.unknown')}</span>
                      <Badge variant={statusVariant} className="text-xs">{statusLabel}</Badge>
                      <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                      {req.is_half_day && <Badge variant="outline" className="text-[9px]">{req.half_day_period === 'morning' ? t('approval_inbox.half_day_morning') : t('approval_inbox.half_day_afternoon')}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(req.start_date), 'yyyy.MM.dd', { locale: dateFnsLocale })} – {format(new Date(req.end_date), 'yyyy.MM.dd', { locale: dateFnsLocale })}
                      {mi?.team && <span className="ml-2">• {mi.team}</span>}
                      {mi?.role && <span className="ml-1 text-primary/70">({mi.role})</span>}
                    </p>
                    {req.comment && <p className="text-xs text-muted-foreground">{req.comment}</p>}
                    {req.review_comment && <p className="text-xs text-muted-foreground italic">{t('approval_inbox.review_comment_label', { comment: req.review_comment })}</p>}
                  </div>
                </div>

                {isPending && (
                  <div className="space-y-2 pt-1 border-t">
                    <Textarea placeholder={t('approval_inbox.comment_placeholder')} className="text-xs h-16" value={commentMap[req.id] || ''} onChange={(e) => setCommentMap(prev => ({ ...prev, [req.id]: e.target.value }))} />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="destructive" className="text-xs" onClick={() => handleDecision(req.id, 'rejected')} disabled={processing}>
                        <X className="h-3 w-3 mr-1" /> {t('approval_inbox.reject')}
                      </Button>
                      <Button size="sm" className="text-xs" onClick={() => handleDecision(req.id, 'approved')} disabled={processing}>
                        <Check className="h-3 w-3 mr-1" /> {t('approval_inbox.approve')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
