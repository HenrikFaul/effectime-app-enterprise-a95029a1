import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAuditEvent } from '@/lib/auditLog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Shield, UserMinus, ChevronRight, UserPlus, MapPin, Users as UsersIcon, ChevronDown, Filter, X } from 'lucide-react';
import { MemberProfileSheet } from './MemberProfileSheet';
import { InviteMemberDialog } from './InviteMemberDialog';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  workspaceId: string;
  userId: string;
  userRole: string;
  /** Forwarded to MemberProfileSheet so its "Bővebb adatok" deep-links can switch top-level workspace tabs. */
  onNavigateTab?: (tab: string) => void;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  status: string;
  team: string | null;
  location: string | null;
  business_role: string | null;
  joined_at: string | null;
  city?: string | null;
  office_id?: string | null;
  display_name?: string;
}

interface OfficeRef {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Összes státusz' },
  { value: 'active', label: 'Aktív' },
  { value: 'invited', label: 'Meghívott' },
  { value: 'suspended', label: 'Felfüggesztett' },
];

export function MemberList({ workspaceId, userId, userRole, onNavigateTab }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [offices, setOffices] = useState<OfficeRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [creatingInstantUser, setCreatingInstantUser] = useState(false);
  const [open, setOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [businessRoleFilter, setBusinessRoleFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const isAdmin = userRole === 'owner' || userRole === 'resourceAssistant';

  const fetchMembers = async () => {
    setLoading(true);
    const [{ data: memberData }, { data: officeData }] = await Promise.all([
      supabase
        .from('enterprise_memberships')
        .select('*')
        .eq('workspace_id', workspaceId)
        .in('status', ['active', 'invited', 'suspended']),
      supabase
        .from('enterprise_offices')
        .select('id, name')
        .eq('workspace_id', workspaceId),
    ]);

    const membersList = (memberData as any[]) || [];
    setOffices((officeData as any[]) || []);

    if (membersList.length > 0) {
      const userIds = membersList.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles as any[] || []).map((p: any) => [p.user_id, p.display_name]));
      membersList.forEach((m: any) => {
        m.display_name = profileMap.get(m.user_id) || 'Ismeretlen';
      });
    }

    setMembers(membersList);
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, [workspaceId]);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from('enterprise_memberships')
      .update({ role: newRole as any })
      .eq('id', memberId);

    if (error) {
      toast.error('Hiba a szerepkör módosításakor');
    } else {
      const member = members.find(m => m.id === memberId);
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'membership.role_changed',
        affected_user_id: member?.user_id,
        metadata: { prev_role: member?.role, new_role: newRole },
      });
      toast.success('Szerepkör módosítva');
      fetchMembers();
    }
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await supabase
      .from('enterprise_memberships')
      .update({ status: 'removed' as any })
      .eq('id', memberId);

    if (error) {
      toast.error('Hiba az eltávolításkor');
    } else {
      const member = members.find(m => m.id === memberId);
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'membership.removed',
        affected_user_id: member?.user_id,
      });
      toast.success('Tag eltávolítva');
      fetchMembers();
    }
    setRemovingId(null);
  };

  const handleSuspend = async (memberId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const { error } = await supabase
      .from('enterprise_memberships')
      .update({ status: newStatus as any })
      .eq('id', memberId);

    if (error) {
      toast.error('Hiba a státusz módosításakor');
    } else {
      const member = members.find(m => m.id === memberId);
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: userId,
        action: newStatus === 'suspended' ? 'membership.suspended' : 'membership.role_changed',
        affected_user_id: member?.user_id,
        metadata: { prev_status: currentStatus, new_status: newStatus },
      });
      toast.success(newStatus === 'suspended' ? 'Tag felfüggesztve' : 'Tag újraaktiválva');
      fetchMembers();
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Tulajdonos';
      case 'resourceAssistant': return 'Erőforrás asszisztens';
      default: return 'Tag';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="default" className="text-xs bg-green-600">Aktív</Badge>;
      case 'invited': return <Badge variant="secondary" className="text-xs">Meghívott</Badge>;
      case 'suspended': return <Badge variant="destructive" className="text-xs">Felfüggesztett</Badge>;
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  // Derived: distinct values for filter dropdowns
  const allBusinessRoles = useMemo(
    () => Array.from(new Set(members.map(m => m.business_role).filter(Boolean) as string[])).sort(),
    [members]
  );
  const allTeams = useMemo(
    () => Array.from(new Set(members.map(m => m.team).filter(Boolean) as string[])).sort(),
    [members]
  );
  const officeNameById = useMemo(
    () => new Map(offices.map(o => [o.id, o.name])),
    [offices]
  );
  const allLocations = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      const loc =
        (m.office_id && officeNameById.get(m.office_id)) ||
        m.city ||
        m.location ||
        null;
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [members, officeNameById]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (businessRoleFilter.length > 0 && !businessRoleFilter.includes(m.business_role || '')) return false;
      if (teamFilter.length > 0 && !teamFilter.includes(m.team || '')) return false;
      if (locationFilter !== 'all') {
        const loc =
          (m.office_id && officeNameById.get(m.office_id)) ||
          m.city ||
          m.location ||
          '';
        if (loc !== locationFilter) return false;
      }
      return true;
    });
  }, [members, statusFilter, businessRoleFilter, teamFilter, locationFilter, officeNameById]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (businessRoleFilter.length > 0 ? 1 : 0) +
    (teamFilter.length > 0 ? 1 : 0) +
    (locationFilter !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter('all');
    setBusinessRoleFilter([]);
    setTeamFilter([]);
    setLocationFilter('all');
  };

  const handleInstantUser = async () => {
    if (creatingInstantUser) return;
    setCreatingInstantUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-instant-enterprise-member', {
        body: { workspace_id: workspaceId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Instant user létrehozva: ${data?.display_name || 'új teszt tag'}`);
      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'membership.instant_user_created',
        affected_user_id: data?.user_id,
        metadata: {
          source: 'instant_user',
          display_name: data?.display_name,
          email: data?.email,
          membership_id: data?.membership_id,
        },
      });
      fetchMembers();
    } catch (e: any) {
      toast.error(`Instant user hiba: ${e?.message || 'ismeretlen hiba'}`);
    } finally {
      setCreatingInstantUser(false);
    }
  };



  return (
    <>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Új tag hozzáadása
          </Button>
          <Button size="sm" variant="secondary" className="ml-2" onClick={handleInstantUser} disabled={creatingInstantUser}>
            {creatingInstantUser ? 'Létrehozás...' : 'Instant user'}
          </Button>
        </div>
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Tagok</span>
                <Badge variant="outline" className="text-[10px]">{members.length}</Badge>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : members.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                Még nincsenek tagok.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filters */}
              <Card>
                <CardContent className="py-3 px-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1 min-w-[160px]">
                      <Label className="text-xs flex items-center gap-1">
                        <Filter className="h-3 w-3" /> Státusz
                      </Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <MultiSelectFilter
                      label="Munkakör"
                      options={allBusinessRoles}
                      value={businessRoleFilter}
                      onChange={setBusinessRoleFilter}
                    />
                    <MultiSelectFilter
                      label="Csapat"
                      options={allTeams}
                      value={teamFilter}
                      onChange={setTeamFilter}
                    />

                    <div className="space-y-1 min-w-[160px]">
                      <Label className="text-xs">Telephely</Label>
                      <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Összes telephely</SelectItem>
                          {allLocations.map(loc => (
                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                        <X className="h-3 w-3 mr-1" /> Szűrők törlése
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {filteredMembers.length} / {members.length} tag megjelenítve
                  </p>
                </CardContent>
              </Card>

              {/* Member rows */}
              {filteredMembers.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-6 text-sm text-muted-foreground">
                    Nincs a szűrésnek megfelelő tag.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => {
                    const isSelf = member.user_id === userId;
                    const canManage = isAdmin && !isSelf && member.role !== 'owner';

                    return (
                      <Card
                        key={member.id}
                        className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => isAdmin && setSelectedMember(member)}
                      >
                        <CardContent className="flex items-center justify-between py-3 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">
                                {member.display_name || 'Ismeretlen'}
                                {isSelf && <span className="text-muted-foreground ml-1">(te)</span>}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {getStatusBadge(member.status)}
                                <Badge variant="outline" className="text-xs">{getRoleLabel(member.role)}</Badge>
                                {member.business_role && <Badge variant="secondary" className="text-[10px]">{member.business_role}</Badge>}
                                {member.team && <span className="text-xs text-muted-foreground">{member.team}</span>}
                                {member.city && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><MapPin className="h-3 w-3" />{member.city}</span>}
                                {member.location && <span className="text-xs text-muted-foreground">📍{member.location}</span>}
                              </div>
                            </div>
                          </div>
                          {isAdmin && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

                          {canManage && (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {userRole === 'owner' && (
                                <Select
                                  value={member.role}
                                  onValueChange={(val) => handleRoleChange(member.id, val)}
                                >
                                  <SelectTrigger className="h-8 w-auto text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="member">Tag</SelectItem>
                                    <SelectItem value="resourceAssistant">Asszisztens</SelectItem>
                                    <SelectItem value="owner">Tulajdonos</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleSuspend(member.id, member.status)}
                                title={member.status === 'suspended' ? 'Újraaktiválás' : 'Felfüggesztés'}
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                              {userRole === 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => setRemovingId(member.id)}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={!!removingId} onOpenChange={(o) => !o && setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tag eltávolítása</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan el akarod távolítani ezt a tagot? Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={() => removingId && handleRemove(removingId)}>
              Eltávolítás
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MemberProfileSheet
        open={!!selectedMember}
        onOpenChange={(o) => !o && setSelectedMember(null)}
        member={selectedMember}
        workspaceId={workspaceId}
        allMembers={members}
        isAdmin={isAdmin}
        onMemberUpdated={fetchMembers}
        onNavigateTab={(tab) => {
          if (onNavigateTab) {
            setSelectedMember(null);
            onNavigateTab(tab);
          }
        }}
      />

      <InviteMemberDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        workspaceId={workspaceId}
        invitedBy={userId}
        onInvited={fetchMembers}
      />
    </>
  );
}

function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else onChange([...value, opt]);
  };

  return (
    <div className="space-y-1 min-w-[160px]">
      <Label className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-full justify-between text-xs font-normal">
            <span className="truncate">
              {value.length === 0
                ? `Összes ${label.toLowerCase()}`
                : value.length === 1
                ? value[0]
                : `${value.length} kiválasztva`}
            </span>
            <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Nincs elérhető érték</p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {options.map(opt => (
                <label
                  key={opt}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox checked={value.includes(opt)} onCheckedChange={() => toggle(opt)} />
                  <span className="text-xs truncate">{opt}</span>
                </label>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
