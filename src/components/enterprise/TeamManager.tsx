import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  userId: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  roles: string[];
  memberCount: number;
  max_absent: number | null;
  approval_mode: string;
}

export function TeamManager({ workspaceId, userId }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [roleToAdd, setRoleToAdd] = useState<Record<string, string>>({});
  const [maxAbsentDraft, setMaxAbsentDraft] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);

    const [teamsRes, teamRolesRes, membersRes] = await Promise.all([
      (supabase as any).from('enterprise_teams').select('*').eq('workspace_id', workspaceId).order('name'),
      (supabase as any).from('enterprise_team_roles').select('*').eq('workspace_id', workspaceId),
      supabase.from('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId).in('status', ['active', 'invited']),
    ]);

    const teamRows = (teamsRes.data as any[]) || [];
    const teamRoleRows = (teamRolesRes.data as any[]) || [];
    const memberRows = (membersRes.data as any[]) || [];

    // Map roles per team
    const rolesByTeam = new Map<string, string[]>();
    teamRoleRows.forEach(tr => {
      const arr = rolesByTeam.get(tr.team_id) || [];
      arr.push(tr.business_role);
      rolesByTeam.set(tr.team_id, arr);
    });

    // Count members per team (members whose business_role matches one of team's roles)
    const built: Team[] = teamRows.map(t => {
      const roles = rolesByTeam.get(t.id) || [];
      const memberCount = memberRows.filter(m => m.business_role && roles.includes(m.business_role)).length;
      return { id: t.id, name: t.name, description: t.description, roles, memberCount, max_absent: t.max_absent ?? null, approval_mode: t.approval_mode || 'linear' };
    });

    // Available business roles in this workspace (distinct from memberships)
    const distinctRoles = Array.from(new Set(memberRows.map(m => m.business_role).filter(Boolean))) as string[];
    setAvailableRoles(distinctRoles.sort());
    setTeams(built);
    setMaxAbsentDraft(Object.fromEntries(built.map(t => [t.id, t.max_absent == null ? '' : String(t.max_absent)])));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    const { error } = await (supabase as any)
      .from('enterprise_teams')
      .insert({ workspace_id: workspaceId, name, description: newTeamDesc.trim() || null, created_by: userId, approval_mode: 'linear', max_absent: null });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Ilyen nevű csapat már létezik' : 'Hiba a csapat létrehozásakor');
      return;
    }
    toast.success(`"${name}" csapat létrehozva`);
    setNewTeamName('');
    setNewTeamDesc('');
    fetchData();
  };

  const handleDeleteTeam = async (teamId: string, name: string) => {
    if (!confirm(`Biztosan törlöd a "${name}" csapatot?`)) return;
    const { error } = await (supabase as any).from('enterprise_teams').delete().eq('id', teamId);
    if (error) toast.error('Hiba a törléskor');
    else { toast.success('Csapat törölve'); fetchData(); }
  };

  const handleAddRole = async (teamId: string) => {
    const role = roleToAdd[teamId];
    if (!role) return;
    const { error } = await (supabase as any)
      .from('enterprise_team_roles')
      .insert({ team_id: teamId, workspace_id: workspaceId, business_role: role });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Ez a pozíció már szerepel' : 'Hiba a hozzáadáskor');
      return;
    }
    setRoleToAdd(prev => ({ ...prev, [teamId]: '' }));
    fetchData();
  };

  const handleRemoveRole = async (teamId: string, role: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_team_roles')
      .delete()
      .eq('team_id', teamId)
      .eq('business_role', role);
    if (error) toast.error('Hiba az eltávolításkor');
    else fetchData();
  };


  const handleUpdateTeamPolicy = async (teamId: string, updates: { max_absent?: number | null; approval_mode?: string }) => {
    const { error } = await (supabase as any)
      .from('enterprise_teams')
      .update(updates)
      .eq('id', teamId)
      .eq('workspace_id', workspaceId);

    if (error) {
      toast.error('Hiba a csapat beállításainak mentésekor');
      return;
    }

    setTeams(prev => prev.map(team => team.id === teamId ? { ...team, ...updates } : team));
    toast.success('Csapat beállítások mentve');
  };

  if (loading) {
    return <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        A csapatok pozíciók (munkakörök) gyűjteményei. A tagok automatikusan csapathoz tartoznak az általuk betöltött pozícióik alapján.
      </p>

      {/* Create new team */}
      <div className="rounded-md border p-3 bg-muted/30 space-y-2">
        <p className="text-xs font-medium">Új csapat létrehozása</p>
        <Input
          placeholder="Csapat neve (pl. Backend Team)"
          value={newTeamName}
          onChange={e => setNewTeamName(e.target.value)}
          className="text-sm h-8"
        />
        <Input
          placeholder="Leírás (opcionális)"
          value={newTeamDesc}
          onChange={e => setNewTeamDesc(e.target.value)}
          className="text-sm h-8"
        />
        <Button size="sm" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Csapat létrehozása
        </Button>
      </div>

      {/* Team list */}
      {teams.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Még nincsenek csapatok létrehozva.</p>
      ) : (
        <div className="space-y-2">
          {teams.map(team => {
            const rolesNotInTeam = availableRoles.filter(r => !team.roles.includes(r));
            return (
              <Card key={team.id} className="border-dashed">
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{team.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{team.memberCount} fő</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTeam(team.id, team.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border bg-muted/30 p-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">Max. párhuzamos távollévő</p>
                      <Input
                        type="number"
                        min={0}
                        value={maxAbsentDraft[team.id] ?? ''}
                        placeholder="Nincs korlát"
                        className="h-8 text-xs"
                        onChange={(e) => setMaxAbsentDraft(prev => ({ ...prev, [team.id]: e.target.value }))}
                        onBlur={() => {
                          const raw = (maxAbsentDraft[team.id] || '').trim();
                          const parsed = raw === '' ? null : Number(raw);
                          if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
                            toast.error('A max. távollévők száma csak 0 vagy pozitív érték lehet');
                            setMaxAbsentDraft(prev => ({ ...prev, [team.id]: team.max_absent == null ? '' : String(team.max_absent) }));
                            return;
                          }
                          handleUpdateTeamPolicy(team.id, { max_absent: parsed });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">Jóváhagyási mód</p>
                      <Select value={team.approval_mode || 'linear'} onValueChange={(v) => handleUpdateTeamPolicy(team.id, { approval_mode: v })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">Lineáris</SelectItem>
                          <SelectItem value="parallel">Párhuzamos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Assigned roles */}
                  <div className="flex flex-wrap gap-1">
                    {team.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">Nincs pozíció hozzárendelve</span>
                    ) : team.roles.map(role => (
                      <Badge key={role} variant="outline" className="text-xs gap-1 pr-1">
                        {role}
                        <button onClick={() => handleRemoveRole(team.id, role)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  {/* Add role */}
                  {rolesNotInTeam.length > 0 && (
                    <div className="flex gap-2">
                      <Select value={roleToAdd[team.id] || ''} onValueChange={v => setRoleToAdd(prev => ({ ...prev, [team.id]: v }))}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Pozíció kiválasztása..." />
                        </SelectTrigger>
                        <SelectContent>
                          {rolesNotInTeam.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-7" onClick={() => handleAddRole(team.id)} disabled={!roleToAdd[team.id]}>
                        <Plus className="h-3 w-3 mr-1" /> Hozzáadás
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {availableRoles.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Még nincsenek pozíciók a tagoknál. A "Pozíciók kezelése" szekcióban hozz létre, vagy rendelj pozíciót a tagokhoz, hogy itt választható legyen.
        </p>
      )}
    </div>
  );
}
