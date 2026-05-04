import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { User, Briefcase, Calendar, AlertTriangle, CheckCircle2, Clock, XCircle, Users, Edit2, Save, MapPin, Building2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationPreferences } from './NotificationPreferences';
import { RoleAllocationEditor, Allocation } from './RoleAllocationEditor';
import { MemberSitePriorityEditor } from './MemberSitePriorityEditor';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  user_id: string;
  role: string;
  status: string;
  team: string | null;
  location: string | null;
  business_role: string | null;
  joined_at: string | null;
  display_name?: string;
  city?: string | null;
  office_id?: string | null;
}

interface Office {
  id: string;
  name: string;
  city: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  workspaceId: string;
  allMembers: Member[];
  isAdmin?: boolean;
  onMemberUpdated?: () => void;
  showEmail?: boolean;
}

// Workspace-wide allocation row used to compute peers per role
interface PeerAllocation {
  membership_id: string;
  business_role: string;
  percentage: number;
  is_priority: boolean;
}

export function MemberProfileSheet({ open, onOpenChange, member, workspaceId, allMembers, isAdmin = false, onMemberUpdated, showEmail = false }: Props) {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [businessRoles, setBusinessRoles] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allWorkspaceAllocations, setAllWorkspaceAllocations] = useState<PeerAllocation[]>([]);
  const [teamsData, setTeamsData] = useState<{ id: string; name: string; roles: string[] }[]>([]);
  const [editForm, setEditForm] = useState({
    location: '',
    city: '',
    office_id: '',
    base_working_hours: 8,
  });

  const memberTeamNames = useMemo(() => {
    const allocRoles = new Set(allocations.map(a => a.business_role));
    const matched = teamsData.filter(t => t.roles.some(r => allocRoles.has(r)));
    return matched.map(t => t.name);
  }, [allocations, teamsData]);

  const priorityRole = useMemo(() => {
    return allocations.find(a => a.is_priority)?.business_role || allocations[0]?.business_role || null;
  }, [allocations]);

  // Sorted allocations: priority first, then by percentage desc
  const sortedAllocations = useMemo(() => {
    return [...allocations].sort((a, b) => {
      if (a.is_priority && !b.is_priority) return -1;
      if (!a.is_priority && b.is_priority) return 1;
      return b.percentage - a.percentage;
    });
  }, [allocations]);

  // For each role of this member, compute peers (other memberships) who have the same business_role
  const peersByRole = useMemo(() => {
    const result: Record<string, { display_name: string; percentage: number; user_id: string }[]> = {};
    if (!member) return result;
    sortedAllocations.forEach(a => {
      const peers = allWorkspaceAllocations
        .filter(p => p.business_role === a.business_role && p.membership_id !== member.id)
        .map(p => {
          const peerMember = allMembers.find(m => m.id === p.membership_id);
          return peerMember
            ? { display_name: peerMember.display_name || 'Ismeretlen', percentage: Number(p.percentage), user_id: peerMember.user_id }
            : null;
        })
        .filter((x): x is { display_name: string; percentage: number; user_id: string } => x !== null)
        .sort((x, y) => y.percentage - x.percentage);
      result[a.business_role] = peers;
    });
    return result;
  }, [sortedAllocations, allWorkspaceAllocations, allMembers, member]);

  const approvedLeaves = useMemo(() => leaveRequests.filter(r => r.status === 'approved'), [leaveRequests]);
  const pendingLeaves = useMemo(() => leaveRequests.filter(r => r.status === 'pending' || r.status === 'draft'), [leaveRequests]);
  const rejectedLeaves = useMemo(() => leaveRequests.filter(r => r.status === 'rejected'), [leaveRequests]);
  const pastLeaves = useMemo(() => approvedLeaves.filter(r => new Date(r.end_date) < new Date()), [approvedLeaves]);
  const upcomingLeaves = useMemo(() => approvedLeaves.filter(r => new Date(r.end_date) >= new Date()), [approvedLeaves]);

  const totalApprovedDays = useMemo(() => {
    return approvedLeaves.reduce((sum, r) => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }, 0);
  }, [approvedLeaves]);

  const sickDays = useMemo(() => {
    return leaveRequests
      .filter(r => r.leave_type === 'sick_leave' && r.status === 'approved')
      .reduce((sum, r) => {
        const start = new Date(r.start_date);
        const end = new Date(r.end_date);
        return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }, 0);
  }, [leaveRequests]);

  useEffect(() => {
    if (!member || !open) return;
    setEditing(false);
    setLoading(true);

    Promise.all([
      supabase.from('leave_requests').select('*').eq('workspace_id', workspaceId).eq('user_id', member.user_id).order('start_date', { ascending: false }),
      supabase.from('enterprise_offices').select('id, name, city').eq('workspace_id', workspaceId).order('name'),
      (supabase as any).from('enterprise_member_role_allocations').select('membership_id, business_role, percentage, is_priority').eq('workspace_id', workspaceId),
      supabase.from('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId).not('business_role', 'is', null),
      (supabase as any).from('enterprise_teams').select('id, name').eq('workspace_id', workspaceId),
      (supabase as any).from('enterprise_team_roles').select('team_id, business_role').eq('workspace_id', workspaceId),
    ]).then(([leaveRes, officeRes, allAllocRes, rolesRes, teamsRes, teamRolesRes]) => {
      setLeaveRequests((leaveRes.data as any[]) || []);
      setOffices((officeRes.data as Office[]) || []);

      const allAllocs = ((allAllocRes.data as any[]) || []).map((a: any) => ({
        membership_id: a.membership_id,
        business_role: a.business_role,
        percentage: Number(a.percentage),
        is_priority: !!a.is_priority,
      }));
      setAllWorkspaceAllocations(allAllocs);

      // Filter to current member's allocations
      const myAllocs: Allocation[] = allAllocs
        .filter(a => a.membership_id === member.id)
        .map(a => ({ business_role: a.business_role, percentage: a.percentage, is_priority: a.is_priority }));

      if (myAllocs.length === 0 && member.business_role) {
        myAllocs.push({ business_role: member.business_role, percentage: 100, is_priority: true });
      } else if (myAllocs.length > 0 && !myAllocs.some(a => a.is_priority)) {
        myAllocs[0].is_priority = true;
      }
      setAllocations(myAllocs);

      const roleSet = new Set<string>();
      ((rolesRes.data as any[]) || []).forEach((m: any) => { if (m.business_role) roleSet.add(m.business_role); });
      myAllocs.forEach(a => roleSet.add(a.business_role));
      allAllocs.forEach(a => roleSet.add(a.business_role));
      setBusinessRoles(Array.from(roleSet).sort());

      const teamRows = (teamsRes.data as any[]) || [];
      const teamRoleRows = (teamRolesRes.data as any[]) || [];
      const rolesByTeam = new Map<string, string[]>();
      teamRoleRows.forEach((tr: any) => {
        const arr = rolesByTeam.get(tr.team_id) || [];
        arr.push(tr.business_role);
        rolesByTeam.set(tr.team_id, arr);
      });
      setTeamsData(teamRows.map((t: any) => ({ id: t.id, name: t.name, roles: rolesByTeam.get(t.id) || [] })));
      setLoading(false);
    });

    if (showEmail) {
      supabase.auth.getUser().then(({ data }) => {
        setUserEmail(data?.user?.email || null);
      });
    } else {
      setUserEmail(null);
    }

    setEditForm({
      location: member.location || '',
      city: (member as any).city || '',
      office_id: (member as any).office_id || '',
      base_working_hours: Number((member as any).base_working_hours ?? 8),
    });
  }, [member, open, workspaceId, showEmail]);

  const handleSave = async () => {
    if (!member) return;
    const primaryRole = allocations.find(a => a.is_priority)?.business_role || allocations[0]?.business_role || null;
    const { error } = await (supabase as any)
      .from('enterprise_memberships')
      .update({
        business_role: primaryRole,
        location: editForm.location || null,
        city: editForm.city || null,
        office_id: editForm.office_id || null,
        base_working_hours: editForm.base_working_hours,
      })
      .eq('id', member.id);

    if (error) {
      toast.error('Hiba a mentéskor');
      return;
    }

    await supabase.from('enterprise_member_role_allocations').delete().eq('membership_id', member.id);
    if (allocations.length > 0) {
      const rows = allocations.map(a => ({
        workspace_id: workspaceId,
        membership_id: member.id,
        business_role: a.business_role,
        percentage: a.percentage,
        is_priority: !!a.is_priority,
      }));
      const { error: allocErr } = await (supabase as any).from('enterprise_member_role_allocations').insert(rows);
      if (allocErr) {
        console.error('Allocation save error:', allocErr);
        toast.error('Munkakör-megosztás mentési hiba');
        return;
      }
    }

    toast.success('Tag adatai frissítve');
    setEditing(false);
    onMemberUpdated?.();
  };

  if (!member) return null;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Tulajdonos';
      case 'resourceAssistant': return 'Erőforrás asszisztens';
      default: return 'Tag';
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation': return 'Szabadság';
      case 'sick_leave': return 'Betegszabadság';
      case 'unpaid_leave': return 'Fizetés nélküli';
      default: return 'Egyéb';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
      case 'pending': return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'rejected': return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const officeName = offices.find(o => o.id === (member as any).office_id)?.name;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold">{member.display_name || 'Ismeretlen'}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{getRoleLabel(member.role)}</Badge>
                {priorityRole && (
                  <Badge variant="default" className="text-[10px] gap-1">
                    <Star className="h-2.5 w-2.5 fill-current" /> {priorityRole}
                  </Badge>
                )}
              </div>
            </div>
            {isAdmin && !editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Szerkesztés
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-4">
            {/* Basic Info / Edit */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" /> Alapadatok</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2 text-sm">
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Munkakör(ök) és megosztás</Label>
                      <div className="mt-1.5">
                        <RoleAllocationEditor
                          allocations={allocations}
                          onChange={setAllocations}
                          availableRoles={businessRoles}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Csapat (automatikus)</Label>
                      <p className="text-sm mt-1">{memberTeamNames.length > 0 ? memberTeamNames.join(', ') : <span className="text-muted-foreground italic">Nincs (a pozíciók alapján számolódik)</span>}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Iroda</Label>
                        <Select value={editForm.office_id || '__none__'} onValueChange={v => setEditForm(f => ({ ...f, office_id: v === '__none__' ? '' : v }))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Válassz..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nincs megadva</SelectItem>
                            {offices.map(o => (
                              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Város</Label>
                        <Input value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} placeholder="Budapest" className="h-8 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Helyszín megjegyzés</Label>
                      <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="Remote / Hybrid" className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Napi alap munkaóra</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          value={editForm.base_working_hours}
                          onChange={e => setEditForm(f => ({ ...f, base_working_hours: Math.max(0, Math.min(24, Number(e.target.value) || 0)) }))}
                          className="h-8 text-sm w-24"
                        />
                        <span className="text-xs text-muted-foreground">óra/nap (pl. 8 = teljes munkaidő, 4 = félnapos)</span>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Mégse</Button>
                      <Button size="sm" onClick={handleSave}><Save className="h-3.5 w-3.5 mr-1" /> Mentés</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground shrink-0">Munkakör(ök)</span>
                      <span className="text-right flex flex-wrap gap-1 justify-end">
                        {sortedAllocations.length === 0 ? '–' : sortedAllocations.map(a => (
                          <Badge
                            key={a.business_role}
                            variant={a.is_priority ? 'default' : 'secondary'}
                            className={cn("text-[10px] gap-1", a.is_priority && "ring-1 ring-primary/40")}
                          >
                            {a.is_priority && <Star className="h-2.5 w-2.5 fill-current" />}
                            {a.business_role} ({a.percentage.toFixed(0)}%)
                          </Badge>
                        ))}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Csapat</span><span>{memberTeamNames.length > 0 ? memberTeamNames.join(', ') : '–'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Iroda</span>
                      <span className="flex items-center gap-1">
                        {officeName ? <><Building2 className="h-3 w-3" />{officeName}</> : '–'}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Város</span>
                      <span className="flex items-center gap-1">
                        {(member as any).city ? <><MapPin className="h-3 w-3" />{(member as any).city}</> : '–'}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Helyszín</span><span>{member.location || '–'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Napi alap munkaóra</span><span className="font-medium">{Number((member as any).base_working_hours ?? 8)} óra</span></div>
                    {userEmail && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="text-sm">{userEmail}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-muted-foreground">Csatlakozás</span><span>{member.joined_at ? format(new Date(member.joined_at), 'yyyy. MM. dd.') : '–'}</span></div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Site priorities (Phase II — allowedSites) */}
            <MemberSitePriorityEditor
              workspaceId={workspaceId}
              membershipId={member.id}
              isAdmin={isAdmin}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{totalApprovedDays}</p>
                  <p className="text-[10px] text-muted-foreground">Jóváhagyott nap</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{pendingLeaves.length}</p>
                  <p className="text-[10px] text-muted-foreground">Függő kérelem</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{sickDays}</p>
                  <p className="text-[10px] text-muted-foreground">Betegszab. nap</p>
                </CardContent>
              </Card>
            </div>

            {/* Same Role Members - per allocation block, priority first */}
            {sortedAllocations.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Pozíciónkénti kollégák
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  {sortedAllocations.map(a => {
                    const peers = peersByRole[a.business_role] || [];
                    return (
                      <div key={a.business_role} className={cn("rounded-md p-2", a.is_priority && "bg-primary/5 ring-1 ring-primary/20")}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {a.is_priority && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                            <span className="text-sm font-medium">{a.business_role}</span>
                            <Badge variant="outline" className="text-[9px]">{a.percentage.toFixed(0)}%</Badge>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{peers.length} kolléga</Badge>
                        </div>
                        {peers.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nincs más személy ebben a pozícióban.</p>
                        ) : (
                          <div className="space-y-1">
                            {peers.map(p => (
                              <div key={p.user_id + a.business_role} className="flex items-center justify-between text-sm">
                                <span>{p.display_name}</span>
                                <span className="text-xs text-muted-foreground">{p.percentage.toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                    <AlertTriangle className="h-3 w-3" />
                    Szabadságütközés ezen személyekkel lehetséges
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Upcoming */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Közelgő jóváhagyott szabadságok
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {loading ? (
                  <div className="flex justify-center py-4"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                ) : upcomingLeaves.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nincs közelgő szabadság.</p>
                ) : (
                  <div className="space-y-1.5">
                    {upcomingLeaves.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <span>{format(new Date(r.start_date), 'MM.dd.')} – {format(new Date(r.end_date), 'MM.dd.')}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{getLeaveTypeLabel(r.leave_type)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending */}
            {pendingLeaves.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Függő kérelmek
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {pendingLeaves.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <span>{format(new Date(r.start_date), 'MM.dd.')} – {format(new Date(r.end_date), 'MM.dd.')}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{getLeaveTypeLabel(r.leave_type)}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Past */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" /> Korábbi szabadságok
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {pastLeaves.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nincs korábbi szabadság.</p>
                ) : (
                  <div className="space-y-1.5">
                    {pastLeaves.slice(0, 10).map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <span>{format(new Date(r.start_date), 'MM.dd.')} – {format(new Date(r.end_date), 'MM.dd.')}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{getLeaveTypeLabel(r.leave_type)}</Badge>
                      </div>
                    ))}
                    {pastLeaves.length > 10 && <p className="text-[10px] text-muted-foreground">+{pastLeaves.length - 10} további</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rejected */}
            {rejectedLeaves.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" /> Elutasított kérelmek
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {rejectedLeaves.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <span>{format(new Date(r.start_date), 'MM.dd.')} – {format(new Date(r.end_date), 'MM.dd.')}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{getLeaveTypeLabel(r.leave_type)}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notification Preferences - only for own profile */}
            {showEmail && (
              <NotificationPreferences workspaceId={workspaceId} userId={member.user_id} />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
