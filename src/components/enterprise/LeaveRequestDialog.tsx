import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateLeaveRequest, ConflictResult } from '@/lib/conflictEngine';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onCreated: () => void;
}

const LEAVE_TYPES = [
  { value: 'vacation', label: 'Szabadság' },
  { value: 'sick_leave', label: 'Betegszabadság' },
  { value: 'unpaid_leave', label: 'Fizetés nélküli szabadság' },
  { value: 'other', label: 'Egyéb' },
] as const;

export function LeaveRequestDialog({ open, onOpenChange, workspaceId, userId, onCreated }: Props) {
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
    const results = await validateLeaveRequest(workspaceId, userId, startDate, ed);
    setConflicts(results);
    setValidated(true);
  };

  const hasBlockingConflicts = conflicts.some(c => c.severity === 'blocking');

  const uploadAttachment = async (requestId: string): Promise<string | null> => {
    if (!attachment) return null;
    const ext = attachment.name.split('.').pop() || 'bin';
    const path = `${workspaceId}/${userId}/${requestId}.${ext}`;
    const { error } = await supabase.storage.from('leave-attachments').upload(path, attachment, { upsert: true });
    if (error) {
      console.error('Attachment upload failed:', error);
      toast.error('A csatolmány feltöltése nem sikerült');
      return null;
    }
    return path;
  };

  const handleSubmit = async () => {
    if (!startDate || (!isHalfDay && !endDate)) {
      toast.error('Kérjük, válaszd ki a dátumot');
      return;
    }
    const ed = isHalfDay ? startDate : endDate!;
    if (ed < startDate) {
      toast.error('A záró dátum nem lehet korábbi a kezdő dátumnál');
      return;
    }

    if (!validated) { await handleValidate(); return; }
    if (hasBlockingConflicts) { toast.error('Nem küldhető be: blokkolt ütközések vannak'); return; }

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
      toast.error('Hiba a kérelem beküldésekor');
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
    toast.success('Távolléti kérelem beküldve');
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
          <DialogTitle>Új távolléti kérelem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Típus</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={isHalfDay} onCheckedChange={v => { setIsHalfDay(!!v); setValidated(false); setConflicts([]); }} id="halfday-req" />
            <Label htmlFor="halfday-req" className="cursor-pointer text-sm">Fél nap</Label>
            {isHalfDay && (
              <Select value={halfDayPeriod} onValueChange={setHalfDayPeriod}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Délelőtt</SelectItem>
                  <SelectItem value="afternoon">Délután</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isHalfDay ? 'Dátum' : 'Kezdő dátum'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'yyyy.MM.dd', { locale: hu }) : 'Válassz'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={handleStartDate} locale={hu} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {!isHalfDay && (
              <div>
                <Label>Záró dátum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'yyyy.MM.dd', { locale: hu }) : 'Válassz'}
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
            <Label>Megjegyzés (opcionális)</Label>
            <Textarea className="mt-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Indoklás vagy egyéb megjegyzés..." rows={3} />
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
            <Label className="text-xs flex items-center gap-1"><Paperclip className="h-3 w-3" /> Csatolmány (opcionális)</Label>
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
                <Label htmlFor="private-req" className="text-xs cursor-pointer">Privát kérelem</Label>
                <p className="text-[10px] text-muted-foreground">Csak jóváhagyók látják az indokot</p>
              </div>
            </div>
            <Switch id="private-req" checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>

          {validated && conflicts.length > 0 && (
            <div className="space-y-1 rounded-md border p-3">
              <p className="text-xs font-semibold mb-1">Ütközések:</p>
              {conflicts.map((c, i) => (
                <div key={i} className={cn("flex items-start gap-2 text-xs rounded px-2 py-1", c.severity === 'blocking' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400')}>
                  {c.severity === 'blocking' ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                  <span>{c.message}</span>
                </div>
              ))}
              {hasBlockingConflicts && (
                <p className="text-xs text-destructive font-medium mt-1">Blokkolt ütközések miatt a kérelem nem küldhető be.</p>
              )}
            </div>
          )}

          {validated && conflicts.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">✓ Nincs ütközés, a kérelem beküldhető.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          {!validated ? (
            <Button onClick={handleValidate} disabled={!startDate || (!isHalfDay && !endDate)}>Ellenőrzés</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || hasBlockingConflicts || !startDate || (!isHalfDay && !endDate)}>
              {submitting ? 'Küldés...' : 'Kérelem beküldése'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
