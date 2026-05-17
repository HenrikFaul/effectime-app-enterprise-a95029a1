import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a deduplicated, sorted list of all position names for a workspace,
 * combining three sources:
 *  1. enterprise_workspace_roles.name  — structured roles added from catalog
 *  2. enterprise_memberships.business_role — free-text roles on member profiles
 *  3. enterprise_member_role_allocations.business_role — role allocation strings
 */
export function useWorkspaceAllPositions(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-all-positions', workspaceId],
    queryFn: async () => {
      const [wsRoles, memberships, allocations] = await Promise.all([
        (supabase as any)
          .from('enterprise_workspace_roles')
          .select('name')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .order('name'),
        (supabase as any)
          .from('enterprise_memberships')
          .select('business_role')
          .eq('workspace_id', workspaceId)
          .not('business_role', 'is', null),
        (supabase as any)
          .from('enterprise_member_role_allocations')
          .select('business_role')
          .eq('workspace_id', workspaceId)
          .not('business_role', 'is', null),
      ]);
      const posSet = new Set<string>();
      ((wsRoles.data as { name: string }[]) || []).forEach(r => r.name && posSet.add(r.name));
      ((memberships.data as { business_role: string }[]) || []).forEach(r => r.business_role && posSet.add(r.business_role));
      ((allocations.data as { business_role: string }[]) || []).forEach(r => r.business_role && posSet.add(r.business_role));
      return Array.from(posSet).sort();
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}
