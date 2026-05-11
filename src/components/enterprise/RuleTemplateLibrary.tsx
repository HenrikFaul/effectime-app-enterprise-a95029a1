import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
}

export function RuleTemplateLibrary({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateJson, setTemplateJson] = useState('{\n  "blocked_dates": [],\n  "max_off": null,\n  "min_coverage": null\n}');

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_rule_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    setTemplates((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, [workspaceId]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error(t('rule_template_mgr.name_required')); return; }
    let parsed;
    try { parsed = JSON.parse(templateJson); } catch { toast.error(t('rule_template_mgr.invalid_json')); return; }

    const { error } = await supabase.from('enterprise_rule_templates').insert({
      workspace_id: workspaceId,
      name: name.trim(),
      description: description.trim() || null,
      template_data: parsed,
      created_by: userId,
    });
    if (error) { toast.error(t('rule_template_mgr.create_failed')); return; }
    toast.success(t('rule_template_mgr.created'));
    setShowForm(false);
    setName('');
    setDescription('');
    setTemplateJson('{\n  "blocked_dates": [],\n  "max_off": null,\n  "min_coverage": null\n}');
    fetchTemplates();
  };

  const handleDuplicate = async (tmpl: any) => {
    const { error } = await supabase.from('enterprise_rule_templates').insert({
      workspace_id: workspaceId,
      name: `${tmpl.name} (copy)`,
      description: tmpl.description,
      template_data: tmpl.template_data,
      created_by: userId,
    });
    if (error) { toast.error(t('rule_template_mgr.error')); return; }
    toast.success(t('rule_template_mgr.duplicated'));
    fetchTemplates();
  };

  const handleArchive = async (id: string) => {
    await supabase.from('enterprise_rule_templates').update({ is_archived: true }).eq('id', id);
    toast.success(t('rule_template_mgr.archived'));
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('enterprise_rule_templates').delete().eq('id', id);
    toast.success(t('rule_template_mgr.deleted'));
    fetchTemplates();
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('rule_template_mgr.title')}</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" /> {t('rule_template_mgr.btn_new') ?? 'New'}</Button>
      </div>

      {templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('rule_template_mgr.empty')}</p>
      ) : (
        <div className="space-y-2">
          {templates.map(tmpl => (
            <Card key={tmpl.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{tmpl.name}</span>
                      <Badge variant="outline" className="text-[10px]">v{tmpl.version}</Badge>
                    </div>
                    {tmpl.description && <p className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(tmpl.created_at), 'yyyy.MM.dd', { locale: hu })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDuplicate(tmpl)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleArchive(tmpl.id)}>
                      <Archive className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(tmpl.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('rule_template_mgr.dialog_title')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('rule_template_mgr.label_name')}</Label>
              <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t('rule_template_mgr.label_description')}</Label>
              <Input className="mt-1" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>{t('rule_template_mgr.label_json')}</Label>
              <Textarea
                className="mt-1 font-mono text-xs"
                value={templateJson}
                onChange={e => setTemplateJson(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('rule_template_mgr.btn_cancel')}</Button>
            <Button onClick={handleCreate}>{t('rule_template_mgr.btn_create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
