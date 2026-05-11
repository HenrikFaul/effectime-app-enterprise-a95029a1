import { supabase } from '@/integrations/supabase/client';
import type { EntityConfig } from '../config/entity-registry';

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
  const { data, error } = await (supabase as any).rpc('get_workspace_members_for_export', {
    p_workspace_id: workspaceId,
  });
  if (error) throw new Error(`Failed to fetch members: ${error.message}`);
  return (data || []).map((r: any): Record<string, string> => ({
    email: r.email || '',
    display_name: r.display_name || '',
    role: r.role || 'member',
    status: r.status || 'active',
    team: r.team || '',
    business_role: r.business_role || '',
    office_name: r.office_name || '',
    org_unit_name: r.org_unit_name || '',
    city: r.city || '',
    location: r.location || '',
    base_working_hours: r.base_working_hours != null ? String(r.base_working_hours) : '',
    weekly_capacity_hours: r.weekly_capacity_hours != null ? String(r.weekly_capacity_hours) : '',
    joined_at: r.joined_at ? String(r.joined_at).slice(0, 10) : '',
    manager_email: r.manager_email || '',
    subordinate_emails: r.subordinate_emails || '',
    seniority: r.seniority || '',
    leadership_level: r.leadership_level || '',
    leadership_category: r.leadership_category || '',
    contract_type: r.contract_type || '',
    employer_rights: r.employer_rights ? 'true' : 'false',
    skills: r.skills || '',
    membership_id: r.membership_id || '',
    user_id: r.user_id || '',
  }));
}

async function fetchLeave(workspaceId: string, filters?: { startDate?: string; endDate?: string; statusFilter?: string }): Promise<Record<string, string>[]> {
  const { data, error } = await (supabase as any).rpc('get_workspace_leave_for_export', {
    p_workspace_id: workspaceId,
    p_start_date: filters?.startDate || null,
    p_end_date: filters?.endDate || null,
    p_status: filters?.statusFilter && filters.statusFilter !== 'all' ? filters.statusFilter : null,
  });
  if (error) throw new Error(`Failed to fetch leave records: ${error.message}`);
  return (data || []).map((r: any): Record<string, string> => ({
    email: r.email || '',
    display_name: r.display_name || '',
    team: r.team || '',
    start_date: r.start_date || '',
    end_date: r.end_date || '',
    leave_type: r.leave_type || '',
    status: r.status || '',
    is_half_day: r.is_half_day ? 'true' : 'false',
    half_day_period: r.half_day_period || '',
    comment: r.comment || '',
  }));
}

async function fetchOffices(workspaceId: string): Promise<Record<string, string>[]> {
  const { data, error } = await supabase
    .from('enterprise_offices')
    .select('id, name, city, address')
    .eq('workspace_id', workspaceId)
    .order('name');
  if (error) throw new Error(`Failed to fetch offices: ${error.message}`);
  return (data || []).map((o: any) => ({
    name: o.name || '',
    city: o.city || '',
    address: o.address || '',
    office_id: o.id,
  }));
}

async function fetchWorkCategories(workspaceId: string): Promise<Record<string, string>[]> {
  const { data, error } = await (supabase as any)
    .from('enterprise_workspace_role_categories')
    .select('id, name, is_active')
    .eq('workspace_id', workspaceId)
    .order('name');
  if (error) throw new Error(`Failed to fetch work categories: ${error.message}`);
  return (data || []).map((c: any) => ({
    name: c.name || '',
    is_active: c.is_active ? 'true' : 'false',
    category_id: c.id,
  }));
}

async function fetchJobRoles(workspaceId: string): Promise<Record<string, string>[]> {
  const { data: roles, error } = await (supabase as any)
    .from('enterprise_workspace_roles')
    .select('id, name, is_active, category_id')
    .eq('workspace_id', workspaceId)
    .order('name');
  if (error) throw new Error(`Failed to fetch job roles: ${error.message}`);
  if (!roles || roles.length === 0) return [];
  const { data: cats } = await (supabase as any)
    .from('enterprise_workspace_role_categories')
    .select('id, name')
    .eq('workspace_id', workspaceId);
  const catMap = new Map((cats || []).map((c: any) => [c.id, c.name]));
  return roles.map((r: any) => ({
    name: r.name || '',
    category_name: (catMap.get(r.category_id) as string) || '',
    is_active: r.is_active ? 'true' : 'false',
    role_id: r.id,
  }));
}

async function fetchPositions(workspaceId: string): Promise<Record<string, string>[]> {
  const { data } = await (supabase as any)
    .from('enterprise_memberships')
    .select('business_role')
    .eq('workspace_id', workspaceId);
  const counts = new Map<string, number>();
  (data || []).forEach((m: any) => {
    if (m.business_role) counts.set(m.business_role, (counts.get(m.business_role) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, member_count: String(count) }));
}

async function fetchSkills(workspaceId: string): Promise<Record<string, string>[]> {
  const { data, error } = await supabase
    .from('enterprise_skills')
    .select('id, name, category, color')
    .eq('workspace_id', workspaceId)
    .order('name');
  if (error) throw new Error(`Failed to fetch skills: ${error.message}`);
  return (data || []).map((s: any) => ({
    name: s.name || '',
    category: s.category || '',
    color: s.color || '',
    skill_id: s.id,
  }));
}
