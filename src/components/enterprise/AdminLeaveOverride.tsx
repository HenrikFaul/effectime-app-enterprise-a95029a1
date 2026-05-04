import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateLeaveRequest, ConflictResult } from '@/lib/conflictEngine';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  adminUserId: string;
  onCreated: () => void;
}

const LEAVE_TYPES = [
  { value: 'vacation', label: 'Szabadság' },
  { value: 'sick_leave', label: 'Betegszabadság' },
  { value: 'unpaid_leave', label: 'Fizetés nélküli szabadság' },
  { value: 'other', label: 'Egyéb' },
] as const;

export function AdminLeaveOverride({ open, onOpenChange, workspaceId, adminUserId, onCreated }: Props) {
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
      setMembers((profiles || []).map((p: any) => ({ user_id: p.user_id, display_name: p.display_name || 'Ismeretlen' })).sort((a, b) => a.display_name.localeCompare(b.display_name)));
    })();
  }, [open, workspaceId]);

  const handleValidate = async () => {
    if (!startDate || !endDate || !selectedUserId) return;
    const results = await validateLeaveRequest(workspaceId, selectedUserId, startDate, endDate);
    setConflicts(results);
    setValidated(true);
  };

  const hasBlockingConflicts = conflicts.some(c => c.severity === 'blocking');

  const handleSubmit = async () => {
    if (!startDate || !endDate || !selectedUserId) { toast.error('Töltsd ki az összes mezőt'); return; }
    if (!justification.trim()) { toast.error('Admin indoklás kötelező'); return; }

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
      toast.error('Hiba a kérelem létrehozásakor');
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
      toast.success(autoApprove ? 'Kérelem létrehozva és jóváhagyva' : 'Kérelem létrehozva');
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
            Kérelem létrehozása más nevében
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Label>Tag kiválasztása</Label>
            <Select value={selectedUserId} onValueChange={v => { setSelectedUserId(v); setValidated(false); setConflicts([]); }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Válassz tagot..." /></SelectTrigger>
              <SelectContent>
                {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

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
            <Checkbox checked={isHalfDay} onCheckedChange={v => setIsHalfDay(!!v)} id="halfday" />
            <Label htmlFor="halfday" className="cursor-pointer">Fél nap</Label>
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
              <Label>Kezdő dátum</Label>
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
                    <Calendar mode="single" selected={endDate} onSelect={handleEndDate} locale={hu} disabled={d => startDate ? d < startDate : false} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div>
            <Label>Megjegyzés (opcionális)</Label>
            <Textarea className="mt-1" value={comment} onChange={e => setComment(e.target.value)} placeholder="Megjegyzés a kérelemhez..." rows={2} />
          </div>

          <div>
            <Label className="text-destructive">Admin indoklás *</Label>
            <Textarea className="mt-1 border-destructive/30" value={justification} onChange={e => setJustification(e.target.value)} placeholder="Miért hozod létre más nevében? (kötelező)" rows={2} />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={autoApprove} onCheckedChange={v => setAutoApprove(!!v)} />
            Automatikus jóváhagyás (admin override)
          </label>

          {validated && conflicts.length > 0 && (
            <div className="space-y-1 rounded-md border p-3">
              <p className="text-xs font-semibold mb-1">Ütközések:</p>
              {conflicts.map((c, i) => (
                <div key={i} className={cn("flex items-start gap-2 text-xs rounded px-2 py-1", c.severity === 'blocking' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400')}>
                  {c.severity === 'blocking' ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                  <span>{c.message}</span>
                </div>
              ))}
              {autoApprove && hasBlockingConflicts && (
                <p className="text-xs text-amber-600 font-medium mt-1">⚠️ Admin override: blokkolt ütközések felülbírálhatók.</p>
              )}
            </div>
          )}

          {validated && conflicts.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">✓ Nincs ütközés.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          {!validated ? (
            <Button onClick={handleValidate} disabled={!startDate || (!isHalfDay && !endDate) || !selectedUserId}>Ellenőrzés</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !selectedUserId || !justification.trim() || !startDate || (!isHalfDay && !endDate)}>
              {submitting ? 'Küldés...' : 'Létrehozás'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
