import { useState, useEffect, useLayoutEffect, useRef, useCallback, useId, type RefObject } from 'react';
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
import {
  AdminLeaveOverrideApiError,
  createAdminLeaveOverride,
  createSecureAdminLeaveOverrideKey,
  fingerprintAdminLeaveOverrideCommand,
  type AdminLeaveOverrideCommand,
  type AdminLeaveOverrideLeaveType,
} from '@/lib/adminLeaveOverrideApi';
import {
  createAdminLeaveOverrideOutbox,
} from '@/lib/adminLeaveOverrideOutbox';

const adminLeaveOverrideOutbox = createAdminLeaveOverrideOutbox({
  keyFactory: createSecureAdminLeaveOverrideKey,
});

function requiresAdminLeaveOverrideReconciliation(error: unknown): boolean {
  if (error instanceof AdminLeaveOverrideApiError) return error.outcomeUnknown;
  if (!(error instanceof Error) || error.name !== 'AdminLeaveOverrideOutboxError') return false;
  const code = (error as Error & { code?: unknown }).code;
  return code === 'corrupted-entry'
    || code === 'expired-entry'
    || code === 'unresolved-operation';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  actorId: string;
  onCreated: () => void;
  dialogContentId?: string;
  returnFocusRef?: RefObject<HTMLButtonElement>;
}

type ValidationPhase = 'idle' | 'validating' | 'valid' | 'failed';
type MemberLoadPhase = 'idle' | 'loading' | 'ready' | 'failed';

