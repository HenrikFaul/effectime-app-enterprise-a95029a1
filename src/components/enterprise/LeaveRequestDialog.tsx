import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateLeaveRequest, ConflictResult } from '@/lib/conflictEngine';
import { formatConflict } from '@/lib/conflictEngineI18n';
import { logAuditEvent } from '@/lib/auditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, AlertTriangle, XCircle, Paperclip, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SubstitutePicker } from './SubstitutePicker';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onCreated: () => void;
}

export function LeaveRequestDialog({ open, onOpenChange, workspaceId, userId, onCreated }: Props) {
  const { t } = useI18n();
  const [leaveType, setLeaveType] = useState<string>('vacation');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<string>('morning');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
  const [validated, setValidated] = useState(false);
  // Új mezők (Absentify-szerű kibővítés)
  const [substitutes, setSubstitutes] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);

  const handleValidate = async () => {
    if (!startDate || (!isHalfDay && !endDate)) return;
    const ed = isHalfDay ? startDate : endDate!;
    try {
      const results = await validateLeaveRequest(workspaceId, userId, startDate, ed);
      setConflicts(results);
      setValidated(true);
    } catch (err) {
      // A thrown error means validation data could not be loaded — block submission
      // so the request isn't silently approved despite unverified constraints.
      toast.error(t('leave_request.error_validation_failed'));
      setConflicts([{ code: 'VALIDATION_ERROR', severity: 'blocking', message: String(err) }]);
      setValidated(true);
    }
  };

  const hasBlockingConflicts = conflicts.some(c => c.severity === 'blocking');

  const uploadAttachment = async (requestId: string): Promise<string | null> => {
    if (!attachment) return null;
    const ext = attachment.name.split('.').pop() || 'bin';
    const path = `${workspaceId}/${userId}/${requestId}.${ext}`;
    const { error } = await supabase.storage.from('leave-attachments').upload(path, attachment, { upsert: true });
    if (error) {
      console.error('Attachment upload failed:', error);
      toast.error(t('leave_request.error_attachment'));
      return null;
    }
    return path;
  };

  const handleSubmit = async () => {
    if (!startDate || (!isHalfDay && !endDate)) {
      toast.error(t('leave_request.error_date_required'));
      return;
    }
    const ed = isHalfDay ? startDate : endDate!;
    if (ed < startDate) {
      toast.error(t('leave_request.error_end_before_start'));
      return;
    }

    if (!validated) { await handleValidate(); return; }
    if (hasBlockingConflicts) { toast.error(t('leave_request.error_blocking')); return; }

    setSubmitting(true);
    const { data: inserted, error } = await supabase.from('leave_requests').insert({
      workspace_id: workspaceId,
      user_id: userId,
      leave_type: leaveType as any,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(ed, 'yyyy-MM-dd'),
      status: 'pending' as any,
      comment: comment.trim() || null,
      is_half_day: isHalfDay,
      half_day_period: isHalfDay ? halfDayPeriod : null,
      is_private: isPrivate,
    } as any).select('id').single();

    if (error || !inserted) {
      toast.error(t('leave_request.error_submit'));
      console.error(error);
      setSubmitting(false);
      return;
    }

    // Csatolmány feltöltése (opcionális)
    if (attachment) {
      const path = await uploadAttachment(inserted.id);
      if (path) {
        await (supabase as any).from('leave_requests').update({ attachment_path: path }).eq('id', inserted.id);
      }
    }

    // Helyettesítők rögzítése (sorrendben)
    if (substitutes.length > 0) {
      const rows = substitutes.map((sid, idx) => ({
        leave_request_id: inserted.id,
        workspace_id: workspaceId,
        substitute_user_id: sid,
        order_index: idx,
        status: 'pending',
      }));
      const { error: subErr } = await (supabase as any).from('leave_request_substitutes').insert(rows);
      if (subErr) console.warn('Substitute insert failed:', subErr);
    }

    await logAuditEvent({
      workspace_id: workspaceId,
      actor_id: userId,
      action: 'leave_request.created',
      target_id: inserted.id,
      target_type: 'leave_request',
      metadata: {
        leave_type: leaveType,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(ed, 'yyyy-MM-dd'),
        is_half_day: isHalfDay,
        is_private: isPrivate,
        substitute_count: substitutes.length,
        has_attachment: !!attachment,
      },
    });
    toast.success(t('leave_request.submitted'));
    resetForm();
    onOpenChange(false);
    onCreated();
    setSubmitting(false);
  };

  const resetForm = () => {
    setLeaveType('vacation'); setStartDate(undefined); setEndDate(undefined);
    setComment(''); setConflicts([]); setValidated(false); setIsHalfDay(false); setHalfDayPeriod('morning');
    setSubstitutes([]); setIsPrivate(false); setAttachment(null);
  };

  const handleStartDate = (d: Date | undefined) => { setStartDate(d); setValidated(false); setConflicts([]); };
  const handleEndDate = (d: Date | undefined) => { setEndDate(d); setValidated(false); setConflicts([]); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('leave_request.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t('leave_request.type_label')}</Label>
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
            <Checkbox checked={isHalfDay} onCheckedChange={v => { setIsHalfDay(!!v); setValidated(false); setConflicts([]); }} id="halfday-req" />
            <Label htmlFor="halfday-req" className="cursor-pointer text-sm">{t('leave_request.half_day')}</Label>
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
              <Label>{isHalfDay ? t('leave_request.date') : t('leave_request.start_date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'yyyy.MM.dd', { locale: hu }) : t('leave_request.pick_date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={handleStartDate} locale={hu} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {!isHalfDay && (
              <div>
                <Label>{t('leave_request.end_date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'yyyy.MM.dd', { locale: hu }) : t('leave_request.pick_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={handleEndDate} locale={hu} disabled={(date) => startDate ? date < startDate : false} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div>
            <Label>{t('leave_request.comment_label')}</Label>
            <Textarea className="mt-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('leave_request.comment_placeholder')} rows={3} />
          </div>

          {/* Helyettesítő-választó */}
          <SubstitutePicker
            workspaceId={workspaceId}
            selfUserId={userId}
            value={substitutes}
            onChange={setSubstitutes}
          />

          {/* Csatolmány (orvosi igazolás stb.) */}
          <div>
            <Label className="text-xs flex items-center gap-1"><Paperclip className="h-3 w-3" /> {t('leave_request.attachment_label')}</Label>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-input file:bg-background file:text-xs file:cursor-pointer"
            />
            {attachment && (
              <p className="text-[10px] text-muted-foreground mt-1">{attachment.name} ({Math.round(attachment.size / 1024)} KB)</p>
            )}
          </div>

          {/* Privát toggle */}
          <div className="flex items-center justify-between rounded-md border p-2.5">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <Label htmlFor="private-req" className="text-xs cursor-pointer">{t('leave_request.private_label')}</Label>
                <p className="text-[10px] text-muted-foreground">{t('leave_request.private_desc')}</p>
              </div>
            </div>
            <Switch id="private-req" checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>

          {validated && conflicts.length > 0 && (
            <div className="space-y-1 rounded-md border p-3">
              <p className="text-xs font-semibold mb-1">{t('leave_request.conflicts_title')}</p>
              {conflicts.map((c, i) => (
                <div key={i} className={cn("flex items-start gap-2 text-xs rounded px-2 py-1", c.severity === 'blocking' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400')}>
                  {c.severity === 'blocking' ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                  <span>{formatConflict(c, t)}</span>
                </div>
              ))}
              {hasBlockingConflicts && (
                <p className="text-xs text-destructive font-medium mt-1">{t('leave_request.blocking_message')}</p>
              )}
            </div>
          )}

          {validated && conflicts.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">{t('leave_request.no_conflicts')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          {!validated ? (
            <Button onClick={handleValidate} disabled={!startDate || (!isHalfDay && !endDate)}>{t('leave_request.validate')}</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || hasBlockingConflicts || !startDate || (!isHalfDay && !endDate)}>
              {submitting ? t('leave_request.submitting') : t('leave_request.submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
