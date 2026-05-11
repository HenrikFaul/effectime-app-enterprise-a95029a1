import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Props { workspaceId: string; isAdmin: boolean; }

interface Membership { id: string; user_id: string; display_name: string; base_working_hours: number; weekly_capacity_hours: number }
interface MemberRate { id: string; membership_id: string; cost_rate: number; currency: string; effective_from: string; effective_to: string | null }
interface Project { id: string; name: string; color: string; start_date: string; end_date: string | null; is_open_ended: boolean }
interface Assignment { project_id: string; membership_id: string; business_role: string; allocated_percentage: number; start_date: string; end_date: string | null; billable: boolean }
interface ProjectRate { id: string; project_id: string; business_role: string; bill_rate: number; currency: string }

const CURRENCIES = ['EUR', 'USD', 'GBP', 'HUF'];

function workdaysBetween(startISO: string, endISO: string): number {
  let n = 0;
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  for (let t = s; t <= e; t += 86_400_000) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; }
  return n;
}

export function FinancialsPanel({ workspaceId, isAdmin }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Membership[]>([]);
  const [memberRates, setMemberRates] = useState<MemberRate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectRates, setProjectRates] = useState<ProjectRate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [memRes, mrRes, prRes, ratRes, asgRes] = await Promise.all([
      (supabase as any).from('enterprise_memberships').select('id, user_id, base_working_hours, weekly_capacity_hours').eq('workspace_id', workspaceId).eq('status', 'active'),
      (supabase as any).from('enterprise_member_rates').select('*').eq('workspace_id', workspaceId).order('effective_from', { ascending: false }),
      supabase.from('enterprise_projects').select('id, name, color, start_date, end_date, is_open_ended').eq('workspace_id', workspaceId).order('start_date', { ascending: false }),
      (supabase as any).from('enterprise_project_rates').select('*').eq('workspace_id', workspaceId),
      (supabase as any).from('enterprise_project_assignments').select('project_id, membership_id, business_role, allocated_percentage, start_date, end_date, billable').eq('workspace_id', workspaceId).eq('is_tentative', false),
    ]);
    const mems = (memRes.data as any[]) || [];
    const userIds = mems.map((m: any) => m.user_id);
    const { data: profs } = userIds.length ? await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds) : { data: [] };
    const nameMap = new Map((profs as any[] || []).map(p => [p.user_id, p.display_name || t('resources.unknown_member')]));
    setMembers(mems.map((m: any) => ({
      id: m.id, user_id: m.user_id, display_name: nameMap.get(m.user_id) || t('resources.unknown_member'),
      base_working_hours: Number(m.base_working_hours ?? 8),
      weekly_capacity_hours: Number(m.weekly_capacity_hours ?? 40),
    })));
    setMemberRates((mrRes.data as MemberRate[]) || []);
    setProjects((prRes.data as Project[]) || []);
    setProjectRates((ratRes.data as ProjectRate[]) || []);
    setAssignments((asgRes.data as Assignment[]) || []);
    if (!activeProjectId && prRes.data && (prRes.data as any[]).length) setActiveProjectId((prRes.data as any[])[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspaceId]);

  // Latest cost rate per membership
  const latestCost = useMemo(() => {
    const out = new Map<string, MemberRate>();
    for (const r of memberRates) {
      const cur = out.get(r.membership_id);
      if (!cur || r.effective_from > cur.effective_from) out.set(r.membership_id, r);
    }
    return out;
  }, [memberRates]);

  const setMemberCost = async (membershipId: string, cost: number, currency: string) => {
    const { error } = await (supabase as any).from('enterprise_member_rates').insert({
      workspace_id: workspaceId, membership_id: membershipId, cost_rate: cost, currency, effective_from: new Date().toISOString().slice(0, 10),
    });
    if (error) { toast.error(t('resources.save_failed')); return; }
    toast.success(t('resources.rate_saved'));
    load();
  };

  const setProjectRate = async (projectId: string, role: string, bill: number, currency: string) => {
    const existing = projectRates.find(r => r.project_id === projectId && r.business_role === role);
    if (existing) {
      await (supabase as any).from('enterprise_project_rates').update({ bill_rate: bill, currency }).eq('id', existing.id);
    } else {
      await (supabase as any).from('enterprise_project_rates').insert({ workspace_id: workspaceId, project_id: projectId, business_role: role, bill_rate: bill, currency });
    }
    toast.success(t('resources.bill_rate_saved')); load();
  };

  // Project profitability calculation
  const projectStats = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number; hours: number; currency: string }>();
    for (const a of assignments) {
      const m = members.find(x => x.id === a.membership_id);
      if (!m) continue;
      const proj = projects.find(p => p.id === a.project_id);
      if (!proj) continue;
      const start = a.start_date;
      const end = a.end_date || (proj.is_open_ended ? new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10) : (proj.end_date || a.start_date));
      const wd = workdaysBetween(start, end);
      const dailyHours = m.base_working_hours * (Number(a.allocated_percentage) / 100);
      const totalHours = wd * dailyHours;
      const cost = (latestCost.get(m.id)?.cost_rate || 0) * totalHours;
      const rate = projectRates.find(r => r.project_id === proj.id && r.business_role === a.business_role);
      const revenue = a.billable ? (rate?.bill_rate || 0) * totalHours : 0;
      const cur = map.get(proj.id) || { revenue: 0, cost: 0, hours: 0, currency: rate?.currency || latestCost.get(m.id)?.currency || 'EUR' };
      cur.revenue += revenue;
      cur.cost += cost;
      cur.hours += totalHours;
      map.set(proj.id, cur);
    }
    return map;
  }, [assignments, members, projects, projectRates, latestCost]);

  const grandTotals = useMemo(() => {
    let revenue = 0, cost = 0, hours = 0;
    projectStats.forEach(s => { revenue += s.revenue; cost += s.cost; hours += s.hours; });
    return { revenue, cost, hours, margin: revenue - cost };
  }, [projectStats]);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeProjectRoles = useMemo(() => {
    if (!activeProjectId) return [] as string[];
    return Array.from(new Set(assignments.filter(a => a.project_id === activeProjectId).map(a => a.business_role)));
  }, [assignments, activeProjectId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> {t('resources.title_financials')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <Tile label={t('resources.label_revenue')} value={grandTotals.revenue.toFixed(0)} unit="" tone="success" icon={<TrendingUp className="h-3 w-3" />} />
                <Tile label={t('resources.label_cost')} value={grandTotals.cost.toFixed(0)} unit="" tone="warn" icon={<TrendingDown className="h-3 w-3" />} />
                <Tile label={t('resources.label_margin')} value={grandTotals.margin.toFixed(0)} unit="" tone={grandTotals.margin >= 0 ? 'success' : 'destructive'} icon={<DollarSign className="h-3 w-3" />} />
                <Tile label={t('resources.label_planned_hours')} value={grandTotals.hours.toFixed(0)} unit="h" tone="default" icon={<Users className="h-3 w-3" />} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left px-2 py-1">{t('resources.col_project')}</th>
                      <th className="text-right px-2 py-1">{t('resources.col_hours')}</th>
                      <th className="text-right px-2 py-1">{t('resources.col_revenue')}</th>
                      <th className="text-right px-2 py-1">{t('resources.col_cost')}</th>
                      <th className="text-right px-2 py-1">{t('resources.col_margin')}</th>
                      <th className="text-right px-2 py-1">{t('resources.col_margin_pct')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => {
                      const s = projectStats.get(p.id) || { revenue: 0, cost: 0, hours: 0, currency: 'EUR' };
                      const margin = s.revenue - s.cost;
                      const pct = s.revenue > 0 ? (margin / s.revenue) * 100 : 0;
                      return (
                        <tr key={p.id} className="border-t">
                          <td className="px-2 py-1 flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</td>
                          <td className="px-2 py-1 text-right">{s.hours.toFixed(0)}h</td>
                          <td className="px-2 py-1 text-right">{s.revenue.toFixed(0)} {s.currency}</td>
                          <td className="px-2 py-1 text-right">{s.cost.toFixed(0)} {s.currency}</td>
                          <td className={`px-2 py-1 text-right font-medium ${margin >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{margin.toFixed(0)}</td>
                          <td className={`px-2 py-1 text-right ${pct >= 20 ? 'text-emerald-600' : pct >= 0 ? 'text-orange-500' : 'text-destructive'}`}>{s.revenue ? pct.toFixed(0) + '%' : '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {t('resources.members_cost_rate')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? null : members.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">{t('resources.no_active_members')}</p>
          ) : (
            <div className="space-y-1.5">
              {members.map(m => {
                const rate = latestCost.get(m.id);
                return (
                  <CostRateRow key={m.id} member={m} current={rate} disabled={!isAdmin} onSave={(c, cur) => setMemberCost(m.id, c, cur)} />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> {t('resources.project_bill_rates')}</CardTitle>
          {projects.length > 0 && (
            <Select value={activeProjectId || ''} onValueChange={setActiveProjectId}>
              <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {!activeProject ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">{t('resources.select_project')}</p>
          ) : activeProjectRoles.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">{t('resources.no_roles')}</p>
          ) : (
            <div className="space-y-1.5">
              {activeProjectRoles.map(role => {
                const rate = projectRates.find(r => r.project_id === activeProjectId && r.business_role === role);
                return (
                  <BillRateRow key={role} role={role} current={rate} disabled={!isAdmin} onSave={(b, cur) => setProjectRate(activeProjectId!, role, b, cur)} />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CostRateRow({ member, current, onSave, disabled }: { member: Membership; current: MemberRate | undefined; onSave: (cost: number, cur: string) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [val, setVal] = useState(current?.cost_rate ?? 0);
  const [cur, setCur] = useState(current?.currency ?? 'EUR');
  useEffect(() => { setVal(current?.cost_rate ?? 0); setCur(current?.currency ?? 'EUR'); }, [current]);
  return (
    <div className="grid grid-cols-[1fr_100px_90px_auto] items-center gap-2 border rounded p-2 bg-muted/20">
      <span className="text-sm truncate">{member.display_name}</span>
      <Input type="number" min={0} step={1} value={val} onChange={e => setVal(parseFloat(e.target.value) || 0)} className="h-8 text-xs" disabled={disabled} />
      <Select value={cur} onValueChange={setCur} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      {!disabled && <Button size="sm" variant="outline" className="h-8" onClick={() => onSave(val, cur)}>{t('resources.btn_save')}</Button>}
    </div>
  );
}

function BillRateRow({ role, current, onSave, disabled }: { role: string; current: ProjectRate | undefined; onSave: (bill: number, cur: string) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [val, setVal] = useState(current?.bill_rate ?? 0);
  const [cur, setCur] = useState(current?.currency ?? 'EUR');
  useEffect(() => { setVal(current?.bill_rate ?? 0); setCur(current?.currency ?? 'EUR'); }, [current]);
  return (
    <div className="grid grid-cols-[1fr_100px_90px_auto] items-center gap-2 border rounded p-2 bg-muted/20">
      <Badge variant="outline" className="justify-center text-xs">{role}</Badge>
      <Input type="number" min={0} step={1} value={val} onChange={e => setVal(parseFloat(e.target.value) || 0)} className="h-8 text-xs" disabled={disabled} />
      <Select value={cur} onValueChange={setCur} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      {!disabled && <Button size="sm" variant="outline" className="h-8" onClick={() => onSave(val, cur)}>{t('resources.btn_save')}</Button>}
    </div>
  );
}

function Tile({ label, value, unit, tone, icon }: { label: string; value: string; unit: string; tone: 'default' | 'success' | 'warn' | 'destructive'; icon: React.ReactNode }) {
  const cls =
    tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' :
    tone === 'warn' ? 'border-orange-500/30 bg-orange-500/5 text-orange-500' :
    tone === 'destructive' ? 'border-destructive/30 bg-destructive/5 text-destructive' :
    'border-border bg-muted/30 text-foreground';
  return (
    <div className={`border rounded-md p-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide flex items-center gap-1 opacity-80">{icon} {label}</div>
      <div className="text-lg font-semibold">{value}{unit && <span className="text-xs ml-0.5">{unit}</span>}</div>
    </div>
  );
}
