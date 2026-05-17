import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Megaphone, Loader2, X, Plus, Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { useCreateOpenShift, useOpenShiftRequests, useCancelOpenShift, useShiftCandidates } from '@/hooks/useOpenShifts';
import { PositionPickerDialog, type PositionPickerResult } from '@/components/enterprise/positions/PositionPickerDialog';

interface SkillOption { id: string; name: string }

interface Props {
  workspaceId: string;
  officeId: string;
  shiftDate: string;
  /** Pre-set from coverage rule (compact mode in drawer) */
  businessRole?: string;
  skillId?: string;
  compact?: boolean;
  availableSkills?: SkillOption[];
}

export function OpenShiftManager({
  workspaceId, officeId, shiftDate,
  businessRole, skillId, compact, availableSkills,
}: Props) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Structured position (from PositionPickerDialog)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedRoleName, setSelectedRoleName] = useState(businessRole ?? '');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(skillId ? [skillId] : []);

  // Legacy single-skill for when picker is not used in compact pre-set mode
  const [selectedSkillId, setSelectedSkillId] = useState(skillId ?? '');
  const [notes, setNotes] = useState('');
  const [timeoutHours, setTimeoutHours] = useState(3);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  const create = useCreateOpenShift();
  const cancel = useCancelOpenShift();
  const { data: allRequests = [] } = useOpenShiftRequests(workspaceId);
  const { data: candidates = [], isFetching: candidatesLoading } = useShiftCandidates({
    workspaceId, officeId, shiftDate,
    businessRole: selectedRoleName || businessRole || null,
    skillIds: selectedSkillIds.length > 0 ? selectedSkillIds : (selectedSkillId ? [selectedSkillId] : []),
    enabled: showForm && !compact,
  });

  const openShifts = allRequests.filter(
    r => r.office_id === officeId && r.shift_date === shiftDate && r.status === 'open'
  );

  const top3 = candidates.filter(c => c.isEligible).slice(0, 3);

  const handlePickPosition = (result: PositionPickerResult) => {
    setSelectedRoleId(result.positionRoleId);
    setSelectedRoleName(result.positionLabel);
    setSelectedSkillIds(result.skillIds);
    setSelectedCandidateIds([]);
  };

  const clearPosition = () => {
    setSelectedRoleId(null);
    setSelectedRoleName(businessRole ?? '');
    setSelectedSkillIds(skillId ? [skillId] : []);
    setSelectedCandidateIds([]);
  };

  const handlePost = async (targetOnly: boolean) => {
    const targetUserIds = targetOnly
      ? candidates.filter(c => selectedCandidateIds.includes(c.member.user_id)).map(c => c.member.user_id)
      : [];
    try {
      await create.mutateAsync({
        workspaceId, officeId, shiftDate,
        businessRole: selectedRoleName || undefined,
        skillId: selectedSkillId || undefined,
        notes: notes || undefined,
        roleId: selectedRoleId || undefined,
        skillIds: selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
        timeoutHours,
        targetUserIds,
      });
      toast.success(t('open_shifts.posted_success'));
      resetForm();
    } catch {
      toast.error(t('open_shifts.post_error'));
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await cancel.mutateAsync(id);
      toast.success(t('open_shifts.cancelled_success'));
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('not_open')) {
        toast.error(t('open_shifts.already_filled'));
      } else {
        toast.error(t('open_shifts.cancel_error'));
      }
    } finally {
      setCancellingId(null);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setNotes('');
    setTimeoutHours(3);
    setSelectedRoleId(null);
    setSelectedRoleName(businessRole ?? '');
    setSelectedSkillIds(skillId ? [skillId] : []);
    setSelectedSkillId(skillId ?? '');
    setSelectedCandidateIds([]);
  };

  // ── Compact mode (inside coverage-rule drawer header) ────────────────────
  if (compact) {
    if (!showForm) {
      if (openShifts.length > 0) {
        return (
          <Badge
            variant="outline"
            className="gap-1 text-xs border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-900/20 cursor-pointer"
            onClick={() => setShowForm(true)}
          >
            <Megaphone className="h-3 w-3" />
            {openShifts.length}×
          </Badge>
        );
      }
      return (
        <Button
          variant="outline" size="sm" className="gap-1.5 text-xs"
          onClick={() => setShowForm(true)}
          title={t('open_shifts.post_open_shift')}
        >
          <Megaphone className="h-3.5 w-3.5" />
          {t('open_shifts.post_open_shift')}
        </Button>
      );
    }
    return (
      <div className="rounded border p-3 space-y-2 bg-muted/30 min-w-[260px]">
        {openShifts.map(req => (
          <div key={req.id} className="flex items-center gap-2 text-xs rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5">
            <Megaphone className="h-3 w-3 text-amber-600 shrink-0" />
            <span className="flex-1 truncate">
              {req.business_role ?? t('open_shifts.any_role')}
            </span>
            <Button
              variant="ghost" size="icon"
              className="h-5 w-5 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={cancellingId === req.id}
              onClick={() => handleCancel(req.id)}
              title={t('open_shifts.close_shift')}
            >
              {cancellingId === req.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <X className="h-3 w-3" />}
            </Button>
          </div>
        ))}

        {/* Position picker button (compact) */}
        {!businessRole && (
          <div className="space-y-1">
            {selectedRoleName ? (
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs flex-1 justify-start">
                  {selectedRoleName}
                </Badge>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearPosition}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline" size="sm"
                className="w-full text-xs h-7 justify-start text-muted-foreground"
                onClick={() => setPickerOpen(true)}
              >
                {t('open_shifts.select_position')}
              </Button>
            )}
          </div>
        )}

        {!skillId && availableSkills && availableSkills.length > 0 && selectedSkillIds.length === 0 && (
          <Select
            value={selectedSkillId || '__any__'}
            onValueChange={v => setSelectedSkillId(v === '__any__' ? '' : v)}
          >
            <SelectTrigger className="text-sm h-7">
              <SelectValue placeholder={t('open_shifts.any_skill')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">{t('open_shifts.any_skill')}</SelectItem>
              {availableSkills.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('open_shifts.notes_placeholder')}
          className="text-sm min-h-[60px]"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handlePost(false)} disabled={create.isPending} className="gap-1">
            {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
            {t('open_shifts.broadcast')}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetForm}>
            {t('open_shifts.cancel')}
          </Button>
        </div>

        <PositionPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          workspaceId={workspaceId}
          onPick={handlePickPosition}
        />
      </div>
    );
  }

  // ── Full mode (open-shift-only sheet) ────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Existing open shifts */}
      {openShifts.map(req => (
        <div
          key={req.id}
          className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5"
        >
          <Megaphone className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="flex flex-wrap gap-1.5 mb-1">
              {req.business_role && (
                <Badge variant="secondary" className="text-xs">{req.business_role}</Badge>
              )}
              {req.skill_ids && req.skill_ids.length > 0
                ? req.skill_ids.map(sid => {
                    const name = availableSkills?.find(s => s.id === sid)?.name ?? sid;
                    return <Badge key={sid} variant="outline" className="text-xs">{name}</Badge>;
                  })
                : req.skill_id && (
                    <Badge variant="outline" className="text-xs">
                      {availableSkills?.find(s => s.id === req.skill_id)?.name ?? req.skill_id}
                    </Badge>
                  )
              }
              {!req.business_role && !req.skill_id && req.skill_ids?.length === 0 && (
                <Badge variant="secondary" className="text-xs">{t('open_shifts.any_role')}</Badge>
              )}
              <Badge className="text-xs bg-amber-500 hover:bg-amber-500 border-0">
                {t('open_shifts.status_open')}
              </Badge>
            </div>
            {req.notes && (
              <p className="text-xs text-muted-foreground truncate">{req.notes}</p>
            )}
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-6 w-6 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={cancellingId === req.id}
            onClick={() => handleCancel(req.id)}
            title={t('open_shifts.close_shift')}
          >
            {cancellingId === req.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <X className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ))}

      {/* Add new broadcast form */}
      {showForm ? (
        <div className="rounded border p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">{t('open_shifts.post_hint')}</p>

          {/* Position picker */}
          {!businessRole && (
            <div className="space-y-1">
              <Label className="text-xs">{t('open_shifts.position_label')}</Label>
              {selectedRoleName ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm flex-1 justify-start py-1 px-2">
                    {selectedRoleName}
                    {selectedSkillIds.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground">
                        · {selectedSkillIds.length} {t('open_shifts.skill_label').toLowerCase()}
                      </span>
                    )}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearPosition}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline" size="sm"
                  className="w-full h-8 justify-start text-muted-foreground"
                  onClick={() => setPickerOpen(true)}
                >
                  {t('open_shifts.select_position')}
                </Button>
              )}
            </div>
          )}

          {/* Legacy skill select (only when no position picked and skills provided) */}
          {!skillId && availableSkills && availableSkills.length > 0 && selectedSkillIds.length === 0 && (
            <div className="space-y-1">
              <Label className="text-xs">{t('open_shifts.skill_label')}</Label>
              <Select
                value={selectedSkillId || '__any__'}
                onValueChange={v => setSelectedSkillId(v === '__any__' ? '' : v)}
              >
                <SelectTrigger className="text-sm h-8">
                  <SelectValue placeholder={t('open_shifts.any_skill')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">{t('open_shifts.any_skill')}</SelectItem>
                  {availableSkills.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Timeout */}
          <div className="space-y-1">
            <Label className="text-xs">{t('open_shifts.timeout_label')}</Label>
            <Input
              type="number"
              min={1}
              max={72}
              value={timeoutHours}
              onChange={e => setTimeoutHours(Number(e.target.value) || 3)}
              className="text-sm h-8 w-32"
            />
          </div>

          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('open_shifts.notes_placeholder')}
            className="text-sm min-h-[60px]"
          />

          {/* Top-3 candidate shortlist */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{t('open_shifts.top_candidates')}</span>
              {candidatesLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {!candidatesLoading && top3.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t('open_shifts.no_candidates')}</p>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">{t('open_shifts.candidates_hint')}</p>
                {top3.map(r => (
                  <label
                    key={r.member.user_id}
                    className="flex items-center gap-2 rounded border bg-card px-2 py-1.5 cursor-pointer hover:bg-accent transition"
                  >
                    <Checkbox
                      checked={selectedCandidateIds.includes(r.member.user_id)}
                      onCheckedChange={v => {
                        setSelectedCandidateIds(prev =>
                          v ? [...prev, r.member.user_id] : prev.filter(id => id !== r.member.user_id)
                        );
                      }}
                    />
                    <span className="text-sm flex-1">{r.member.display_name}</span>
                    {r.member.business_role && (
                      <span className="text-[11px] text-muted-foreground">{r.member.business_role}</span>
                    )}
                    {r.issues.some(i => i.severity === 'warning') ? (
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    )}
                  </label>
                ))}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedCandidateIds.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handlePost(true)}
                disabled={create.isPending}
                className="gap-1"
              >
                {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                {t('open_shifts.notify_selected')} ({selectedCandidateIds.length})
              </Button>
            )}
            <Button size="sm" onClick={() => handlePost(false)} disabled={create.isPending} className="gap-1">
              {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
              {t('open_shifts.broadcast_all')}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              {t('open_shifts.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline" size="sm" className="w-full gap-2 text-xs"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('open_shifts.post_open_shift')}
        </Button>
      )}

      <PositionPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        workspaceId={workspaceId}
        onPick={handlePickPosition}
      />
    </div>
  );
}
