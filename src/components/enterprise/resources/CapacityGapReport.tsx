import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Users, TrendingDown, CheckCircle2, Pin } from 'lucide-react';
import { computeWorkspaceCapacity, type CapacityRow } from '@/lib/capacityEngine';
import { pinResourceWidget } from './ResourceWidgetCard';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
}

interface ProjectRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  is_open_ended: boolean;
  color: string;
  status: string;
}

interface RequirementRow {
  project_id: string;
  business_role: string;
  required_percentage: number;
}

interface GapPerRole {
  business_role: string;
  required: number;
  available: number;
  gap: number; // positive = shortfall (need to hire); negative = surplus
  projects: { id: string; name: string; required: number; color: string }[];
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusDays(iso: string, n: number) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

export function CapacityGapReport({ workspaceId }: Props) {
  const { user } = useAuth();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(plusDays(todayISO(), 90));
  const [includeLeaves, setIncludeLeaves] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pinning, setPinning] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [capacityRows, setCapacityRows] = useState<CapacityRow[]>([]);

  const handlePin = async () => {
    if (!user) return;
    setPinning(true);
    const { error } = await pinResourceWidget({
      workspaceId,
      userId: user.id,
      kind: 'capacity_gap',
      name: `Hiány ${from} → ${to}`,
      config: { from, to, include_leaves: includeLeaves, top_n: 5 },
    });
    setPinning(false);
    if (error) toast.error('Kitűzés sikertelen: ' + error);
    else toast.success('Hiány-widget kitűzve a Riportok dashboardra');
  };

