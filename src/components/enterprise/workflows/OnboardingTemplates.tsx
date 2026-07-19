import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { CollapsibleCardTrigger } from '@/components/ui/collapsible-card-trigger';
import { Plus, Trash2, ChevronDown, BookOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  version: number;
  archived_at: string | null;
}

interface Step {
  id: string;
  template_id: string;
  sort_order: number;
  title: string;
  step_type: string;
  mandatory: boolean;
  due_offset_days: number;
  escalate_after_days: number | null;
}

const STEP_TYPES = [
  'task',
  'read',
  'acknowledge',
  'training',
  'exam',
  'approval',
  'internal_permission',
  'external_access',
] as const;

export function OnboardingTemplates({ workspaceId, isAdmin }: Props) {
  const t = useT();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [stepsByTemplate, setStepsByTemplate] = useState<Record<string, Step[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('enterprise_onboarding_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[onboarding_templates] load error', error.message);
      setTemplates([]);
    } else {
      setTemplates((data as Template[]) || []);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadStepsFor = async (templateId: string) => {
    const { data } = await (supabase as any)
      .from('enterprise_onboarding_template_steps')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order');
    setStepsByTemplate((prev) => ({ ...prev, [templateId]: (data as Step[]) || [] }));
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from('enterprise_onboarding_templates')
      .insert({ workspace_id: workspaceId, name: name.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName('');
    toast.success(t('common.save'));
    load();
  };

  const handlePublish = async (id: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_onboarding_templates')
      .update({ status: 'published' })
      .eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  const handleArchive = async (id: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_onboarding_templates')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  const handleAddStep = async (templateId: string, title: string, stepType: string) => {
    if (!title.trim()) return;
    const existingCount = stepsByTemplate[templateId]?.length ?? 0;
    const { error } = await (supabase as any)
      .from('enterprise_onboarding_template_steps')
      .insert({ template_id: templateId, title: title.trim(), step_type: stepType, sort_order: existingCount });
    if (error) toast.error(error.message);
    else loadStepsFor(templateId);
  };

  const handleDeleteStep = async (templateId: string, stepId: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_onboarding_template_steps')
      .delete()
      .eq('id', stepId);
    if (error) toast.error(error.message);
    else loadStepsFor(templateId);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('workflows.subtitle')}</p>

      {isAdmin ? (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('onboarding.template_name')}
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering — IC1" />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={busy || !name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> {t('onboarding.add_template')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{t('common.empty')}</div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <TemplateRow
              key={tpl.id}
              template={tpl}
              steps={stepsByTemplate[tpl.id] ?? []}
              onLoadSteps={() => loadStepsFor(tpl.id)}
              onPublish={() => handlePublish(tpl.id)}
              onArchive={() => handleArchive(tpl.id)}
              onAddStep={(title, type) => handleAddStep(tpl.id, title, type)}
              onDeleteStep={(stepId) => handleDeleteStep(tpl.id, stepId)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TemplateRowProps {
  template: Template;
  steps: Step[];
  onLoadSteps: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onAddStep: (title: string, type: string) => void;
  onDeleteStep: (id: string) => void;
  isAdmin: boolean;
}

function TemplateRow({ template, steps, onLoadSteps, onPublish, onArchive, onAddStep, onDeleteStep, isAdmin }: TemplateRowProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [stepTitle, setStepTitle] = useState('');
  const [stepType, setStepType] = useState<string>('task');

  const toggle = (next: boolean) => {
    setOpen(next);
    if (next) onLoadSteps();
  };

  return (
    <Collapsible open={open} onOpenChange={toggle}>
      <CollapsibleCardTrigger
        label={`${template.name}: ${t(`onboarding.${template.status}`)}, v${template.version}`}
        className="cursor-pointer hover:bg-accent/30 transition-colors"
        contentClassName="flex items-center gap-2 py-2.5 px-4"
      >
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm flex-1">{template.name}</span>
        <Badge variant={template.status === 'published' ? 'default' : 'outline'} className="text-[10px]">
          {t(`onboarding.${template.status}`)}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">v{template.version}</Badge>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleCardTrigger>
      <CollapsibleContent className="mt-2 space-y-2 pl-4">
        {isAdmin ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex-1 min-w-[160px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('onboarding.step_title')}
              </label>
              <Input value={stepTitle} onChange={(e) => setStepTitle(e.target.value)} placeholder="Read security policy" className="h-8 text-sm" />
            </div>
            <div className="min-w-[140px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('onboarding.step_type')}
              </label>
              <Select value={stepType} onValueChange={setStepType}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`onboarding.types.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => { onAddStep(stepTitle, stepType); setStepTitle(''); }} disabled={!stepTitle.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t('onboarding.add_step')}
            </Button>
            {template.status === 'draft' ? (
              <Button size="sm" variant="outline" onClick={onPublish}>{t('onboarding.publish')}</Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onArchive}>{t('common.archive')}</Button>
          </div>
        ) : null}

        {steps.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">{t('common.empty')}</div>
        ) : (
          <div className="space-y-1">
            {steps.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                <Badge variant="outline" className="text-[10px] font-mono">{s.sort_order + 1}</Badge>
                <Badge variant="secondary" className="text-[10px]">{t(`onboarding.types.${s.step_type}`) || s.step_type}</Badge>
                <span className="text-sm flex-1">{s.title}</span>
                {s.mandatory ? <Badge className="text-[10px]">{t('onboarding.mandatory')}</Badge> : null}
                {isAdmin ? (
                  <Button variant="ghost" size="sm" onClick={() => onDeleteStep(s.id)} aria-label={t('common.delete')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
