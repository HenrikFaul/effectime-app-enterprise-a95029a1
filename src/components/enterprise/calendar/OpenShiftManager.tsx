import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { useCreateOpenShift, useOpenShiftRequests } from '@/hooks/useOpenShifts';

interface SkillOption { id: string; name: string }

interface Props {
  workspaceId: string;
  officeId: string;
  shiftDate: string;      // yyyy-mm-dd
  businessRole?: string;
  skillId?: string;
  compact?: boolean;
  availableSkills?: SkillOption[];
}

export function OpenShiftManager({ workspaceId, officeId, shiftDate, businessRole, skillId, compact, availableSkills }: Props) {
  const { t } = useI18n();
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState(businessRole ?? '');
  const [selectedSkillId, setSelectedSkillId] = useState(skillId ?? '');
  const create = useCreateOpenShift();
  const { data: requests = [] } = useOpenShiftRequests(workspaceId);

  const existingOpen = requests.find(
    r => r.office_id === officeId && r.shift_date === shiftDate && r.status === 'open'
  );

  const handlePost = async () => {
    try {
      await create.mutateAsync({
        workspaceId,
        officeId,
        shiftDate,
        businessRole: selectedRole || undefined,
        skillId: selectedSkillId || undefined,
        notes: notes || undefined,
      });
      toast.success(t('open_shifts.posted_success'));
      setNotes('');
      setShowForm(false);
    } catch {
      toast.error(t('open_shifts.post_error'));
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setNotes('');
    setSelectedRole(businessRole ?? '');
    setSelectedSkillId(skillId ?? '');
  };

  // Role/skill fields for the form (show when no pre-set values and form is open)
  const showRoleField = !businessRole;
  const showSkillField = !skillId && availableSkills && availableSkills.length > 0;

  if (existingOpen) {
    if (compact) {
      return (
        <Badge variant="outline" className="gap-1 text-xs border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <CheckCircle2 className="h-3 w-3" /> {t('open_shifts.status_open')}
        </Badge>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-amber-600" />
        <span className="text-amber-800 dark:text-amber-300">{t('open_shifts.already_posted')}</span>
        <Badge variant="outline" className="ml-auto text-xs border-amber-400 text-amber-700">
          {t('open_shifts.status_open')}
        </Badge>
      </div>
    );
  }

  const formContent = (
    <div className="rounded border p-3 space-y-2 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground">{t('open_shifts.post_hint')}</p>
      {showRoleField && (
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
      {showSkillField && (
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
              {availableSkills!.map(s => (
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
  );

  if (compact) {
    return showForm ? (
      <div className="min-w-[260px]">{formContent}</div>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setShowForm(true)}
        title={t('open_shifts.post_open_shift')}
      >
        <Megaphone className="h-3.5 w-3.5" />
        {t('open_shifts.post_open_shift')}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs"
          onClick={() => setShowForm(true)}
        >
          <Megaphone className="h-3.5 w-3.5" />
          {t('open_shifts.post_open_shift')}
        </Button>
      ) : formContent}
    </div>
  );
}
