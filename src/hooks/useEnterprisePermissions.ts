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
    label: 'Naptár nézet',
    children: [
      { key: 'calendar', label: 'Naptár' },
      { key: 'calendar_leave_days', label: 'Szabadságnapok megtekintése' },
      { key: 'calendar_coverage', label: 'Lefedettség és konfliktusok' },
      { key: 'calendar_requests', label: 'Szabadságkérelmek' },
      { key: 'calendar_conflicts', label: 'Konfliktusok' },
    ],
  },
  {
    label: 'Kérelmek',
    children: [
      { key: 'requests_own', label: 'Saját kérelmek' },
      { key: 'requests_team', label: 'Csapattagok kérelmei' },
      { key: 'leave_requests_submit', label: 'Szabadságkérelem feladás' },
    ],
  },
];

export const STANDALONE_FEATURES: { key: string; label: string }[] = [
  { key: 'approvals', label: 'Jóváhagyások' },
  { key: 'members', label: 'Tagok' },
  { key: 'invitations', label: 'Meghívók' },
  { key: 'rules', label: 'Szabályok' },
  { key: 'notifications', label: 'Értesítések' },
  { key: 'reports', label: 'Riportok' },
  { key: 'audit', label: 'Audit napló' },
  { key: 'export', label: 'Export' },
  { key: 'settings', label: 'Beállítások' },
  { key: 'admin_override', label: 'Admin felülbírálás' },
  { key: 'resources', label: 'Erőforrások' },
  { key: 'resources_dashboard', label: 'Erőforrás áttekintés' },
  { key: 'resources_projects', label: 'Projektek' },
  { key: 'resources_timeline', label: 'Idővonal' },
  { key: 'resources_gaps', label: 'Kapacitás-hiány' },
  { key: 'resources_positions', label: 'Pozíciók' },
  { key: 'resources_teams', label: 'Csapatok' },
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
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [{ data: rd }, { data: rp }, catalogRes] = await Promise.all([
      supabase.from('enterprise_role_definitions').select('*').eq('workspace_id', workspaceId).order('sort_order'),
      supabase.from('enterprise_role_permissions').select('*').eq('workspace_id', workspaceId),
      (supabase as any).from('enterprise_feature_catalog').select('feature_key, display_name, parent_key, sort_order'),
    ]);
    setRoles((rd as any[]) || []);
    setPermissions((rp as any[]) || []);
    const catalogRows = (catalogRes.data as any[]) || [];
    setFeatureTree(catalogRows.length > 0 ? buildTree(catalogRows) : []);
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

  return { roles, permissions, featureTree, loading, refetch: fetch, getAccess, hasAccess, canEdit, canView };
}
