import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, FlaskConical, Sparkles, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

interface Scenario { id: string; name: string; description: string | null; is_baseline: boolean }
interface Project { id: string; name: string; color: string }
interface Membership { id: string; user_id: string; display_name: string; weekly_capacity_hours: number; base_working_hours: number }
interface Asg { id?: string; project_id: string; membership_id: string; business_role: string; allocated_percentage: number; start_date: string; end_date: string | null; notes?: string | null }

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusDays(iso: string, n: number) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

export function ScenarioPlanner({ workspaceId, userId, isAdmin }: Props) {
  const { t } = useI18n();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [allocs, setAllocs] = useState<{ membership_id: string; business_role: string; percentage: number }[]>([]);
  const [confirmedAsgs, setConfirmedAsgs] = useState<Asg[]>([]);
  const [scenarioAsgs, setScenarioAsgs] = useState<Asg[]>([]);

  const loadList = async () => {
    setLoading(true);
    const [scRes, prRes, memRes, alRes, asgRes] = await Promise.all([
      (supabase as any).from('enterprise_scenarios').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('enterprise_projects').select('id, name, color').eq('workspace_id', workspaceId),
      (supabase as any).from('enterprise_memberships').select('id, user_id, weekly_capacity_hours, base_working_hours').eq('workspace_id', workspaceId).eq('status', 'active'),
      (supabase as any).from('enterprise_member_role_allocations').select('membership_id, business_role, percentage').eq('workspace_id', workspaceId),
      supabase.from('enterprise_project_assignments').select('membership_id, business_role, allocated_percentage, start_date, end_date, project_id').eq('workspace_id', workspaceId).eq('is_tentative', false),
    ]);
    const mems = (memRes.data as any[]) || [];
    const userIds = mems.map((m: any) => m.user_id);
    const { data: profs } = userIds.length ? await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds) : { data: [] };
    const nameMap = new Map((profs as any[] || []).map(p => [p.user_id, p.display_name || t('scenario_planner.unknown')]));
    setScenarios((scRes.data as Scenario[]) || []);
    setProjects((prRes.data as Project[]) || []);
    setMembers(mems.map((m: any) => ({
      id: m.id, user_id: m.user_id, display_name: nameMap.get(m.user_id) || t('scenario_planner.unknown'),
      weekly_capacity_hours: Number(m.weekly_capacity_hours ?? 40),
      base_working_hours: Number(m.base_working_hours ?? 8),
    })));
    setAllocs((alRes.data as any[]) || []);
    setConfirmedAsgs((asgRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadList(); }, [workspaceId]);

  useEffect(() => {
    if (!activeId) { setScenarioAsgs([]); return; }
    (async () => {
      const { data } = await (supabase as any).from('enterprise_scenario_assignments').select('*').eq('scenario_id', activeId);
      setScenarioAsgs(((data as any[]) || []).map(d => ({
        id: d.id, project_id: d.project_id, membership_id: d.membership_id,
        business_role: d.business_role, allocated_percentage: Number(d.allocated_percentage),
        start_date: d.start_date, end_date: d.end_date, notes: d.notes,
      })));
    })();
  }, [activeId]);

  const createScenario = async () => {
    if (!newName.trim()) return;
    const { data, error } = await (supabase as any).from('enterprise_scenarios').insert({
      workspace_id: workspaceId, name: newName.trim(), description: newDesc.trim() || null, created_by: userId,
    }).select('*').single();
    if (error) { toast.error(t('scenario_planner.create_error') + error.message); return; }
    toast.success(t('scenario_planner.create_success'));
    setNewName(''); setNewDesc(''); setCreateOpen(false);
    setScenarios([data as Scenario, ...scenarios]);
    setActiveId((data as Scenario).id);
  };

  const deleteScenario = async (id: string) => {
    if (!confirm(t('scenario_planner.delete_confirm'))) return;
    await (supabase as any).from('enterprise_scenarios').delete().eq('id', id);
    setScenarios(scenarios.filter(s => s.id !== id));
    if (activeId === id) setActiveId(null);
    toast.success(t('scenario_planner.delete_success'));
  };

  const addAssignment = () => {
    if (!projects.length || !members.length) return;
    setScenarioAsgs([
      ...scenarioAsgs,
      {
        project_id: projects[0].id,
        membership_id: members[0].id,
        business_role: allocs.find(a => a.membership_id === members[0].id)?.business_role || '',
        allocated_percentage: 50,
        start_date: todayISO(),
        end_date: plusDays(todayISO(), 60),
      },
    ]);
  };

  const updateAsg = (idx: number, patch: Partial<Asg>) => {
    setScenarioAsgs(scenarioAsgs.map((a, i) => i === idx ? { ...a, ...patch } : a));
  };
  const removeAsg = (idx: number) => setScenarioAsgs(scenarioAsgs.filter((_, i) => i !== idx));

  const saveAsgs = async () => {
    if (!activeId) return;
    await (supabase as any).from('enterprise_scenario_assignments').delete().eq('scenario_id', activeId);
    if (scenarioAsgs.length) {
      const rows = scenarioAsgs.map(a => ({
        workspace_id: workspaceId, scenario_id: activeId, project_id: a.project_id,
        membership_id: a.membership_id, business_role: a.business_role,
        allocated_percentage: a.allocated_percentage, start_date: a.start_date,
        end_date: a.end_date, notes: a.notes || null,
      }));
      const { error } = await (supabase as any).from('enterprise_scenario_assignments').insert(rows);
      if (error) { toast.error(t('scenario_planner.save_error') + error.message); return; }
    }
    toast.success(t('scenario_planner.save_success'));
  };

  // Conflict / overload analysis: combine confirmed + scenario assignments per member, look for >100% week
  const conflicts = useMemo(() => {
    const out: { member: string; project: string; week: string; pct: number }[] = [];
    if (!activeId) return out;
    const memById = new Map(members.map(m => [m.id, m]));
    const projById = new Map(projects.map(p => [p.id, p]));
    const all = [...confirmedAsgs.map(a => ({ ...a, kind: 'confirmed' as const })), ...scenarioAsgs.map(a => ({ ...a, kind: 'scenario' as const }))];
    const buckets: Record<string, Record<string, number>> = {};
    for (const a of all) {
      const m = memById.get(a.membership_id);
      if (!m) continue;
      const start = new Date(a.start_date);
      const end = a.end_date ? new Date(a.end_date) : new Date(plusDays(a.start_date, 90));
      for (let t = start.getTime(); t <= end.getTime(); t += 7 * 86_400_000) {
        const wk = new Date(t).toISOString().slice(0, 10);
        buckets[m.id] = buckets[m.id] || {};
        buckets[m.id][wk] = (buckets[m.id][wk] || 0) + Number(a.allocated_percentage);
        if (buckets[m.id][wk] > 100 && a.kind === 'scenario') {
          out.push({
            member: m.display_name,
            project: projById.get(a.project_id)?.name || a.project_id,
            week: wk,
            pct: buckets[m.id][wk],
          });
        }
      }
    }
    return out.slice(0, 30);
  }, [activeId, confirmedAsgs, scenarioAsgs, members, projects]);

  const totalScenarioFte = useMemo(() => {
    return scenarioAsgs.reduce((s, a) => s + Number(a.allocated_percentage) / 100, 0);
  }, [scenarioAsgs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> {t('scenario_planner.card_title')}</CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> {t('scenario_planner.btn_new')}</Button>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : scenarios.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">{t('scenario_planner.empty')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {scenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={`group inline-flex items-center gap-2 border rounded-full px-3 py-1 text-xs transition-colors ${activeId === s.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="font-medium">{s.name}</span>
                  {isAdmin && (
                    <span onClick={(e) => { e.stopPropagation(); deleteScenario(s.id); }} className="ml-1 opacity-60 hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeId && (
        <Card>
          <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0 flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> {t('scenario_planner.tentative_alloc_title')}
              <Badge variant="secondary" className="text-[10px]">FTE: {totalScenarioFte.toFixed(2)}</Badge>
              {conflicts.length > 0 && <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> {t('scenario_planner.conflicts_badge', { count: conflicts.length })}</Badge>}
            </CardTitle>
            {isAdmin && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={addAssignment}><Plus className="h-3.5 w-3.5 mr-1" /> {t('scenario_planner.btn_add_assignment')}</Button>
                <Button size="sm" onClick={saveAsgs}>{t('scenario_planner.btn_save_asgs')}</Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {scenarioAsgs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-3">{t('scenario_planner.no_assignments')}</p>
            ) : (
              <div className="space-y-2">
                {scenarioAsgs.map((a, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-[1.4fr_1.4fr_1fr_0.8fr_0.9fr_0.9fr_auto] items-center gap-2 border rounded p-2 bg-muted/20">
                    <Select value={a.project_id} onValueChange={v => updateAsg(idx, { project_id: v })} disabled={!isAdmin}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={a.membership_id} onValueChange={v => updateAsg(idx, { membership_id: v })} disabled={!isAdmin}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={a.business_role} onChange={e => updateAsg(idx, { business_role: e.target.value })} placeholder={t('scenario_planner.role_placeholder')} className="h-8 text-xs" disabled={!isAdmin} />
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} max={100} step={5} value={a.allocated_percentage} onChange={e => updateAsg(idx, { allocated_percentage: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" disabled={!isAdmin} />
                      <span className="text-xs">%</span>
                    </div>
                    <Input type="date" value={a.start_date} onChange={e => updateAsg(idx, { start_date: e.target.value })} className="h-8 text-xs" disabled={!isAdmin} />
                    <Input type="date" value={a.end_date || ''} onChange={e => updateAsg(idx, { end_date: e.target.value || null })} className="h-8 text-xs" disabled={!isAdmin} />
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeAsg(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="border border-destructive/30 bg-destructive/5 rounded p-2 space-y-1">
                <div className="text-xs font-medium text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {t('scenario_planner.overload_warning')}</div>
                <ul className="text-[11px] space-y-0.5 max-h-40 overflow-y-auto">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c.member} · {c.project} · {c.week.slice(5)} → {c.pct.toFixed(0)}% {'(>100%)'}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('scenario_planner.btn_new')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('common.name')} *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('scenario_planner.name_placeholder')} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">{t('common.description')}</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} placeholder={t('scenario_planner.desc_placeholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={createScenario} disabled={!newName.trim()}>{t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
