import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Plugin marketplace hooks (Top-20 Rank 19, v3.30.0).
 *
 * MVP: browse published plugins, install per-workspace, manage config.
 * Sandboxed runtime + plugin SDK npm package deferred to v3.30.1+.
 */

export interface MarketplacePlugin {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string | null;
  icon_url: string | null;
  category: 'integration' | 'analytics' | 'compliance' | 'vertical' | 'automation' | 'other';
  author_name: string | null;
  manifest: Record<string, unknown>;
  status: 'pending' | 'approved' | 'published' | 'rejected' | 'archived';
  install_count: number;
  pricing_model: 'free' | 'one_time' | 'subscription' | 'revenue_share';
}

export interface WorkspaceInstalledPlugin {
  id: string;
  workspace_id: string;
  plugin_id: string;
  enabled: boolean;
  installed_at: string;
}

export type PluginMarketplaceApiErrorCode = 'retryable-conflict' | 'request-failed';

export class PluginMarketplaceMutationError extends Error {
  readonly code: PluginMarketplaceApiErrorCode;

  constructor(code: PluginMarketplaceApiErrorCode) {
    super('Plugin marketplace mutation failed');
    this.name = 'PluginMarketplaceMutationError';
    this.code = code;
  }
}

const RETRYABLE_CONFLICT_CODES = new Set(['40001', '40P01', '55P03']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getStructuralErrorCode(error: unknown): unknown {
  try {
    if (!isPlainRecord(error)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function toPluginMarketplaceMutationError(error: unknown): PluginMarketplaceMutationError {
  const backendCode = getStructuralErrorCode(error);
  const code = typeof backendCode === 'string' && RETRYABLE_CONFLICT_CODES.has(backendCode)
    ? 'retryable-conflict'
    : 'request-failed';
  return new PluginMarketplaceMutationError(code);
}

export function useMarketplacePlugins() {
  return useQuery({
    queryKey: ['marketplace', 'plugins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_plugins')
        .select('id, slug, name, version, description, icon_url, category, author_name, manifest, status, install_count, pricing_model')
        .order('install_count', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketplacePlugin[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInstalledPlugins(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['marketplace', 'installed', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_installed_plugins')
        .select('id, workspace_id, plugin_id, enabled, installed_at')
        .eq('workspace_id', workspaceId as string)
        .order('installed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkspaceInstalledPlugin[];
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export async function submitPlugin(args: {
  slug: string; name: string; description: string;
  category: MarketplacePlugin['category'];
  manifest: Record<string, unknown>;
  iconUrl?: string;
  pricing?: MarketplacePlugin['pricing_model'];
}) {
  const { data, error } = await supabase.rpc('marketplace_submit_plugin', {
    _slug: args.slug, _name: args.name, _description: args.description,
    _category: args.category, _manifest: args.manifest as never,
    _icon_url: args.iconUrl ?? null, _pricing: args.pricing ?? 'free',
  });
  if (error) throw error;
  return data as string;
}

export async function installPlugin(workspaceId: string, pluginId: string, config: Record<string, unknown> = {}) {
  let data: unknown;
  let rpcError: unknown;
  try {
    const response = await supabase.rpc('marketplace_install_plugin', {
      _workspace_id: workspaceId, _plugin_id: pluginId, _config: config as never,
    });
    data = response.data;
    rpcError = response.error;
  } catch (error) {
    throw toPluginMarketplaceMutationError(error);
  }
  if (rpcError) throw toPluginMarketplaceMutationError(rpcError);
  return data as string;
}

export async function uninstallPlugin(installedId: string) {
  let data: unknown;
  let rpcError: unknown;
  try {
    const response = await supabase.rpc('marketplace_uninstall_plugin', {
      _installed_id: installedId,
    });
    data = response.data;
    rpcError = response.error;
  } catch (error) {
    throw toPluginMarketplaceMutationError(error);
  }
  if (rpcError) throw toPluginMarketplaceMutationError(rpcError);
  return data as { ok: boolean };
}
