import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Users, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { computeWorkspaceCapacity, sortCandidatesForRequirement, summarizeRequirements, type CapacityRow } from '@/lib/capacityEngine';
import { logAuditEvent } from '@/lib/auditLog';

interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_open_ended: boolean;
  status: string;
  color: string;
}

interface Props {
  mode: 'create' | 'edit';
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
  project?: Project;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

interface Requirement {
  id?: string;
  business_role: string;
  required_percentage: number;
}

interface Assignment {
  id?: string;
  membership_id: string;
  business_role: string;
  allocated_percentage: number;
  start_date: string;
  end_date: string | null;
  display_name?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusDays(iso: string, d: number) { const dt = new Date(iso); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); }

export function ProjectEditor({ mode, workspaceId, userId, isAdmin, project, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [startDate, setStartDate] = useState(project?.start_date || todayISO());
  const [endDate, setEndDate] = useState(project?.end_date || plusDays(todayISO(), 60));
  const [isOpenEnded, setIsOpenEnded] = useState(project?.is_open_ended || false);
  const [color, setColor] = useState(project?.color || COLORS[0]);
  const [status, setStatus] = useState(project?.status || 'active');
  const [saving, setSaving] = useState(false);

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [pickerRole, setPickerRole] = useState<string | null>(null);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [showNewRole, setShowNewRole] = useState(false);

  const projectId = project?.id;

  // Load existing requirements + assignments + available business roles
  useEffect(() => {
    const load = async () => {
      // distinct roles in workspace from member allocations
      const { data: roleAllocs } = await supabase
        .from('enterprise_member_role_allocations')
        .select('business_role')
        .eq('workspace_id', workspaceId);
      const distinctRoles = Array.from(new Set(((roleAllocs as any[]) || []).map((r) => r.business_role))).sort();
      setAvailableRoles(distinctRoles);

      if (projectId) {
        const [{ data: reqs }, { data: asgs }] = await Promise.all([
          supabase.from('enterprise_project_resource_requirements').select('*').eq('project_id', projectId),
          supabase.from('enterprise_project_assignments').select('*').eq('project_id', projectId),
        ]);
        setRequirements(((reqs as any[]) || []).map((r) => ({ id: r.id, business_role: r.business_role, required_percentage: Number(r.required_percentage) })));
        const asgList: Assignment[] = ((asgs as any[]) || []).map((a) => ({
          id: a.id,
          membership_id: a.membership_id,
          business_role: a.business_role,
          allocated_percentage: Number(a.allocated_percentage),
          start_date: a.start_date,
          end_date: a.end_date,
          display_name: undefined,
        }));
        // Enrich with display names
        if (asgList.length) {
          const ids = asgList.map((a) => a.membership_id);
          const { data: mems } = await supabase.from('enterprise_memberships').select('id, user_id').in('id', ids);
          const userIds = (mems as any[] || []).map((m) => m.user_id);
          const { data: profs } = userIds.length ? await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds) : { data: [] };
          const userByMembership = new Map((mems as any[] || []).map((m) => [m.id, m.user_id]));
          const nameByUser = new Map((profs as any[] || []).map((p) => [p.user_id, p.display_name || 'Ismeretlen']));
          asgList.forEach((a) => { a.display_name = nameByUser.get(userByMembership.get(a.membership_id) || '') || 'Ismeretlen'; });
        }
        setAssignments(asgList);
      }
    };
    if (open) load();
  }, [open, workspaceId, projectId]);

  const fulfillment = useMemo(() => summarizeRequirements(requirements, assignments), [requirements, assignments]);

  const addRequirement = (role: string) => {
    if (requirements.some((r) => r.business_role === role)) return;
    setRequirements([...requirements, { business_role: role, required_percentage: 100 }]);
  };

  const updateRequirement = (role: string, pct: number) => {
    setRequirements(requirements.map((r) => r.business_role === role ? { ...r, required_percentage: Math.max(0, pct) } : r));
  };

  const removeRequirement = (role: string) => {
    setRequirements(requirements.filter((r) => r.business_role !== role));
    setAssignments(assignments.filter((a) => a.business_role !== role));
  };

  const removeAssignment = (idx: number) => {
    setAssignments(assignments.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('A projekt neve kötelező'); return; }
    if (!isOpenEnded && (!endDate || endDate < startDate)) { toast.error('Érvénytelen időszak'); return; }

    setSaving(true);
    try {
      let savedId = projectId;

      const payload = {
        workspace_id: workspaceId,
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: isOpenEnded ? null : endDate,
        is_open_ended: isOpenEnded,
        status,
        color,
      };

      if (mode === 'create') {
        const { data, error } = await supabase
          .from('enterprise_projects')
          .insert({ ...payload, created_by: userId })
          .select('id')
          .single();
        if (error) throw error;
        savedId = data!.id as string;
      } else if (projectId) {
        const { error } = await supabase.from('enterprise_projects').update(payload).eq('id', projectId);
        if (error) throw error;
      }

      if (!savedId) throw new Error('No project id');

      // Replace requirements
      await supabase.from('enterprise_project_resource_requirements').delete().eq('project_id', savedId);
      if (requirements.length) {
        const { error: reqErr } = await supabase
          .from('enterprise_project_resource_requirements')
          .insert(requirements.map((r) => ({
            workspace_id: workspaceId,
            project_id: savedId!,
            business_role: r.business_role,
            required_percentage: r.required_percentage,
          })));
        if (reqErr) throw reqErr;
      }

      // Replace assignments
      await supabase.from('enterprise_project_assignments').delete().eq('project_id', savedId);
      if (assignments.length) {
        const { error: asgErr } = await supabase
          .from('enterprise_project_assignments')
          .insert(assignments.map((a) => ({
            workspace_id: workspaceId,
            project_id: savedId!,
            membership_id: a.membership_id,
            business_role: a.business_role,
            allocated_percentage: a.allocated_percentage,
            start_date: a.start_date,
            end_date: a.end_date,
          })));
        if (asgErr) throw asgErr;
      }

      try {
        await logAuditEvent({
          workspace_id: workspaceId,
          actor_id: userId,
          action: mode === 'create' ? 'project.create' : 'project.update',
          target_type: 'project',
          target_id: savedId,
          new_state: { name, requirements: requirements.length, assignments: assignments.length },
        });
      } catch { /* audit best-effort */ }

      toast.success(mode === 'create' ? 'Projekt létrehozva' : 'Projekt frissítve');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Mentés sikertelen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Új projekt' : `Projekt szerkesztése – ${project?.name}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic fields */}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Projekt neve *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
              </div>
              <div>
                <Label className="text-xs">Státusz</Label>
                <Select value={status} onValueChange={setStatus} disabled={!isAdmin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktív</SelectItem>
                    <SelectItem value="planned">Tervezett</SelectItem>
                    <SelectItem value="on_hold">Felfüggesztve</SelectItem>
                    <SelectItem value="completed">Befejezett</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Leírás</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={!isAdmin} />
              </div>
              <div>
                <Label className="text-xs">Kezdő dátum *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!isAdmin} />
              </div>
              <div>
                <Label className="text-xs">Záró dátum</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={endDate || ''} onChange={(e) => setEndDate(e.target.value)} disabled={isOpenEnded || !isAdmin} />
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Switch checked={isOpenEnded} onCheckedChange={setIsOpenEnded} disabled={!isAdmin} />
                    <Label className="text-xs">Határozatlan</Label>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Szín</Label>
                <div className="flex gap-2 mt-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      disabled={!isAdmin}
                      className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Requirements */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-medium text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Erőforrásigények pozíciónként</h4>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Select value="" onValueChange={(v) => v && addRequirement(v)}>
                      <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="+ Pozíció hozzáadása" /></SelectTrigger>
                      <SelectContent>
                        {availableRoles.filter((r) => !requirements.some((req) => req.business_role === r)).map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                        {availableRoles.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Még nincs pozíció.</div>}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowNewRole((v) => !v)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Új pozíció
                    </Button>
                  </div>
                )}
              </div>

              {showNewRole && isAdmin && (
                <div className="flex items-center gap-2 bg-muted/40 rounded p-2">
                  <Input
                    placeholder="Új pozíció neve (pl. Senior Backend Developer)"
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = newRoleInput.trim();
                        if (!t) return;
                        if (availableRoles.includes(t) || requirements.some((r) => r.business_role === t)) {
                          toast.error('Ez a pozíció már létezik'); return;
                        }
                        setAvailableRoles([...availableRoles, t].sort());
                        addRequirement(t);
                        setNewRoleInput('');
                        setShowNewRole(false);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const t = newRoleInput.trim();
                      if (!t) return;
                      if (availableRoles.includes(t) || requirements.some((r) => r.business_role === t)) {
                        toast.error('Ez a pozíció már létezik'); return;
                      }
                      setAvailableRoles([...availableRoles, t].sort());
                      addRequirement(t);
                      setNewRoleInput('');
                      setShowNewRole(false);
                    }}
                    disabled={!newRoleInput.trim()}
                  >
                    Hozzáad
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowNewRole(false); setNewRoleInput(''); }}>Mégse</Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground -mt-1">
                Az új pozíció akkor lesz végleges, ha legalább egy taghoz allokálva lesz (akár a Beállítások → Pozíciók fülön, akár itt egy tag hozzárendelésekor).
              </p>


