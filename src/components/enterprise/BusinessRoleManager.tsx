import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Briefcase, UserPlus, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  workspaceId: string;
  userId: string;
}

interface AllocationRow {
  id: string;
  membership_id: string;
  business_role: string;
  percentage: number;
  is_priority: boolean;
}

interface MemberRow {
  id: string;
  user_id: string;
  display_name: string;
  business_role: string | null;
  base_working_hours: number;
}

interface PositionGroup {
  name: string;
  members: {
    membership_id: string;
    user_id: string;
    display_name: string;
    percentage: number;
    is_priority: boolean;
    base_working_hours: number;
    hours_per_day: number;
  }[];
  totalPercentage: number;
  totalHours: number;
}

export function BusinessRoleManager({ workspaceId, userId }: Props) {
  const [groups, setGroups] = useState<PositionGroup[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState('');
  const [assignDialog, setAssignDialog] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [assignPercentage, setAssignPercentage] = useState<number>(100);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: memberData }, { data: allocData }] = await Promise.all([
      (supabase as any)
        .from('enterprise_memberships')
        .select('id, user_id, business_role, base_working_hours')
        .eq('workspace_id', workspaceId)
        .in('status', ['active', 'invited']),
      (supabase as any)
        .from('enterprise_member_role_allocations')
        .select('id, membership_id, business_role, percentage, is_priority')
        .eq('workspace_id', workspaceId),
    ]);

    const membersList: MemberRow[] = (memberData as any[]) || [];

    if (membersList.length > 0) {
      const userIds = membersList.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);
      const profileMap = new Map((profiles as any[] || []).map((p: any) => [p.user_id, p.display_name]));
      membersList.forEach((m) => { m.display_name = profileMap.get(m.user_id) || 'Ismeretlen'; });
    }

    setMembers(membersList);
    const memberById = new Map(membersList.map((m) => [m.id, m]));

    // Build groups from allocations (single source of truth: enterprise_member_role_allocations)
    const allAllocs: AllocationRow[] = ((allocData as any[]) || []).map((a) => ({
      id: a.id,
      membership_id: a.membership_id,
      business_role: a.business_role,
      percentage: Number(a.percentage),
      is_priority: !!a.is_priority,
    }));

    const groupMap = new Map<string, PositionGroup>();
    allAllocs.forEach((a) => {
      const m = memberById.get(a.membership_id);
      if (!m) return;
      const baseHours = Number(m.base_working_hours ?? 8);
      const hoursPerDay = baseHours * (a.percentage / 100);
      const g = groupMap.get(a.business_role) || { name: a.business_role, members: [], totalPercentage: 0, totalHours: 0 };
      g.members.push({
        membership_id: a.membership_id,
        user_id: m.user_id,
        display_name: m.display_name,
        percentage: a.percentage,
        is_priority: a.is_priority,
        base_working_hours: baseHours,
        hours_per_day: hoursPerDay,
      });
      g.totalPercentage += a.percentage;
      g.totalHours += hoursPerDay;
      groupMap.set(a.business_role, g);
    });

    // Also include positions referenced in business_role column but no allocation row (legacy)
    membersList.forEach((m) => {
      if (m.business_role && !allAllocs.some((a) => a.membership_id === m.id && a.business_role === m.business_role)) {
        const g = groupMap.get(m.business_role) || { name: m.business_role, members: [], totalPercentage: 0, totalHours: 0 };
        groupMap.set(m.business_role, g);
      }
    });

    const arr = Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    arr.forEach((g) => g.members.sort((x, y) => (y.is_priority ? 1 : 0) - (x.is_priority ? 1 : 0) || y.percentage - x.percentage));
    setGroups(arr);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const handleCreateRole = async () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    if (groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Ez a pozíció már létezik');
      return;
    }
    setGroups((prev) => [...prev, { name: trimmed, members: [], totalPercentage: 0, totalHours: 0 }]);
    setNewRoleName('');
    toast.success(`"${trimmed}" pozíció létrehozva (rendelj hozzá tagokat)`);
  };

  const handleAssignMember = async () => {
    if (!selectedMemberId || !assignDialog) return;
    const pct = Math.max(1, Math.min(100, assignPercentage));

    // Insert allocation row
    const { error } = await (supabase as any).from('enterprise_member_role_allocations').insert({
      workspace_id: workspaceId,
      membership_id: selectedMemberId,
      business_role: assignDialog,
      percentage: pct,
      is_priority: false,
    });
    if (error) { toast.error('Hiba a hozzárendeléskor: ' + error.message); return; }

    // Ensure business_role column has a value (priority fallback)
    const member = members.find((m) => m.id === selectedMemberId);
    if (member && !member.business_role) {
      await (supabase as any).from('enterprise_memberships').update({ business_role: assignDialog }).eq('id', selectedMemberId);
    }
    toast.success('Tag hozzárendelve');
    setAssignDialog(null);
    setSelectedMemberId('');
    setAssignPercentage(100);
    fetchData();
  };

  const handleRemoveAllocation = async (membershipId: string, role: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_member_role_allocations')
      .delete()
      .eq('membership_id', membershipId)
      .eq('business_role', role);
    if (error) { toast.error('Hiba az eltávolításkor'); return; }
    // Also clear business_role column if it matched
    await (supabase as any).from('enterprise_memberships').update({ business_role: null }).eq('id', membershipId).eq('business_role', role);
    toast.success('Allokáció törölve');
    fetchData();
  };

  const handleDeleteRole = async (roleName: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_member_role_allocations')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('business_role', roleName);
    if (error) { toast.error('Hiba a törléskor'); return; }
    await (supabase as any)
      .from('enterprise_memberships')
      .update({ business_role: null })
      .eq('workspace_id', workspaceId)
      .eq('business_role', roleName);
    toast.success(`"${roleName}" pozíció és allokációi törölve`);
    fetchData();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Pozíciók / Szerepkörök kezelése
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Minden allokált tag és a hozzárendelt %-os arány itt látszik. A napi órák: <code>napi alap óra × allokáció%</code>.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Új pozíció neve (pl. Senior Developer)"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
            />
            <Button size="sm" onClick={handleCreateRole} disabled={!newRoleName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Létrehozás
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Még nincsenek pozíciók létrehozva.</p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <Card key={group.name} className="border-dashed">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{group.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{group.members.length} fő</Badge>
                        <Badge variant="outline" className="text-[10px]">∑ {group.totalPercentage.toFixed(0)}%</Badge>
                        <Badge variant="outline" className="text-[10px]">{group.totalHours.toFixed(1)} óra/nap</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setAssignDialog(group.name); setSelectedMemberId(''); setAssignPercentage(100); }}>
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteRole(group.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {group.members.length > 0 ? (
                      <div className="space-y-1 ml-6">
                        {group.members.map((m) => (
                          <div key={m.membership_id + group.name} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5">
                              {m.is_priority && <Star className="h-3 w-3 fill-primary text-primary" />}
                              <span>{m.display_name}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{m.percentage.toFixed(0)}%</Badge>
                              <Badge variant="outline" className="text-[10px]">{m.hours_per_day.toFixed(1)} ó</Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveAllocation(m.membership_id, group.name)}>
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic ml-6">Még nincs allokált tag.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {members.filter((m) => !groups.some((g) => g.members.some((x) => x.membership_id === m.id))).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Pozíció nélküli tagok:</p>
              <div className="flex flex-wrap gap-1">
                {members
                  .filter((m) => !groups.some((g) => g.members.some((x) => x.membership_id === m.id)))
                  .map((m) => (
                    <Badge key={m.id} variant="outline" className="text-xs">{m.display_name}</Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!assignDialog} onOpenChange={(open) => !open && setAssignDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Tag hozzárendelése – {assignDialog}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Tag</label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz tagot..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name} ({m.base_working_hours} ó/nap)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Allokáció (%)</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={assignPercentage}
                onChange={(e) => setAssignPercentage(Math.max(1, Math.min(100, Number(e.target.value) || 100)))}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Mégse</Button>
            <Button onClick={handleAssignMember} disabled={!selectedMemberId}>Hozzárendelés</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