  const load = async () => {
    if (!from || !to || from > to) return;
    setLoading(true);
    const [{ data: projData }, { data: reqData }, capData] = await Promise.all([
      supabase
        .from('enterprise_projects')
        .select('id, name, start_date, end_date, is_open_ended, color, status')
        .eq('workspace_id', workspaceId)
        .neq('status', 'completed'),
      supabase
        .from('enterprise_project_resource_requirements')
        .select('project_id, business_role, required_percentage')
        .eq('workspace_id', workspaceId),
      computeWorkspaceCapacity({ workspaceId, windowStart: from, windowEnd: to, includeLeaves }),
    ]);
    setProjects((projData as ProjectRow[]) || []);
    setRequirements(((reqData as any[]) || []).map((r) => ({ ...r, required_percentage: Number(r.required_percentage) })));
    setCapacityRows(capData.rows);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspaceId, from, to, includeLeaves]);

  const gaps = useMemo<GapPerRole[]>(() => {
    // Filter projects that overlap with selected window
    const overlapping = projects.filter((p) => {
      const pe = p.is_open_ended || !p.end_date ? '9999-12-31' : p.end_date;
      return p.start_date <= to && pe >= from;
    });
    const projectIds = new Set(overlapping.map((p) => p.id));

    const reqsByRole = new Map<string, GapPerRole>();
    for (const r of requirements) {
      if (!projectIds.has(r.project_id)) continue;
      const proj = overlapping.find((p) => p.id === r.project_id)!;
      const cur = reqsByRole.get(r.business_role) || {
        business_role: r.business_role,
        required: 0,
        available: 0,
        gap: 0,
        projects: [],
      };
      cur.required += r.required_percentage;
      cur.projects.push({ id: proj.id, name: proj.name, required: r.required_percentage, color: proj.color });
      reqsByRole.set(r.business_role, cur);
    }

    // Available = sum of base capacity per role (not "available" minus used—because the requirements
    // ARE the demand we want to compare base/total to). Use base_percentage so gap = "more capacity needed".
    const baseByRole = new Map<string, number>();
    for (const row of capacityRows) {
      baseByRole.set(row.business_role, (baseByRole.get(row.business_role) || 0) + row.base_percentage);
    }
    // Also include roles where there's demand but no allocation yet
    for (const role of reqsByRole.keys()) {
      if (!baseByRole.has(role)) baseByRole.set(role, 0);
    }

    const out: GapPerRole[] = [];
    for (const role of new Set([...reqsByRole.keys(), ...baseByRole.keys()])) {
      const g = reqsByRole.get(role) || {
        business_role: role, required: 0, available: 0, gap: 0, projects: [],
      };
      g.available = +(baseByRole.get(role) || 0).toFixed(2);
      g.gap = +(g.required - g.available).toFixed(2);
      out.push(g);
    }
    return out.sort((a, b) => b.gap - a.gap);
  }, [projects, requirements, capacityRows, from, to]);

  const totalGap = gaps.filter((g) => g.gap > 0).reduce((s, g) => s + g.gap, 0);
  const fteEquivalent = totalGap / 100;

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingDown className="h-4 w-4" /> Hiányzó kapacitás riport
        </CardTitle>
        <Button size="sm" variant="outline" onClick={handlePin} disabled={pinning || !user} className="gap-1">
          <Pin className="h-3.5 w-3.5" /> Kitűz a Riportokra
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Összesíti az aktív projektek erőforrásigényeit pozíciónként és összehasonlítja a cégszintű kapacitással. A pozitív rés azt jelzi, hogy új tagokat kell felvenni.
        </p>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] items-end">
          <div>
            <Label className="text-xs">Időszak kezdete</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Időszak vége</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <div className="flex items-center gap-2 h-9">
            <Switch id="gap-leaves" checked={includeLeaves} onCheckedChange={setIncludeLeaves} />
            <Label htmlFor="gap-leaves" className="text-xs cursor-pointer">Szabadságokkal</Label>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Frissítés
          </Button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div className="border rounded-md p-2 bg-muted/30">
            <div className="text-[10px] uppercase text-muted-foreground">Összes hiány</div>
            <div className="text-lg font-semibold text-destructive">{totalGap.toFixed(0)}%</div>
          </div>
          <div className="border rounded-md p-2 bg-muted/30">
            <div className="text-[10px] uppercase text-muted-foreground">FTE-ben kifejezve</div>
            <div className="text-lg font-semibold">{fteEquivalent.toFixed(1)} fő</div>
          </div>
          <div className="border rounded-md p-2 bg-muted/30">
            <div className="text-[10px] uppercase text-muted-foreground">Hiányos pozíciók</div>
            <div className="text-lg font-semibold">{gaps.filter((g) => g.gap > 0).length}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : gaps.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nincs aktív projekt erőforrásigény az időszakra.</p>
        ) : (
          <div className="space-y-2">
            {gaps.map((g) => {
              const isShortfall = g.gap > 0.5;
              const isExact = Math.abs(g.gap) <= 0.5;
              return (
                <div key={g.business_role} className={`border rounded-md p-3 ${isShortfall ? 'border-destructive/40 bg-destructive/5' : isExact ? 'border-emerald-500/40 bg-emerald-500/5' : ''}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span className="font-medium text-sm">{g.business_role}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Igény: <strong className="text-foreground">{g.required.toFixed(0)}%</strong></span>
                      <span className="text-muted-foreground">Cégszintű: <strong className="text-foreground">{g.available.toFixed(0)}%</strong></span>
                      {isShortfall && (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                          <AlertTriangle className="h-3 w-3" /> Hiány: {g.gap.toFixed(0)}% (~{(g.gap / 100).toFixed(1)} FTE)
                        </Badge>
                      )}
                      {isExact && (
                        <Badge className="bg-emerald-600 gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Pont elég
                        </Badge>
                      )}
                      {g.gap < -0.5 && (
                        <Badge variant="secondary" className="text-[10px]">Tartalék: {Math.abs(g.gap).toFixed(0)}%</Badge>
                      )}
                    </div>
                  </div>
                  {g.projects.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {g.projects.map((p) => (
                        <Badge key={p.id} variant="outline" className="text-[10px]" style={{ borderColor: p.color, color: p.color }}>
                          {p.name} ({p.required.toFixed(0)}%)
                        </Badge>
                      ))}
                    </div>
                  )}
                  {isShortfall && (
                    <div className="text-[11px] text-destructive mt-2">
                      💡 Az időszakban (<strong>{from} → {to}</strong>) <strong>{(g.gap / 100).toFixed(1)} fő</strong> teljes munkaidős <strong>{g.business_role}</strong> erőforrás felvétele javasolt.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