export function AdminLeaveOverride({
  open,
  onOpenChange,
  workspaceId,
  actorId,
  onCreated,
  dialogContentId,
  returnFocusRef,
}: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const fieldIdPrefix = useId();
  const resolvedDialogContentId = dialogContentId ?? `${fieldIdPrefix}-dialog`;
  const memberSelectId = `${fieldIdPrefix}-member`;
  const memberStatusId = `${fieldIdPrefix}-member-status`;
  const leaveTypeId = `${fieldIdPrefix}-leave-type`;
  const halfDayId = `${fieldIdPrefix}-half-day`;
  const halfDayPeriodId = `${fieldIdPrefix}-half-day-period`;
  const startDateLabelId = `${fieldIdPrefix}-start-date-label`;
  const startDateValueId = `${fieldIdPrefix}-start-date-value`;
  const endDateLabelId = `${fieldIdPrefix}-end-date-label`;
  const endDateValueId = `${fieldIdPrefix}-end-date-value`;
  const commentId = `${fieldIdPrefix}-comment`;
  const justificationId = `${fieldIdPrefix}-justification`;
  const autoApproveId = `${fieldIdPrefix}-auto-approve`;
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
  const [submitErrorKey, setSubmitErrorKey] = useState<
    'create_failed' | 'outcome_uncertain' | null
  >(null);
  const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
  const [validationPhase, setValidationPhase] = useState<ValidationPhase>('idle');
  const [memberLoadPhase, setMemberLoadPhase] = useState<MemberLoadPhase>('idle');
  const [memberLoadRevision, setMemberLoadRevision] = useState(0);
  const validationRunRef = useRef(0);
  const validatedContextRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const submitRunRef = useRef(0);
  const committedScopeRef = useRef({ open, workspaceId, actorId });
  const memberLoadRunRef = useRef(0);
  const loadedMemberWorkspaceRef = useRef<string | null>(null);
  const memberSelectRef = useRef<HTMLButtonElement>(null);
  const memberRetryRef = useRef<HTMLButtonElement>(null);
  const memberEmptyRef = useRef<HTMLParagraphElement>(null);
  const memberFocusRestoreWorkspaceRef = useRef<string | null>(null);
  const translationRef = useRef(t);

  useLayoutEffect(() => {
    translationRef.current = t;
  }, [t]);

  const invalidateValidation = useCallback(() => {
    validationRunRef.current += 1;
    validatedContextRef.current = null;
    setValidationPhase('idle');
    setConflicts([]);
    setSubmitErrorKey(current => current === 'outcome_uncertain' ? current : null);
  }, []);

  const resetForm = useCallback(() => {
    invalidateValidation();
    setSelectedUserId(''); setLeaveType('vacation'); setStartDate(undefined); setEndDate(undefined);
    setComment(''); setJustification(''); setAutoApprove(true);
    setIsHalfDay(false); setHalfDayPeriod('morning');
    setSubmitErrorKey(null);
  }, [invalidateValidation]);

  useLayoutEffect(() => {
    committedScopeRef.current = { open, workspaceId, actorId };
    submitRunRef.current += 1;
    submitInFlightRef.current = false;
    setSubmitting(false);

    return () => {
      submitRunRef.current += 1;
      submitInFlightRef.current = false;
    };
  }, [actorId, open, workspaceId]);

  useEffect(() => {
    const loadRun = ++memberLoadRunRef.current;
    loadedMemberWorkspaceRef.current = null;
    if (memberFocusRestoreWorkspaceRef.current !== workspaceId) {
      memberFocusRestoreWorkspaceRef.current = null;
    }
    resetForm();
    if (!open) {
      memberFocusRestoreWorkspaceRef.current = null;
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
  }, [actorId, memberLoadRevision, open, resetForm, workspaceId]);

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
  const memberStatusIsVisible = currentMemberLoadPhase === 'loading'
    || currentMemberLoadPhase === 'failed'
    || (currentMemberLoadPhase === 'ready' && visibleMembers.length === 0);

  useEffect(() => {
    if (memberFocusRestoreWorkspaceRef.current !== workspaceId) return;
    if (currentMemberLoadPhase === 'loading' || currentMemberLoadPhase === 'idle') return;

    memberFocusRestoreWorkspaceRef.current = null;
    if (currentMemberLoadPhase === 'failed') {
      memberRetryRef.current?.focus();
    } else if (visibleMembers.length > 0) {
      memberSelectRef.current?.focus();
    } else {
      memberEmptyRef.current?.focus();
    }
  }, [currentMemberLoadPhase, visibleMembers.length, workspaceId]);
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
    const submitRun = ++submitRunRef.current;
    const submitIsCurrent = () => (
      submitRunRef.current === submitRun
      && committedScopeRef.current.open
      && committedScopeRef.current.workspaceId === workspaceId
      && committedScopeRef.current.actorId === actorId
    );
    setSubmitting(true);
    setSubmitErrorKey(null);
    const command: AdminLeaveOverrideCommand = {
      workspaceId,
      userId: selectedUserId,
      leaveType: leaveType as AdminLeaveOverrideLeaveType,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(effectiveEndDate, 'yyyy-MM-dd'),
      justification,
      autoApprove,
      isHalfDay,
      halfDayPeriod: isHalfDay ? halfDayPeriod as 'morning' | 'afternoon' : null,
      comment,
    };

    try {
      const fingerprint = fingerprintAdminLeaveOverrideCommand(command);
      const outboxEntry = await adminLeaveOverrideOutbox.getOrCreate(
        { workspaceId, actorId },
        fingerprint,
      );
      if (!submitIsCurrent()) return;

      const attempt = { key: outboxEntry.key, fingerprint };
      await createAdminLeaveOverride(command, attempt);
      try {
        await adminLeaveOverrideOutbox.complete(outboxEntry);
      } catch (cleanupError) {
        // The server receipt is authoritative. Keeping a verified outbox entry
        // is safe (a later retry replays the same result), while reporting the
        // operation as failed here would encourage an unnecessary new request.
        console.error(
          '[AdminLeaveOverride] Retry receipt cleanup failed',
          cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
        );
      }
      if (!submitIsCurrent()) return;

      toast.success(autoApprove ? t('admin_leave_override.created_approved') : t('admin_leave_override.created'));
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const outcomeUnknown = requiresAdminLeaveOverrideReconciliation(err);
      if (!submitIsCurrent()) return;
      const errorKey = outcomeUnknown ? 'outcome_uncertain' : 'create_failed';
      setSubmitErrorKey(errorKey);
      toast.error(t(`admin_leave_override.${errorKey}`));
      console.error(
        '[AdminLeaveOverride] create_admin_leave_override_v2 failed',
        err instanceof Error ? err.name : 'UnknownError',
      );
    } finally {
      if (submitRunRef.current === submitRun) {
        submitInFlightRef.current = false;
        setSubmitting(false);
      }
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
      <DialogContent
        id={resolvedDialogContentId}
        className="sm:max-w-lg"
        closeLabel={t('common.close')}
        closeDisabled={submitting}
        onEscapeKeyDown={(event) => {
          if (submitInFlightRef.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (submitInFlightRef.current) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          const trigger = returnFocusRef?.current;
          if (trigger?.isConnected && !trigger.disabled) {
            event.preventDefault();
            trigger.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('admin_leave_override.dialog_title')}
          </DialogTitle>
        </DialogHeader>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {submitting
            ? t('admin_leave_override.btn_creating')
            : validationPhase === 'validating'
              ? t('admin_leave_override.btn_validating')
              : ''}
        </p>

        <div
          className="space-y-4 max-h-[60vh] overflow-y-auto"
          aria-busy={submitting || validationPhase === 'validating'}
        >
          <div>
            <Label htmlFor={memberSelectId}>
              {t('admin_leave_override.label_member')}
              <span className="text-destructive" aria-hidden="true"> *</span>
              <span className="sr-only"> ({t('common.required')})</span>
            </Label>
            <Select
              value={selectedUserId}
              disabled={submitting || currentMemberLoadPhase !== 'ready' || visibleMembers.length === 0}
              onValueChange={v => { setSelectedUserId(v); invalidateValidation(); }}
            >
              <SelectTrigger
                ref={memberSelectRef}
                id={memberSelectId}
                className="mt-1"
                aria-required="true"
                aria-describedby={memberStatusIsVisible ? memberStatusId : undefined}
              >
                <SelectValue placeholder={t('admin_leave_override.select_member_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {visibleMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.display_name || t('approval_inbox.unknown')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentMemberLoadPhase === 'loading' && (
              <p id={memberStatusId} className="mt-1 text-xs text-muted-foreground" role="status">
                {t('admin_leave_override.members_loading')}
              </p>
            )}
            {currentMemberLoadPhase === 'failed' && (
              <div id={memberStatusId} className="mt-1 flex items-center justify-between gap-2" role="alert">
                <p className="text-xs text-destructive">{t('admin_leave_override.members_load_failed')}</p>
                <Button
                  ref={memberRetryRef}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    memberFocusRestoreWorkspaceRef.current = workspaceId;
                    setMemberLoadRevision(current => current + 1);
                  }}
                >
                  {t('admin_leave_override.members_retry')}
                </Button>
              </div>
            )}
            {currentMemberLoadPhase === 'ready' && visibleMembers.length === 0 && (
              <p
                ref={memberEmptyRef}
                id={memberStatusId}
                className="mt-1 text-xs text-muted-foreground outline-none"
                role="status"
                tabIndex={-1}
              >
                {t('admin_leave_override.members_empty')}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor={leaveTypeId}>{t('admin_leave_override.label_type')}</Label>
            <Select disabled={submitting} value={leaveType} onValueChange={v => { setLeaveType(v); invalidateValidation(); }}>
              <SelectTrigger id={leaveTypeId} className="mt-1" aria-required="true">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">{t('leave_request.types.vacation')}</SelectItem>
                <SelectItem value="sick_leave">{t('leave_request.types.sick_leave')}</SelectItem>
                <SelectItem value="unpaid_leave">{t('leave_request.types.unpaid_leave')}</SelectItem>
                <SelectItem value="other">{t('leave_request.types.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox disabled={submitting} checked={isHalfDay} onCheckedChange={v => { setIsHalfDay(!!v); invalidateValidation(); }} id={halfDayId} />
            <Label htmlFor={halfDayId} className="cursor-pointer">{t('admin_leave_override.label_half_day')}</Label>
            {isHalfDay && (
              <Select disabled={submitting} value={halfDayPeriod} onValueChange={v => { setHalfDayPeriod(v); invalidateValidation(); }}>
                <Label htmlFor={halfDayPeriodId} className="sr-only">
                  {t('admin_leave_override.label_half_day_period')}
                </Label>
                <SelectTrigger id={halfDayPeriodId} className="w-32 h-8 text-xs" aria-required="true">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">{t('leave_request.morning')}</SelectItem>
                  <SelectItem value="afternoon">{t('leave_request.afternoon')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label id={startDateLabelId}>
                {t('admin_leave_override.label_start_date')}
                <span className="text-destructive" aria-hidden="true"> *</span>
                <span className="sr-only"> ({t('common.required')})</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    aria-labelledby={`${startDateLabelId} ${startDateValueId}`}
                    className={cn("w-full mt-1 justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span id={startDateValueId}>
                      {startDate ? format(startDate, 'yyyy.MM.dd', { locale: dateFnsLocale }) : t('admin_leave_override.pick_date')}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={handleStartDate} locale={dateFnsLocale} disabled={submitting ? () => true : undefined} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {!isHalfDay && (
              <div>
                <Label id={endDateLabelId}>
                  {t('admin_leave_override.label_end_date')}
                  <span className="text-destructive" aria-hidden="true"> *</span>
                  <span className="sr-only"> ({t('common.required')})</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      aria-labelledby={`${endDateLabelId} ${endDateValueId}`}
                      className={cn("w-full mt-1 justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                      <span id={endDateValueId}>
                        {endDate ? format(endDate, 'yyyy.MM.dd', { locale: dateFnsLocale }) : t('admin_leave_override.pick_date')}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={handleEndDate} locale={dateFnsLocale} disabled={d => submitting || (startDate ? d < startDate : false)} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor={commentId}>{t('admin_leave_override.label_comment')}</Label>
            <Textarea
              id={commentId}
              className="mt-1"
              value={comment}
              onChange={e => {
                setComment(e.target.value);
                setSubmitErrorKey(current => current === 'outcome_uncertain' ? current : null);
              }}
              placeholder={t('admin_leave_override.comment_placeholder')}
              rows={2}
              maxLength={4000}
              disabled={submitting}
            />
          </div>

          <div>
            <Label htmlFor={justificationId} className="text-destructive">{t('admin_leave_override.label_justification')}</Label>
            <Textarea
              id={justificationId}
              className="mt-1 border-destructive/30"
              value={justification}
              onChange={e => {
                setJustification(e.target.value);
                setSubmitErrorKey(current => current === 'outcome_uncertain' ? current : null);
              }}
              placeholder={t('admin_leave_override.justification_placeholder')}
              rows={2}
              maxLength={2000}
              disabled={submitting}
              required
              aria-required="true"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id={autoApproveId}
              checked={autoApprove}
              onCheckedChange={v => {
                setAutoApprove(!!v);
                setSubmitErrorKey(current => current === 'outcome_uncertain' ? current : null);
              }}
              disabled={submitting}
            />
            <Label htmlFor={autoApproveId} className="cursor-pointer font-normal">
              {t('admin_leave_override.auto_approve_label')}
            </Label>
          </div>

          {(validationPhase === 'valid' || validationPhase === 'failed') && conflicts.length > 0 && (
            <div
              className="space-y-1 rounded-md border p-3"
              role={hasBlockingConflicts ? 'alert' : 'status'}
              aria-live={hasBlockingConflicts ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              <p className="text-xs font-semibold mb-1">{t('admin_leave_override.conflicts_title')}</p>
              {conflicts.map((c, i) => (
                <div key={i} className={cn("flex items-start gap-2 text-xs rounded px-2 py-1", c.severity === 'blocking' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400')}>
                  {c.severity === 'blocking' ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />}
                  <span>{formatConflict(c, t)}</span>
                </div>
              ))}
              {validationPhase === 'valid' && autoApprove && hasBlockingConflicts && (
                <p className="text-xs text-amber-600 font-medium mt-1">{t('admin_leave_override.blocking_override')}</p>
              )}
            </div>
          )}

          {validationPhase === 'valid' && conflicts.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400" role="status" aria-live="polite">
              {t('admin_leave_override.no_conflicts')}
            </p>
          )}

          {submitErrorKey && (
            <p className="text-xs text-destructive" role="alert">
              {t(`admin_leave_override.${submitErrorKey}`)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>{t('admin_leave_override.btn_cancel')}</Button>
          {!isValidationCurrent ? (
            <Button
              type="button"
              onClick={handleValidate}
              disabled={validationPhase === 'validating' || !validationContext}
              aria-busy={validationPhase === 'validating'}
            >
              {validationPhase === 'validating'
                ? t('admin_leave_override.btn_validating')
                : t('admin_leave_override.btn_validate')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !justification.trim() || !validationContext}
              aria-busy={submitting}
            >
              {submitting ? t('admin_leave_override.btn_creating') : t('admin_leave_override.btn_create')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
