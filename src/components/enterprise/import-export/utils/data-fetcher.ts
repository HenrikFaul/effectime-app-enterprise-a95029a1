import { supabase } from '@/integrations/supabase/client';
import type { EntityConfig } from '../config/entity-registry';

/**
 * Fetches current workspace data for the given entity in a flat row format
 * suitable for export. Returns rows keyed by field key.
 */
export async function fetchEntityRows(
  entity: EntityConfig,
  workspaceId: string,
  filters?: { startDate?: string; endDate?: string; statusFilter?: string }
): Promise<Record<string, string>[]> {
  switch (entity.key) {
    case 'members':
      return fetchMembers(workspaceId);
    case 'leave':
      return fetchLeave(workspaceId, filters);
    case 'offices':
      return fetchOffices(workspaceId);
    case 'work_categories':
      return fetchWorkCategories(workspaceId);
    case 'job_roles':
      return fetchJobRoles(workspaceId);
    case 'positions':
      return fetchPositions(workspaceId);
    case 'skills':
      return fetchSkills(workspaceId);
    default:
      return [];
  }
}

async function fetchMembers(workspaceId: string): Promise<Record<string, string>[]> {
  const [{ data: memberships }, { data: offices }] = await Promise.all([
    (supabase as any).from('enterprise_memberships').select('id, user_id, role, status, team, business_role, location, joined_at, city, office_id, base_working_hours').eq('workspace_id', workspaceId),
    supabase.from('enterprise_offices').select('id, name').eq('workspace_id', workspaceId),
  ]);

  const officeMap = new Map((offices || []).map((o: any) => [o.id, o.name]));
  const userIds = (memberships || []).map((m: any) => m.user_id);
  if (userIds.length === 0) return [];

  const [{ data: profiles }] = await Promise.all([
    (supabase as any).from('profiles').select('user_id, display_name, email').in('user_id', userIds),
  ]);
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  // Build manager_email map: requires a separate query for parent relationships if exists
  // The org chart uses enterprise_org_relationships or a parent column on memberships;
  // we leave manager_email empty by default and let manual editing populate it
  return (memberships || []).map((m: any): Record<string, string> => {
    const p: any = profileMap.get(m.user_id) || {};
    return {
      email: p.email || '',
      display_name: p.display_name || '',
      role: m.role || 'member',
      team: m.team || '',
      business_role: m.business_role || '',
      office_name: m.office_id ? (officeMap.get(m.office_id) as string) || '' : '',
      city: m.city || '',
      location: m.location || '',
      base_working_hours: m.base_working_hours != null ? String(m.base_working_hours) : '',
      joined_at: m.joined_at ? m.joined_at.slice(0, 10) : '',
      status: m.status || 'active',
      manager_email: '',
      membership_id: m.id,
      user_id: m.user_id,
    };
  });
}

async function fetchLeave(workspaceId: string, filters?: { startDate?: string; endDate?: string; statusFilter?: string }): Promise<Record<string, string>[]> {
  let query: any = (supabase as any).from('leave_requests').select('*').eq('workspace_id', workspaceId).order('start_date');
  if (filters?.startDate) query = query.gte('start_date', filters.startDate);
  if (filters?.endDate) query = query.lte('end_date', filters.endDate);
  if (filters?.statusFilter && filters.statusFilter !== 'all') query = query.eq('status', filters.statusFilter);
  const { data: requests } = await query;
  if (!requests || requests.length === 0) return [];

  const userIds = [...new Set(requests.map((r: any) => r.user_id))];
  const [{ data: profiles }, { data: members }] = await Promise.all([
    (supabase as any).from('profiles').select('user_id, display_name, email').in('user_id', userIds),
    (supabase as any).from('enterprise_memberships').select('user_id, team').eq('workspace_id', workspaceId).in('user_id', userIds),
  ]);
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  const teamMap = new Map((members || []).map((m: any) => [m.user_id, m.team]));

  return requests.map((r: any): Record<string, string> => {
    const p: any = profileMap.get(r.user_id) || {};
    return {
      email: p.email || '',
      start_date: r.start_date || '',
      end_date: r.end_date || '',
      leave_type: r.leave_type || '',
      status: r.status || '',
      is_half_day: r.is_half_day ? 'true' : 'false',
      half_day_period: r.half_day_period || '',
      comment: r.comment || '',
      display_name: p.display_name || '',
      team: (teamMap.get(r.user_id) as string) || '',
    };
  });
}

async function fetchOffices(workspaceId: string): Promise<Record<string, string>[]> {
  const { data } = await supabase.from('enterprise_offices').select('id, name, city, address').eq('workspace_id', workspaceId).order('name');
  return (data || []).map((o: any) => ({
    name: o.name || '',
    city: o.city || '',
    address: o.address || '',
    office_id: o.id,
  }));
}

async function fetchWorkCategories(workspaceId: string): Promise<Record<string, string>[]> {
  const { data } = await (supabase as any).from('enterprise_workspace_role_categories').select('id, name, is_active').eq('workspace_id', workspaceId).order('name');
  return (data || []).map((c: any) => ({
    name: c.name || '',
    is_active: c.is_active ? 'true' : 'false',
    category_id: c.id,
  }));
}

async function fetchJobRoles(workspaceId: string): Promise<Record<string, string>[]> {
  const { data: roles } = await (supabase as any).from('enterprise_workspace_roles').select('id, name, is_active, category_id').eq('workspace_id', workspaceId).order('name');
  if (!roles || roles.length === 0) return [];
  const { data: cats } = await (supabase as any).from('enterprise_workspace_role_categories').select('id, name').eq('workspace_id', workspaceId);
  const catMap = new Map((cats || []).map((c: any) => [c.id, c.name]));
  return roles.map((r: any) => ({
    name: r.name || '',
    category_name: (catMap.get(r.category_id) as string) || '',
    is_active: r.is_active ? 'true' : 'false',
    role_id: r.id,
  }));
}

async function fetchPositions(workspaceId: string): Promise<Record<string, string>[]> {
  const { data } = await (supabase as any).from('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId);
  const counts = new Map<string, number>();
  (data || []).forEach((m: any) => {
    if (m.business_role) counts.set(m.business_role, (counts.get(m.business_role) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({
    name,
    member_count: String(count),
  }));
}

async function fetchSkills(workspaceId: string): Promise<Record<string, string>[]> {
  const { data } = await supabase.from('enterprise_skills').select('id, name, category, color').eq('workspace_id', workspaceId).order('name');
  return (data || []).map((s: any) => ({
    name: s.name || '',
    category: s.category || '',
    color: s.color || '',
    skill_id: s.id,
  }));
}
