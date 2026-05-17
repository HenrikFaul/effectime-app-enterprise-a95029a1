import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, CheckCircle2, Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { useCreateOpenShift, useOpenShiftRequests, useCancelOpenShift } from '@/hooks/useOpenShifts';

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
  const [selectedRole, setSelectedRole] = useState(businessRole ?? '');
  const [selectedSkillId, setSelectedSkillId] = useState(skillId ?? '');
  const [notes, setNotes] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const create = useCreateOpenShift();
  const cancel = useCancelOpenShift();
  const { data: allRequests = [] } = useOpenShiftRequests(workspaceId);

  const openShifts = allRequests.filter(
    r => r.office_id === officeId && r.shift_date === shiftDate && r.status === 'open'
  );

  const skillName = (id: string) =>
    availableSkills?.find(s => s.id === id)?.name ?? id;

  const handlePost = async () => {
    try {
      await create.mutateAsync({
        workspaceId, officeId, shiftDate,
        businessRole: selectedRole || undefined,
        skillId: selectedSkillId || undefined,
        notes: notes || undefined,
      });
      toast.success(t('open_shifts.posted_success'));
      setNotes('');
      setSelectedRole(businessRole ?? '');
      setSelectedSkillId(skillId ?? '');
      setShowForm(false);
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
    setSelectedRole(businessRole ?? '');
    setSelectedSkillId(skillId ?? '');
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
        <CompactFormFields
          selectedRole={selectedRole} setSelectedRole={setSelectedRole}
          selectedSkillId={selectedSkillId} setSelectedSkillId={setSelectedSkillId}
          notes={notes} setNotes={setNotes}
          availableSkills={availableSkills}
          businessRole={businessRole} skillId={skillId}
          t={t}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handlePost} disabled={create.isPending} className="gap-1">
            {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
            {t('open_shifts.broadcast')}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetForm}>
            {t('open_shifts.cancel')}
          </Button>
        </div>
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
              {req.skill_id && (
                <Badge variant="outline" className="text-xs">{skillName(req.skill_id)}</Badge>
              )}
              {!req.business_role && !req.skill_id && (
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
        <div className="rounded border p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">{t('open_shifts.post_hint')}</p>
          {!businessRole && (
            <div className="space-y-1">
              <Label className="text-xs">{t('open_shifts.role_label')}</Label>
              <Input
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                placeholder={t('open_shifts.any_role')}
                className="text-sm h-8"
              />
            </div>
          )}
          {!skillId && availableSkills && availableSkills.length > 0 && (
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
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('open_shifts.notes_placeholder')}
            className="text-sm min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePost} disabled={create.isPending} className="gap-1">
              {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
              {t('open_shifts.broadcast')}
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
    </div>
  );
}

// ── Shared compact form fields ────────────────────────────────────────────────
function CompactFormFields({
  selectedRole, setSelectedRole,
  selectedSkillId, setSelectedSkillId,
  notes, setNotes,
  availableSkills,
  businessRole, skillId,
  t,
}: {
  selectedRole: string; setSelectedRole: (v: string) => void;
  selectedSkillId: string; setSelectedSkillId: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  availableSkills?: { id: string; name: string }[];
  businessRole?: string; skillId?: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <>
      {!businessRole && (
        <Input
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value)}
          placeholder={t('open_shifts.role_label')}
          className="text-sm h-7"
        />
      )}
      {!skillId && availableSkills && availableSkills.length > 0 && (
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
    </>
  );
}
