import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface Membership {
  id: string;
  user_id: string;
  display_name?: string;
}

interface Template {
  id: string;
  name: string;
  status: string;
  version: number;
}

interface Instance {
  id: string;
  member_id: string;
  template_id: string | null;
  template_version: number | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  started_at: string;
  due_at: string | null;
  completed_at: string | null;
}

export function OnboardingInbox({ workspaceId, isAdmin }: Props) {
  const t = useT();
  const [members, setMembers] = useState<Membership[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [memberId, setMemberId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [progressByInstance, setProgressByInstance] = useState<Record<string, { total: number; done: number }>>({});

  const load = useCallback(async () => {
    const [{ data: ms }, { data: tpls }, { data: ins }] = await Promise.all([
      (supabase as any).from('enterprise_memberships').select('id, user_id').eq('workspace_id', workspaceId).eq('status', 'active'),
      (supabase as any).from('enterprise_onboarding_templates').select('id, name, status, version').eq('workspace_id', workspaceId).is('archived_at', null).order('name'),
      (supabase as any).from('enterprise_onboarding_instances').select('*').eq('workspace_id', workspaceId).order('started_at', { ascending: false }),
    ]);

    const ids = ((ms as any[]) || []).map((m: any) => m.user_id);
    if (ids.length > 0) {
      const { data: prof } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids);
      const nameMap = new Map((prof || []).map((p: any) => [p.user_id, p.display_name || 'Unknown']));
      setMembers(((ms as any[]) || []).map((m: any) => ({ ...m, display_name: nameMap.get(m.user_id) })));
    } else {
      setMembers([]);
    }

    setTemplates((tpls as Template[]) || []);
    setInstances((ins as Instance[]) || []);

    // For each instance, compute progress (count of steps in template + completions)
    const list = (ins as Instance[]) || [];
    const map: Record<string, { total: number; done: number }> = {};
    await Promise.all(list.map(async (i) => {
      let total = 0;
      if (i.template_id) {
        const { count } = await (supabase as any)
          .from('enterprise_onboarding_template_steps')
          .select('id', { count: 'exact', head: true })
          .eq('template_id', i.template_id);
        total = count ?? 0;
      }
      const { count: done } = await (supabase as any)
        .from('enterprise_onboarding_step_completions')
        .select('id', { count: 'exact', head: true })
        .eq('instance_id', i.id)
        .eq('status', 'completed');
      map[i.id] = { total, done: done ?? 0 };
    }));
    setProgressByInstance(map);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStart = async () => {
    if (!memberId || !templateId) return;
    const tpl = templates.find((tt) => tt.id === templateId);
    setBusy(true);
    const { error } = await (supabase as any)
      .from('enterprise_onboarding_instances')
      .insert({
        workspace_id: workspaceId,
        member_id: memberId,
        template_id: templateId,
        template_version: tpl?.version ?? 1,
      });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMemberId('');
    setTemplateId('');
    toast.success(t('common.save'));
    load();
  };

  const handleCancel = async (id: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_onboarding_instances')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  const handleComplete = async (id: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_onboarding_instances')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  const memberName = (mid: string) => members.find((m) => m.id === mid)?.display_name || '—';
  const templateName = (tid: string | null) => templates.find((tt) => tt.id === tid)?.name || '—';

  return (
    <div className="space-y-3">
      {isAdmin ? (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[180px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('onboarding.member')}</label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('onboarding.template')}</label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {templates.filter((tt) => tt.status === 'published').map((tt) => (
                    <SelectItem key={tt.id} value={tt.id}>{tt.name} (v{tt.version})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleStart} disabled={busy || !memberId || !templateId}>
              <Plus className="h-4 w-4 mr-1" /> {t('onboarding.start_for_member')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {instances.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{t('onboarding.no_instances')}</div>
      ) : (
        <div className="space-y-1">
          {instances.map((i) => {
            const prog = progressByInstance[i.id] ?? { total: 0, done: 0 };
            const pct = prog.total === 0 ? 0 : Math.round((prog.done / prog.total) * 100);
            return (
              <div key={i.id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{memberName(i.member_id)}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {templateName(i.template_id)} · {prog.done}/{prog.total} ({pct}%)
                  </div>
                </div>
                <Badge variant={i.status === 'in_progress' ? 'secondary' : 'outline'} className="text-[10px]">
                  {i.status}
                </Badge>
                {isAdmin && i.status === 'in_progress' ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleComplete(i.id)}>{t('common.confirm')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(i.id)}>{t('common.cancel')}</Button>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
