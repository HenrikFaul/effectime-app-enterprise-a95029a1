import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateLeaveRequest, ConflictResult } from '@/lib/conflictEngine';
import { formatConflict } from '@/lib/conflictEngineI18n';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreated: () => void;
}

type ValidationPhase = 'idle' | 'validating' | 'valid' | 'failed';
type MemberLoadPhase = 'idle' | 'loading' | 'ready' | 'failed';

interface AdminOverrideRpcPayload {
  _workspace_id: string;
  _user_id: string;
  _leave_type: string;
  _start_date: string;
  _end_date: string;
  _justification: string;
  _auto_approve: boolean;
  _is_half_day: boolean;
  _half_day_period: string | null;
  _comment: string | null;
}

interface AdminOverrideRpcResponse {
  data: { ok?: boolean } | null;
  error: unknown;
}

interface AdminOverrideRpcClient {
  rpc: (
    functionName: 'create_admin_leave_override',
    payload: AdminOverrideRpcPayload,
  ) => Promise<AdminOverrideRpcResponse>;
}

export function AdminLeaveOverride({ open, onOpenChange, workspaceId, onCreated }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
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
  const [validationPhase, setValidationPhase] = useState<ValidationPhase>('idle');
  const [memberLoadPhase, setMemberLoadPhase] = useState<MemberLoadPhase>('idle');
  const [memberLoadRevision, setMemberLoadRevision] = useState(0);
  const validationRunRef = useRef(0);
  const validatedContextRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const memberLoadRunRef = useRef(0);
  const loadedMemberWorkspaceRef = useRef<string | null>(null);
  const translationRef = useRef(t);
  translationRef.current = t;

  const invalidateValidation = useCallback(() => {
    validationRunRef.current += 1;
    validatedContextRef.current = null;
    setValidationPhase('idle');
    setConflicts([]);
  }, []);

  const resetForm = useCallback(() => {
    invalidateValidation();
    setSelectedUserId(''); setLeaveType('vacation'); setStartDate(undefined); setEndDate(undefined);
    setComment(''); setJustification(''); setAutoApprove(true);
    setIsHalfDay(false); setHalfDayPeriod('morning');
  }, [invalidateValidation]);

  useEffect(() => {
    const loadRun = ++memberLoadRunRef.current;
    loadedMemberWorkspaceRef.current = null;
    resetForm();
    if (!open) {
      setMembers([]);
      setMemberLoadPhase('idle');
      return () => {
        if (memberLoadRunRef.current === loadRun) memberLoadRunRef.current += 1;
      };
    }
    setMembers([]);
    setMemberLoadPhase('loading');

    (async () => {
      try {
        const { data: mData, error: membershipError } = await supabase
          .from('enterprise_memberships')
          .select('user_id')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active');
        if (membershipError) throw new Error('membership_query_failed');
        const userIds = (mData || []).map(m => m.user_id);
        if (memberLoadRunRef.current !== loadRun) return;
        if (userIds.length === 0) {
          setMembers([]);
          loadedMemberWorkspaceRef.current = workspaceId;
          setMemberLoadPhase('ready');
          return;
        }

        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        if (profileError) throw new Error('profile_query_failed');
        if (memberLoadRunRef.current !== loadRun) return;
        setMembers((profiles || [])
          .map(p => ({
            user_id: p.user_id,
            display_name: p.display_name?.trim() || '',
          }))
          .sort((a, b) => (
            a.display_name || a.user_id
          ).localeCompare(b.display_name || b.user_id)));
        loadedMemberWorkspaceRef.current = workspaceId;
        setMemberLoadPhase('ready');
      } catch (err) {
        if (memberLoadRunRef.current !== loadRun) return;
        loadedMemberWorkspaceRef.current = null;
        setMembers([]);
        setMemberLoadPhase('failed');
        console.error(
          '[AdminLeaveOverride] Member directory load failed',
          err instanceof Error ? err.message : 'unknown_failure',
        );
        toast.error(translationRef.current('admin_leave_override.members_load_failed'));
      }
    })();

    return () => {
      if (memberLoadRunRef.current === loadRun) memberLoadRunRef.current += 1;
    };
  }, [memberLoadRevision, open, resetForm, workspaceId]);

  const effectiveEndDate = isHalfDay ? startDate : endDate;
  const memberDirectoryIsCurrent = memberLoadPhase === 'ready'
    && loadedMemberWorkspaceRef.current === workspaceId;
  const currentMemberLoadPhase: MemberLoadPhase = !open
    ? 'idle'
    : memberDirectoryIsCurrent
      ? 'ready'
      : memberLoadPhase === 'failed'
        ? 'failed'
        : 'loading';
  const visibleMembers = memberDirectoryIsCurrent ? members : [];
  const dateRangeIsValid = Boolean(
    startDate
    && effectiveEndDate
    && effectiveEndDate.getTime() >= startDate.getTime(),
  );
  const selectedMemberIsCurrent = memberDirectoryIsCurrent
    && members.some(member => member.user_id === selectedUserId);
  const validationContext = dateRangeIsValid && startDate && effectiveEndDate
    && selectedUserId && selectedMemberIsCurrent
    ? JSON.stringify([
      workspaceId,
      selectedUserId,
      leaveType,
      format(startDate, 'yyyy-MM-dd'),
      format(effectiveEndDate, 'yyyy-MM-dd'),
      isHalfDay,
      isHalfDay ? halfDayPeriod : null,
    ])
    : null;
  const isValidationCurrent = validationPhase === 'valid'
    && validationContext !== null
    && validatedContextRef.current === validationContext;

  const handleValidate = async () => {
    if (!startDate || !effectiveEndDate || !selectedUserId || !validationContext) return;
    const validationRun = ++validationRunRef.current;
    const contextSnapshot = validationContext;
    setValidationPhase('validating');
    setConflicts([]);
    try {
      const results = await validateLeaveRequest(workspaceId, selectedUserId, startDate, effectiveEndDate);
      if (validationRun !== validationRunRef.current) return;
      setConflicts(results);
      validatedContextRef.current = contextSnapshot;
      setValidationPhase('valid');
    } catch (err) {
      if (validationRun !== validationRunRef.current) return;
      console.error(
        '[AdminLeaveOverride] Leave validation failed',
        err instanceof Error ? err.name : 'UnknownError',
      );
      toast.error(t('leave_request.error_validation_failed'));
      setConflicts([{
        code: 'VALIDATION_ERROR',
        severity: 'blocking',
        message: t('leave_request.error_validation_failed'),
      }]);
      validatedContextRef.current = null;
      setValidationPhase('failed');
    }
  };

  const hasBlockingConflicts = conflicts.some(c => c.severity === 'blocking');

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    if (!startDate || !effectiveEndDate || !selectedUserId || !validationContext) {
      toast.error(t('admin_leave_override.fill_all_fields'));
      return;
    }
    if (!justification.trim()) { toast.error(t('admin_leave_override.justification_required')); return; }

    if (!isValidationCurrent || validatedContextRef.current !== validationContext) {
      await handleValidate();
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    const rpcPayload = {
      _workspace_id: workspaceId,
      _user_id: selectedUserId,
      _leave_type: leaveType,
      _start_date: format(startDate, 'yyyy-MM-dd'),
      _end_date: format(effectiveEndDate, 'yyyy-MM-dd'),
      _justification: justification.trim(),
      _auto_approve: autoApprove,
      _is_half_day: isHalfDay,
      _half_day_period: isHalfDay ? halfDayPeriod : null,
      _comment: comment.trim() || null,
    };

    try {
      // The checked-in generated schema predates this migration-backed RPC;
      // keep its local call contract explicit until schema provenance is reconciled.
      const { data, error } = await (supabase as unknown as AdminOverrideRpcClient)
        .rpc('create_admin_leave_override', rpcPayload);
      if (error || data?.ok !== true) {
        toast.error(t('admin_leave_override.create_failed'));
        console.error(
          '[AdminLeaveOverride] create_admin_leave_override returned an unsuccessful result',
          error ? 'RpcError' : 'UnexpectedResponse',
        );
        return;
      }

      toast.success(autoApprove ? t('admin_leave_override.created_approved') : t('admin_leave_override.created'));
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(t('admin_leave_override.create_failed'));
      console.error(
        '[AdminLeaveOverride] create_admin_leave_override failed',
        err instanceof Error ? err.name : 'UnknownError',
      );
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submitInFlightRef.current) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleStartDate = (d: Date | undefined) => {
    setStartDate(d);
    if (d && endDate && endDate.getTime() < d.getTime()) setEndDate(undefined);
    invalidateValidation();
  };
  const handleEndDate = (d: Date | undefined) => { setEndDate(d); invalidateValidation(); };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            <Select
              value={selectedUserId}
              disabled={currentMemberLoadPhase !== 'ready'}
              onValueChange={v => { setSelectedUserId(v); invalidateValidation(); }}
            >
              <SelectTrigger className="mt-1"><SelectValue placeholder={t('admin_leave_override.select_member_placeholder')} /></SelectTrigger>
              <SelectContent>
                {visibleMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.display_name || t('approval_inbox.unknown')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentMemberLoadPhase === 'loading' && (
              <p className="mt-1 text-xs text-muted-foreground" role="status">
                {t('admin_leave_override.members_loading')}
              </p>
            )}
            {currentMemberLoadPhase === 'failed' && (
              <div className="mt-1 flex items-center justify-between gap-2" role="alert">
                <p className="text-xs text-destructive">{t('admin_leave_override.members_load_failed')}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMemberLoadRevision(current => current + 1)}
                >
                  {t('admin_leave_override.members_retry')}
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>{t('admin_leave_override.label_type')}</Label>
            <Select value={leaveType} onValueChange={v => { setLeaveType(v); invalidateValidation(); }}>
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
            <Checkbox checked={isHalfDay} onCheckedChange={v => { setIsHalfDay(!!v); invalidateValidation(); }} id="halfday" />
            <Label htmlFor="halfday" className="cursor-pointer">{t('admin_leave_override.label_half_day')}</Label>
            {isHalfDay && (
              <Select value={halfDayPeriod} onValueChange={v => { setHalfDayPeriod(v); invalidateValidation(); }}>
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
                    {startDate ? format(startDate, 'yyyy.MM.dd', { locale: dateFnsLocale }) : t('admin_leave_override.pick_date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={handleStartDate} locale={dateFnsLocale} className="p-3 pointer-events-auto" />
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
                      {endDate ? format(endDate, 'yyyy.MM.dd', { locale: dateFnsLocale }) : t('admin_leave_override.pick_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={handleEndDate} locale={dateFnsLocale} disabled={d => startDate ? d < startDate : false} className="p-3 pointer-events-auto" />
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

          {(validationPhase === 'valid' || validationPhase === 'failed') && conflicts.length > 0 && (
            <div className="space-y-1 rounded-md border p-3">
              <p className="text-xs font-semibold mb-1">{t('admin_leave_override.conflicts_title')}</p>
              {conflicts.map((c, i) => (
                <div key={i} className={cn("flex items-start gap-2 text-xs rounded px-2 py-1", c.severity === 'blocking' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400')}>
                  {c.severity === 'blocking' ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                  <span>{formatConflict(c, t)}</span>
                </div>
              ))}
              {validationPhase === 'valid' && autoApprove && hasBlockingConflicts && (
                <p className="text-xs text-amber-600 font-medium mt-1">{t('admin_leave_override.blocking_override')}</p>
              )}
            </div>
          )}

          {validationPhase === 'valid' && conflicts.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">{t('admin_leave_override.no_conflicts')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>{t('admin_leave_override.btn_cancel')}</Button>
          {!isValidationCurrent ? (
            <Button
              onClick={handleValidate}
              disabled={validationPhase === 'validating' || !validationContext}
            >
              {t('admin_leave_override.btn_validate')}
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !justification.trim() || !validationContext}>
              {submitting ? t('admin_leave_override.btn_creating') : t('admin_leave_override.btn_create')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
