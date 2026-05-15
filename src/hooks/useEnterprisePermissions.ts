import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AccessLevel = 'none' | 'readonly' | 'edit';

export interface RoleDefinition {
  id: string;
  workspace_id: string;
  role_key: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  sort_order: number;
}

export interface RolePermission {
  id: string;
  workspace_id: string;
  role_key: string;
  feature_key: string;
  access_level: AccessLevel;
}

export interface FeatureNode {
  feature_key: string;
  display_name: string;
  parent_key: string | null;
  sort_order: number;
  children: FeatureNode[];
}

// Fallback flat list (legacy) — used only if dynamic catalog fails to load.
export interface FeatureGroup {
  label: string;
  children: { key: string; label: string }[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: 'Calendar view',
    children: [
      { key: 'calendar', label: 'Calendar' },
      { key: 'calendar_leave_days', label: 'View leave days' },
      { key: 'calendar_coverage', label: 'Coverage & conflicts' },
      { key: 'calendar_requests', label: 'Leave requests' },
      { key: 'calendar_conflicts', label: 'Conflicts' },
    ],
  },
  {
    label: 'Requests',
    children: [
      { key: 'requests_own', label: 'Own requests' },
      { key: 'requests_team', label: "Team members' requests" },
      { key: 'leave_requests_submit', label: 'Submit leave request' },
    ],
  },
];

export const STANDALONE_FEATURES: { key: string; label: string }[] = [
  { key: 'approvals', label: 'Approvals' },
  { key: 'members', label: 'Members' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'rules', label: 'Rules' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'reports', label: 'Reports' },
  { key: 'audit', label: 'Audit log' },
  { key: 'export', label: 'Export' },
  { key: 'settings', label: 'Settings' },
  { key: 'permission_config', label: 'Permission configuration' },
  { key: 'layout_setting', label: 'Layout Setting' },
  { key: 'admin_override', label: 'Admin override' },
  { key: 'resources', label: 'Resources' },
  { key: 'resources_dashboard', label: 'Resource overview' },
  { key: 'resources_projects', label: 'Projects' },
  { key: 'resources_timeline', label: 'Timeline' },
  { key: 'resources_gaps', label: 'Capacity gaps' },
  { key: 'resources_positions', label: 'Positions' },
  { key: 'resources_teams', label: 'Teams' },
];

export const FEATURE_LABELS: Record<string, string> = {};
FEATURE_GROUPS.forEach(g => g.children.forEach(c => { FEATURE_LABELS[c.key] = c.label; }));
STANDALONE_FEATURES.forEach(f => { FEATURE_LABELS[f.key] = f.label; });

export const FEATURE_KEYS = Object.keys(FEATURE_LABELS);

function buildTree(rows: { feature_key: string; display_name: string; parent_key: string | null; sort_order: number }[]): FeatureNode[] {
  const byKey = new Map<string, FeatureNode>();
  rows.forEach(r => byKey.set(r.feature_key, { ...r, children: [] }));
  const roots: FeatureNode[] = [];
  byKey.forEach(node => {
    if (node.parent_key && byKey.has(node.parent_key)) {
      byKey.get(node.parent_key)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr: FeatureNode[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name));
    arr.forEach(n => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export function useEnterprisePermissions(workspaceId: string, userRoleKey?: string) {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [featureTree, setFeatureTree] = useState<FeatureNode[]>([]);
  const [hiddenByTier, setHiddenByTier] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    // v3.33.0 — Use workspace_permission_catalog RPC which returns the same
    // shape as enterprise_feature_catalog PLUS a `visible` flag that filters
    // each permission slot against the workspace's active tier_features.
    // Slots whose mapped tier_feature_keys are NOT in the tier are hidden
    // (visible=false); admin/system slots (empty tier_feature_keys[]) are
    // always visible.
    const [rdRes, rpRes, catalogRes] = await Promise.all([
      supabase.from('enterprise_role_definitions').select('*').eq('workspace_id', workspaceId).order('sort_order'),
      supabase.from('enterprise_role_permissions').select('*').eq('workspace_id', workspaceId),
      (supabase as any).rpc('workspace_permission_catalog', { _workspace_id: workspaceId }),
    ]);
    // Per LESSON-CAPACITY-ERROR-001: never swallow Supabase errors from
    // parallel calls. Log them so failures are operationally visible.
    if (rdRes.error) console.error('[useEnterprisePermissions] role_definitions', rdRes.error);
    if (rpRes.error) console.error('[useEnterprisePermissions] role_permissions', rpRes.error);
    setRoles((rdRes.data as any[]) || []);
    setPermissions((rpRes.data as any[]) || []);
    const allCatalog = (catalogRes.data as any[]) || [];
    const visibleCatalog = allCatalog.filter((r) => r.visible !== false);
    setHiddenByTier(allCatalog.length - visibleCatalog.length);
    // v3.33.1 — Fall back to the legacy enterprise_feature_catalog SELECT
    // ONLY when the RPC errored (e.g. older workspaces where the RPC
    // doesn't yet exist). A successful RPC that returns an empty array
    // is a legitimate "all slots hidden by tier" state and MUST NOT trip
    // the fallback, otherwise tier filtering is silently defeated
    // (B-3 / LESSON-RPC-091).
    if (catalogRes.error) {
      console.warn('[useEnterprisePermissions] permission_catalog RPC error, falling back', catalogRes.error);
      const fallback = await (supabase as any)
        .from('enterprise_feature_catalog')
        .select('feature_key, display_name, parent_key, sort_order');
      setFeatureTree((fallback.data as any[])?.length > 0 ? buildTree(fallback.data as any[]) : []);
    } else {
      setFeatureTree(buildTree(visibleCatalog));
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const getAccess = useCallback((roleKey: string, featureKey: string): AccessLevel => {
    const p = permissions.find(p => p.role_key === roleKey && p.feature_key === featureKey);
    return (p?.access_level as AccessLevel) || 'none';
  }, [permissions]);

  const hasAccess = useCallback((featureKey: string, minLevel: 'readonly' | 'edit' = 'readonly'): boolean => {
    if (!userRoleKey) return false;
    if (userRoleKey === 'owner') return true;
    const level = getAccess(userRoleKey, featureKey);
    if (minLevel === 'readonly') return level === 'readonly' || level === 'edit';
    return level === 'edit';
  }, [userRoleKey, getAccess]);

  const canEdit = useCallback((featureKey: string): boolean => hasAccess(featureKey, 'edit'), [hasAccess]);
  const canView = useCallback((featureKey: string): boolean => hasAccess(featureKey, 'readonly'), [hasAccess]);

  return { roles, permissions, featureTree, hiddenByTier, loading, refetch: fetch, getAccess, hasAccess, canEdit, canView };
}