              {requirements.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Adj hozzá legalább egy pozíció-igényt.</p>
              ) : (
                <div className="space-y-2">
                  {fulfillment.map((f) => {
                    const req = requirements.find((r) => r.business_role === f.business_role)!;
                    const isFulfilled = Math.abs(f.gap) < 0.5;
                    const isOver = f.gap < -0.5;
                    return (
                      <Card key={f.business_role} className="border-dashed">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{f.business_role}</Badge>
                            <Label className="text-xs">Igény:</Label>
                            <Input
                              type="number" min={0} step={5}
                              value={req.required_percentage}
                              onChange={(e) => updateRequirement(req.business_role, parseFloat(e.target.value) || 0)}
                              className="h-7 w-20 text-xs"
                              disabled={!isAdmin}
                            />
                            <span className="text-xs">%</span>
                            <span className="text-xs text-muted-foreground">→ Lekötve: <strong>{f.assigned.toFixed(0)}%</strong></span>
                            {isFulfilled && <Badge className="text-[10px] gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> Lefedve</Badge>}
                            {!isFulfilled && !isOver && (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertTriangle className="h-3 w-3" /> Még szükséges: {f.gap.toFixed(0)}%
                              </Badge>
                            )}
                            {isOver && <Badge variant="secondary" className="text-[10px]">Túl-allokálva: {Math.abs(f.gap).toFixed(0)}%</Badge>}
                            {isAdmin && (
                              <div className="ml-auto flex gap-1">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPickerRole(req.business_role)}>
                                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Tag hozzárendelése
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeRequirement(req.business_role)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Assigned members for this role */}
                          <div className="space-y-1">
                            {assignments.filter((a) => a.business_role === f.business_role).map((a, idx) => {
                              const realIdx = assignments.indexOf(a);
                              return (
                                <div key={idx} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                                  <span className="flex-1 truncate">{a.display_name || a.membership_id}</span>
                                  <Input
                                    type="number" min={0} max={100} step={5}
                                    value={a.allocated_percentage}
                                    onChange={(e) => {
                                      const next = [...assignments];
                                      next[realIdx] = { ...a, allocated_percentage: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) };
                                      setAssignments(next);
                                    }}
                                    className="h-6 w-16 text-xs"
                                    disabled={!isAdmin}
                                  />
                                  <span>%</span>
                                  {isAdmin && (
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeAssignment(realIdx)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
            {isAdmin && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Mentés...' : (mode === 'create' ? 'Létrehozás' : 'Mentés')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pickerRole && (
        <SmartCandidatePicker
          workspaceId={workspaceId}
          businessRole={pickerRole}
          requiredPercentage={requirements.find((r) => r.business_role === pickerRole)?.required_percentage || 100}
          windowStart={startDate}
          windowEnd={isOpenEnded ? plusDays(startDate, 365) : (endDate || plusDays(startDate, 30))}
          excludeProjectId={projectId}
          alreadyAssigned={new Set(assignments.filter((a) => a.business_role === pickerRole).map((a) => a.membership_id))}
          onPick={(rows) => {
            const startISO = startDate;
            const endISO = isOpenEnded ? null : endDate;
            const additions: Assignment[] = rows.map((r) => ({
              membership_id: r.membership_id,
              business_role: pickerRole!,
              allocated_percentage: r.suggested,
              start_date: startISO,
              end_date: endISO,
              display_name: r.display_name,
            }));
            setAssignments([...assignments, ...additions]);
            setPickerRole(null);
          }}
          onClose={() => setPickerRole(null)}
        />
      )}
    </>
  );
}

// ===== Smart Candidate Picker =====
interface PickerProps {
  workspaceId: string;
  businessRole: string;
  requiredPercentage: number;
  windowStart: string;
  windowEnd: string;
  excludeProjectId?: string;
  alreadyAssigned: Set<string>;
  onPick: (rows: { membership_id: string; display_name: string; suggested: number }[]) => void;
  onClose: () => void;
}

function SmartCandidatePicker({ workspaceId, businessRole, requiredPercentage, windowStart, windowEnd, excludeProjectId, alreadyAssigned, onPick, onClose }: PickerProps) {
  const [includeLeaves, setIncludeLeaves] = useState(true);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CapacityRow[]>([]);
  const [picks, setPicks] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { rows } = await computeWorkspaceCapacity({
        workspaceId, windowStart, windowEnd, includeLeaves, excludeProjectId,
      });
      const filtered = rows.filter((r) => r.business_role === businessRole && r.available_percentage > 0 && !alreadyAssigned.has(r.membership_id));
      const sorted = sortCandidatesForRequirement(filtered, requiredPercentage);
      setCandidates(sorted);
      setLoading(false);
    };
    load();
  }, [workspaceId, businessRole, requiredPercentage, windowStart, windowEnd, includeLeaves, excludeProjectId]);

  const togglePick = (row: CapacityRow) => {
    const next = new Map(picks);
    if (next.has(row.membership_id)) next.delete(row.membership_id);
    else next.set(row.membership_id, Math.min(row.available_percentage, requiredPercentage));
    setPicks(next);
  };

  const updatePickPercentage = (id: string, pct: number, max: number) => {
    const next = new Map(picks);
    next.set(id, Math.max(0, Math.min(max, pct)));
    setPicks(next);
  };

  const handleConfirm = () => {
    const rows = Array.from(picks.entries()).map(([id, pct]) => {
      const c = candidates.find((x) => x.membership_id === id)!;
      return { membership_id: id, display_name: c.display_name, suggested: pct };
    }).filter((r) => r.suggested > 0);
    onPick(rows);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tag hozzárendelése: {businessRole}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">
          Időszak: <strong>{windowStart} → {windowEnd}</strong> · Igény: <strong>{requiredPercentage}%</strong>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="cand-leaves" checked={includeLeaves} onCheckedChange={setIncludeLeaves} />
          <Label htmlFor="cand-leaves" className="text-xs cursor-pointer">Jóváhagyott szabadságok levonása</Label>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Nincs szabad kapacitású tag ehhez a pozícióhoz az adott időszakra.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {requiredPercentage >= 90
                ? 'Teljes munkaidős igény → a legtöbb szabad kapacitású tagok elöl.'
                : `Részleges igény (${requiredPercentage}%) → a leginkább megfelelő kapacitású tagok elöl.`}
            </p>
            {candidates.map((c) => {
              const picked = picks.has(c.membership_id);
              const value = picks.get(c.membership_id) ?? 0;
              return (
                <div key={c.membership_id} className={`border rounded-md p-2 flex items-center gap-3 ${picked ? 'border-primary bg-primary/5' : ''}`}>
                  <input type="checkbox" checked={picked} onChange={() => togglePick(c)} className="h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.display_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Alap: {c.base_percentage.toFixed(0)}% · Lekötve: {c.used_percentage.toFixed(0)}%
                      {c.leave_deduction > 0 && ` · Szabi: −${c.leave_deduction.toFixed(0)}%`}
                      · <span className="text-emerald-600 font-medium">Szabad: {c.available_percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                  {picked && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min={0} max={c.available_percentage} step={5}
                        value={value}
                        onChange={(e) => updatePickPercentage(c.membership_id, parseFloat(e.target.value) || 0, c.available_percentage)}
                        className="h-7 w-20 text-xs"
                      />
                      <span className="text-xs">%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button onClick={handleConfirm} disabled={picks.size === 0}>
            Hozzárendelés ({picks.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
