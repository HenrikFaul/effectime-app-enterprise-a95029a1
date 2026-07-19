import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { CollapsibleCardTrigger } from '@/components/ui/collapsible-card-trigger';
import { Plus, ChevronDown, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface Template {
  id: string;
  name: string;
  archived_at: string | null;
}

interface SystemRow {
  id: string;
  name: string;
}

interface TemplateSystemRow {
  id: string;
  template_id: string;
  system_id: string;
  mandatory: boolean;
}

export function AccessTemplates({ workspaceId, isAdmin }: Props) {
  const t = useT();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [linksByTemplate, setLinksByTemplate] = useState<Record<string, TemplateSystemRow[]>>({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: tpls }, { data: sys }] = await Promise.all([
      (supabase as any).from('enterprise_access_templates').select('*').eq('workspace_id', workspaceId).is('archived_at', null).order('name'),
      (supabase as any).from('enterprise_access_systems').select('id, name').eq('workspace_id', workspaceId).is('archived_at', null).order('name'),
    ]);
    setTemplates((tpls as Template[]) || []);
    setSystems((sys as SystemRow[]) || []);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadLinks = async (templateId: string) => {
    const { data } = await (supabase as any)
      .from('enterprise_access_template_systems')
      .select('id, template_id, system_id, mandatory')
      .eq('template_id', templateId);
    setLinksByTemplate((prev) => ({ ...prev, [templateId]: (data as TemplateSystemRow[]) || [] }));
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from('enterprise_access_templates')
      .insert({ workspace_id: workspaceId, name: name.trim() });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setName(''); toast.success(t('common.save')); load(); }
  };

  const toggleSystem = async (templateId: string, systemId: string, currentLink: TemplateSystemRow | undefined) => {
    if (currentLink) {
      const { error } = await (supabase as any)
        .from('enterprise_access_template_systems')
        .delete()
        .eq('id', currentLink.id);
      if (error) toast.error(error.message);
      else loadLinks(templateId);
    } else {
      const { error } = await (supabase as any)
        .from('enterprise_access_template_systems')
        .insert({ template_id: templateId, system_id: systemId, mandatory: true });
      if (error) toast.error(error.message);
      else loadLinks(templateId);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('access.templates_description')}</p>

      {isAdmin ? (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('common.name')}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering — IC1 access bundle" />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={busy || !name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> {t('access.add_template')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {templates.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{t('common.empty')}</div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <TemplateBlock
              key={tpl.id}
              template={tpl}
              systems={systems}
              links={linksByTemplate[tpl.id] ?? []}
              systemsLabel={t('access.systems_title')}
              onLoad={() => loadLinks(tpl.id)}
              onToggle={(sysId, link) => toggleSystem(tpl.id, sysId, link)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateBlock({
  template,
  systems,
  links,
  systemsLabel,
  onLoad,
  onToggle,
  isAdmin,
}: {
  template: Template;
  systems: SystemRow[];
  links: TemplateSystemRow[];
  systemsLabel: string;
  onLoad: () => void;
  onToggle: (systemId: string, link: TemplateSystemRow | undefined) => void;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const linkBySystem = new Map(links.map((l) => [l.system_id, l] as const));
  return (
    <Collapsible open={open} onOpenChange={(next) => { setOpen(next); if (next) onLoad(); }}>
      <CollapsibleCardTrigger
        label={`${template.name}: ${links.length} ${systemsLabel}`}
        className="cursor-pointer hover:bg-accent/30 transition-colors"
        contentClassName="flex items-center gap-2 py-2.5 px-4"
      >
        <Plug className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm flex-1">{template.name}</span>
        <Badge variant="secondary" className="text-[10px]">{links.length}</Badge>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleCardTrigger>
      <CollapsibleContent className="mt-2 pl-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {systems.map((s) => {
            const link = linkBySystem.get(s.id);
            return (
              <label key={s.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 cursor-pointer">
                <Checkbox checked={!!link} disabled={!isAdmin} onCheckedChange={() => onToggle(s.id, link)} />
                <span className="text-sm flex-1">{s.name}</span>
                {link?.mandatory ? <Badge className="text-[10px]">required</Badge> : null}
              </label>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
