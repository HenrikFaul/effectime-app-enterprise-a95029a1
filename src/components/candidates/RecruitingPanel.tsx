import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, CalendarPlus, Link as LinkIcon, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import {
  useCandidates,
  useInterviewSlots,
  createInterviewSlot,
  generateCandidateOnboarding,
} from '@/hooks/useCandidates';

interface Props {
  workspaceId: string;
}

/**
 * RecruitingPanel — Top-20 Rank 20, v3.31.0.
 *
 * Workspace recruiting dashboard:
 *   - Candidate pipeline (status-grouped)
 *   - Interview slot creator with eligibility validation
 *   - Public booking URL generator (uses slot's `booking_token`)
 *   - One-click onboarding schedule generator on hire
 */
export function RecruitingPanel({ workspaceId }: Props) {
  const { t } = useI18n();
  const { data: candidates, refetch: refetchCandidates } = useCandidates(workspaceId);
  const { data: slots, refetch: refetchSlots } = useInterviewSlots(workspaceId);

  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [interviewerIds, setInterviewerIds] = useState('');
  const [creating, setCreating] = useState(false);
  const [onboardingCandidateId, setOnboardingCandidateId] = useState<string | null>(null);

  const handleCreateSlot = async () => {
    if (!slotStart || !slotEnd) {
      toast.error(t('recruiting.slot_dates_required'));
      return;
    }
    const ids = interviewerIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      toast.error(t('recruiting.interviewers_required'));
      return;
    }
    setCreating(true);
    try {
      const slotId = await createInterviewSlot({
        workspaceId,
        slotStart: new Date(slotStart).toISOString(),
        slotEnd: new Date(slotEnd).toISOString(),
        interviewerIds: ids,
      });
      toast.success(t('recruiting.slot_created'));
      setSlotStart(''); setSlotEnd(''); setInterviewerIds('');
      await refetchSlots();
      // Auto-show the booking link
      const newSlot = (await (await refetchSlots()).data)?.find((s) => s.id === slotId);
      if (newSlot?.booking_token) {
        await navigator.clipboard?.writeText(`${window.location.origin}/book/${newSlot.booking_token}`)
          .catch(() => undefined);
        toast.message(t('recruiting.booking_url_copied'));
      }
    } catch (e: unknown) {
      toast.error(t('recruiting.slot_create_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateOnboarding = async (candidateId: string) => {
    setOnboardingCandidateId(candidateId);
    try {
      const startDate = new Date().toISOString().slice(0, 10);
      await generateCandidateOnboarding(workspaceId, candidateId, startDate);
      toast.success(t('recruiting.onboarding_generated'));
      await refetchCandidates();
    } catch (e: unknown) {
      toast.error(t('recruiting.onboarding_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setOnboardingCandidateId(null);
    }
  };

  const copyBookingUrl = async (token: string) => {
    const url = `${window.location.origin}/book/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('recruiting.booking_url_copied'));
    } catch {
      toast.info(url);
    }
  };

  const statusClass = (s: string) =>
    s === 'hired' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
      : s === 'rejected' || s === 'withdrawn' ? 'bg-muted text-muted-foreground'
      : s === 'offer' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';

  return (
    <div className="space-y-4">
      {/* Candidate pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t('recruiting.pipeline_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(candidates ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('recruiting.no_candidates')}</p>
          ) : (
            <div className="space-y-1">
              {(candidates ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded border bg-background/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusClass(c.status)}`}>
                        {t(`recruiting.status_${c.status}` as 'recruiting.status_new')}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-[10px]">{c.email}{c.position_applied ? ` · ${c.position_applied}` : ''}</span>
                  </div>
                  {c.status === 'offer' && (
                    <Button
                      size="sm" variant="outline"
                      disabled={onboardingCandidateId === c.id}
                      onClick={() => handleGenerateOnboarding(c.id)}
                    >
                      {onboardingCandidateId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <><GraduationCap className="h-3.5 w-3.5 mr-1" /> {t('recruiting.hire_and_onboard')}</>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New slot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-primary" />
            {t('recruiting.new_slot_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="slot-start" className="text-xs">{t('recruiting.slot_start')}</Label>
              <Input id="slot-start" type="datetime-local" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="slot-end" className="text-xs">{t('recruiting.slot_end')}</Label>
              <Input id="slot-end" type="datetime-local" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="interviewers" className="text-xs">{t('recruiting.interviewer_ids')}</Label>
            <Input
              id="interviewers"
              value={interviewerIds}
              onChange={(e) => setInterviewerIds(e.target.value)}
              placeholder={t('recruiting.interviewer_placeholder')}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">{t('recruiting.interviewer_hint')}</p>
          </div>
          <Button onClick={handleCreateSlot} disabled={creating}>
            {creating ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('recruiting.creating_slot')}</> : t('recruiting.create_slot')}
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming slots with booking URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('recruiting.upcoming_slots')}</CardTitle>
        </CardHeader>
        <CardContent>
          {(slots ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('recruiting.no_slots')}</p>
          ) : (
            <div className="space-y-1">
              {(slots ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded border bg-background/60">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono">
                      {new Date(s.slot_start).toLocaleString()} → {new Date(s.slot_end).toLocaleTimeString()}
                    </span>
                    <Badge variant="outline" className="text-[10px] ml-2">
                      {t(`recruiting.slot_status_${s.status}` as 'recruiting.slot_status_available')}
                    </Badge>
                  </div>
                  {s.status === 'available' && s.booking_token && (
                    <Button size="sm" variant="outline" onClick={() => copyBookingUrl(s.booking_token!)}>
                      <LinkIcon className="h-3.5 w-3.5 mr-1" /> {t('recruiting.copy_booking_url')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
