import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateLeaveRequest, ConflictResult } from '@/lib/conflictEngine';
import { formatConflict } from '@/lib/conflictEngineI18n';
import { logAuditEvent } from '@/lib/auditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  adminUserId: string;
  onCreated: () => void;
}

export function AdminLeaveOverride({ open, onOpenChange, workspaceId, adminUserId, onCreated }: Props) {
  const { t } = useI18n();
  const [members, setMembers] = useState<{ user_id: string; display_name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [leaveType, setLeaveType] = useState('vacation');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<string>('morning');
  const [comment, setComment] = useState('');
  const [justification, setJustification] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: mData } = await supabase.from('enterprise_memberships').select('user_id').eq('workspace_id', workspaceId).eq('status', 'active' as any);
      const userIds = (mData || []).map((m: any) => m.user_id);
      if (userIds.length === 0) { setMembers([]); return; }
      const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      setMembers((profiles || []).map((p: any) => ({ user_id: p.user_id, display_name: p.display_name || t('approval_inbox.unknown') })).sort((a, b) => a.display_name.localeCompare(b.display_name)));
    })();
  }, [open, workspaceId]);

  const handleValidate = async () => {
    if (!startDate || !endDate || !selectedUserId) return;
    try {
      const results = await validateLeaveRequest(workspaceId, selectedUserId, startDate, endDate);
      setConflicts(results);
      setValidated(true);
    } catch (err) {
      // Engine threw because validation data could not be loaded — surface as
      // a blocking conflict so the admin cannot bypass-approve a request whose
      // constraints were never evaluated.
      toast.error(t('leave_request.error_validation_failed'));
      setConflicts([{ code: 'VALIDATION_ERROR', severity: 'blocking', message: String(err) }]);
      setValidated(true);
    }
  };

  const hasBlockingConflicts = conflicts.some(c => c.severity === 'blocking');

  const handleSubmit = async () => {
    if (!startDate || !endDate || !selectedUserId) { toast.error(t('admin_leave_override.fill_all_fields')); return; }
    if (!justification.trim()) { toast.error(t('admin_leave_override.justification_required')); return; }

    if (!validated) { await handleValidate(); return; }

    setSubmitting(true);
    const status = autoApprove ? 'approved' : 'pending';

    const { error } = await supabase.from('leave_requests').insert({
      workspace_id: workspaceId,
      user_id: selectedUserId,
      leave_type: leaveType as any,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: isHalfDay ? format(startDate, 'yyyy-MM-dd') : format(endDate, 'yyyy-MM-dd'),
      status: status as any,
      comment: comment.trim() || null,
      is_half_day: isHalfDay,
      half_day_period: isHalfDay ? halfDayPeriod : null,
      reviewer_id: autoApprove ? adminUserId : null,
      reviewed_at: autoApprove ? new Date().toISOString() : null,
      review_comment: autoApprove ? `Admin override: ${justification.trim()}` : null,
    });

    if (error) {
      toast.error(t('admin_leave_override.create_failed'));
      console.error(error);
    } else {
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: adminUserId,
        action: 'leave_request.admin_override',
        affected_user_id: selectedUserId,
        metadata: {
          leave_type: leaveType,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          auto_approved: autoApprove,
          justification: justification.trim(),
          is_half_day: isHalfDay,
        },
      });
      toast.success(autoApprove ? t('admin_leave_override.created_approved') : t('admin_leave_override.created'));
      resetForm();
      onOpenChange(false);
      onCreated();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setSelectedUserId(''); setLeaveType('vacation'); setStartDate(undefined); setEndDate(undefined);
    setComment(''); setJustification(''); setAutoApprove(true); setConflicts([]); setValidated(false);
    setIsHalfDay(false); setHalfDayPeriod('morning');
  };

  const handleStartDate = (d: Date | undefined) => { setStartDate(d); setValidated(false); setConflicts([]); };
  const handleEndDate = (d: Date | undefined) => { setEndDate(d); setValidated(false); setConflicts([]); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            {t('admin_leave_override.dialog_title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Label>{t('admin_leave_override.label_member')}</Label>
            <Select value={selectedUserId} onValueChange={v => { setSelectedUserId(v); setValidated(false); setConflicts([]); }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={t('admin_leave_override.select_member_placeholder')} /></SelectTrigger>
              <SelectContent>
                {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('admin_leave_override.label_type')}</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">{t('leave_request.types.vacation')}</SelectItem>
                <SelectItem value="sick_leave">{t('leave_request.types.sick_leave')}</SelectItem>
                <SelectItem value="unpaid_leave">{t('leave_request.types.unpaid_leave')}</SelectItem>
                <SelectItem value="other">{t('leave_request.types.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={isHalfDay} onCheckedChange={v => setIsHalfDay(!!v)} id="halfday" />
            <Label htmlFor="halfday" className="cursor-pointer">{t('admin_leave_override.label_half_day')}</Label>
            {isHalfDay && (
              <Select value={halfDayPeriod} onValueChange={setHalfDayPeriod}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">{t('leave_request.morning')}</SelectItem>
                  <SelectItem value="afternoon">{t('leave_request.afternoon')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('admin_leave_override.label_start_date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'yyyy.MM.dd', { locale: hu }) : t('admin_leave_override.pick_date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={handleStartDate} locale={hu} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {!isHalfDay && (
              <div>
                <Label>{t('admin_leave_override.label_end_date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'yyyy.MM.dd', { locale: hu }) : t('admin_leave_override.pick_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={handleEndDate} locale={hu} disabled={d => startDate ? d < startDate : false} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div>
            <Label>{t('admin_leave_override.label_comment')}</Label>
            <Textarea className="mt-1" value={comment} onChange={e => setComment(e.target.value)} placeholder={t('admin_leave_override.comment_placeholder')} rows={2} />
          </div>

          <div>
            <Label className="text-destructive">{t('admin_leave_override.label_justification')}</Label>
            <Textarea className="mt-1 border-destructive/30" value={justification} onChange={e => setJustification(e.target.value)} placeholder={t('admin_leave_override.justification_placeholder')} rows={2} />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={autoApprove} onCheckedChange={v => setAutoApprove(!!v)} />
            {t('admin_leave_override.auto_approve_label')}
          </label>

          {validated && conflicts.length > 0 && (
            <div className="space-y-1 rounded-md border p-3">
              <p className="text-xs font-semibold mb-1">{t('admin_leave_override.conflicts_title')}</p>
              {conflicts.map((c, i) => (
                <div key={i} className={cn("flex items-start gap-2 text-xs rounded px-2 py-1", c.severity === 'blocking' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400')}>
                  {c.severity === 'blocking' ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                  <span>{formatConflict(c, t)}</span>
                </div>
              ))}
              {autoApprove && hasBlockingConflicts && (
                <p className="text-xs text-amber-600 font-medium mt-1">{t('admin_leave_override.blocking_override')}</p>
              )}
            </div>
          )}

          {validated && conflicts.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">{t('admin_leave_override.no_conflicts')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('admin_leave_override.btn_cancel')}</Button>
          {!validated ? (
            <Button onClick={handleValidate} disabled={!startDate || (!isHalfDay && !endDate) || !selectedUserId}>{t('admin_leave_override.btn_validate')}</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !selectedUserId || !justification.trim() || !startDate || (!isHalfDay && !endDate)}>
              {submitting ? t('admin_leave_override.btn_creating') : t('admin_leave_override.btn_create')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
