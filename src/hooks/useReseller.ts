import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Reseller portal hooks (Top-20 Rank 4, v3.25.0).
 *
 * B2B2B: HR consultancies / payroll bureaus / MSPs provision enterprise
 * workspaces under their own brand and collect a revenue share.
 *
 * Auth model: a user is a reseller admin via `reseller_admins` table.
 * All writes flow through SECURITY DEFINER RPCs.
 */

export interface Reseller {
  id: string;
  name: string;
  slug: string;
  theme_config: {
    brand_primary?: string;
    brand_secondary?: string;
    logo_url?: string;
    company_name?: string;
  };
  custom_domain: string | null;
  stripe_connect_account_id: string | null;
  revenue_share_pct: number;
  is_active: boolean;
}

export interface ResellerUsage {
  ok: boolean;
  total_workspaces: number;
  active_workspaces: number;
  total_members: number;
  workspaces: Array<{
    workspace_id: string;
    name: string;
    is_archived: boolean;
    created_at: string;
    member_count: number;
    tier_key: string | null;
  }>;
}

export function useMyResellers() {
  return useQuery({
    queryKey: ['reseller', 'mine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resellers')
        .select('id, name, slug, theme_config, custom_domain, stripe_connect_account_id, revenue_share_pct, is_active')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Reseller[];
    },
    staleTime: 60 * 1000,
  });
}

export function useResellerUsage(resellerId: string | null | undefined) {
  return useQuery({
    queryKey: ['reseller', 'usage', resellerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reseller_get_usage', {
        _reseller_id: resellerId as string,
      });
      if (error) throw error;
      return data as unknown as ResellerUsage;
    },
    enabled: !!resellerId,
    staleTime: 60 * 1000,
  });
}

export async function provisionWorkspaceUnderReseller(args: {
  resellerId: string;
  name: string;
  description?: string;
  tierKey?: string;
  seats?: number;
}) {
  const { data, error } = await supabase.rpc('reseller_provision_workspace', {
    _reseller_id: args.resellerId,
    _name: args.name,
    _description: args.description ?? null,
    _tier_key: args.tierKey ?? 'pro',
    _seats: args.seats ?? 5,
  });
  if (error) throw error;
  return data as string;
}

export async function updateResellerTheme(resellerId: string, themeConfig: Reseller['theme_config']) {
  const { data, error } = await supabase.rpc('reseller_update_theme', {
    _reseller_id: resellerId,
    _theme_config: themeConfig,
  });
  if (error) throw error;
  return data as { ok: boolean };
}
