import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

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
  const { t } = useI18n();
  const [teams, setTeams] = useState<Team[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [roleToAdd, setRoleToAdd] = useState<Record<string, string>>({});
  const [maxAbsentDraft, setMaxAbsentDraft] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);

    const [teamsRes, teamRolesRes, membersRes, allocRes] = await Promise.all([
      (supabase as any).from('enterprise_teams').select('*').eq('workspace_id', workspaceId).order('name'),
      (supabase as any).from('enterprise_team_roles').select('*').eq('workspace_id', workspaceId),
      supabase.from('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId).in('status', ['active', 'invited']),
      (supabase as any).from('enterprise_member_role_allocations').select('business_role').eq('workspace_id', workspaceId),
    ]);

    const teamRows = (teamsRes.data as any[]) || [];
    const teamRoleRows = (teamRolesRes.data as any[]) || [];
    const memberRows = (membersRes.data as any[]) || [];
    const allocRows = (allocRes.data as any[]) || [];

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

    // Merge both sources: memberships.business_role (legacy) + allocations.business_role (canonical)
    const roleSet = new Set<string>([
      ...memberRows.map(m => m.business_role).filter(Boolean),
      ...allocRows.map((a: any) => a.business_role).filter(Boolean),
    ]);
    const distinctRoles = Array.from(roleSet).sort() as string[];
    setAvailableRoles(distinctRoles);
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
      toast.error(error.message.includes('duplicate') ? t('teams.duplicate_name') : t('teams.create_failed'));
      return;
    }
    toast.success(t('teams.create_success', { name }));
    setNewTeamName('');
    setNewTeamDesc('');
    fetchData();
  };

  const handleDeleteTeam = async (teamId: string, name: string) => {
    if (!confirm(t('teams.delete_confirm', { name }))) return;
    const { error } = await (supabase as any).from('enterprise_teams').delete().eq('id', teamId);
    if (error) toast.error(t('teams.delete_failed'));
    else { toast.success(t('teams.delete_success')); fetchData(); }
  };

  const handleAddRole = async (teamId: string) => {
    const role = roleToAdd[teamId];
    if (!role) return;
    const { error } = await (supabase as any)
      .from('enterprise_team_roles')
      .insert({ team_id: teamId, workspace_id: workspaceId, business_role: role });
    if (error) {
      toast.error(error.message.includes('duplicate') ? t('teams.position_duplicate') : t('teams.position_add_failed'));
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
    if (error) toast.error(t('teams.position_remove_failed'));
    else fetchData();
  };

  const handleUpdateTeamPolicy = async (teamId: string, updates: { max_absent?: number | null; approval_mode?: string }) => {
    const { error } = await (supabase as any)
      .from('enterprise_teams')
      .update(updates)
      .eq('id', teamId)
      .eq('workspace_id', workspaceId);

    if (error) {
      toast.error(t('teams.settings_failed'));
      return;
    }

    setTeams(prev => prev.map(team => team.id === teamId ? { ...team, ...updates } : team));
    toast.success(t('teams.settings_saved'));
  };

  if (loading) {
    return <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('teams.description')}</p>

      <div className="rounded-md border p-3 bg-muted/30 space-y-2">
        <p className="text-xs font-medium">{t('teams.create_team')}</p>
        <Input
          placeholder={t('teams.team_name_placeholder')}
          value={newTeamName}
          onChange={e => setNewTeamName(e.target.value)}
          className="text-sm h-8"
        />
        <Input
          placeholder={t('teams.team_desc_placeholder')}
          value={newTeamDesc}
          onChange={e => setNewTeamDesc(e.target.value)}
          className="text-sm h-8"
        />
        <Button size="sm" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {t('teams.create_team')}
        </Button>
      </div>

      {teams.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t('teams.no_teams')}</p>
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
                      <Badge variant="secondary" className="text-[10px]">{t('teams.member_count', { count: team.memberCount })}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTeam(team.id, team.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border bg-muted/30 p-2">
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">{t('teams.max_absent')}</p>
                      <Input
                        type="number"
                        min={0}
                        value={maxAbsentDraft[team.id] ?? ''}
                        placeholder="–"
                        className="h-8 text-xs"
                        onChange={(e) => setMaxAbsentDraft(prev => ({ ...prev, [team.id]: e.target.value }))}
                        onBlur={() => {
                          const raw = (maxAbsentDraft[team.id] || '').trim();
                          const parsed = raw === '' ? null : Number(raw);
                          if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
                            toast.error(t('teams.max_absent_invalid'));
                            setMaxAbsentDraft(prev => ({ ...prev, [team.id]: team.max_absent == null ? '' : String(team.max_absent) }));
                            return;
                          }
                          handleUpdateTeamPolicy(team.id, { max_absent: parsed });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">{t('teams.approval_mode')}</p>
                      <Select value={team.approval_mode || 'linear'} onValueChange={(v) => handleUpdateTeamPolicy(team.id, { approval_mode: v })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">{t('teams.approval_linear')}</SelectItem>
                          <SelectItem value="parallel">{t('teams.approval_parallel')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {team.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">{t('teams.no_positions')}</span>
                    ) : team.roles.map(role => (
                      <Badge key={role} variant="outline" className="text-xs gap-1 pr-1">
                        {role}
                        <button onClick={() => handleRemoveRole(team.id, role)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  {rolesNotInTeam.length > 0 && (
                    <div className="flex gap-2">
                      <Select value={roleToAdd[team.id] || ''} onValueChange={v => setRoleToAdd(prev => ({ ...prev, [team.id]: v }))}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder={t('teams.role_add_prompt')} />
                        </SelectTrigger>
                        <SelectContent>
                          {rolesNotInTeam.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-7" onClick={() => handleAddRole(team.id)} disabled={!roleToAdd[team.id]}>
                        <Plus className="h-3 w-3 mr-1" /> {t('teams.add_position')}
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
        <p className="text-xs text-muted-foreground italic">{t('teams.no_positions')}</p>
      )}
    </div>
  );
}
