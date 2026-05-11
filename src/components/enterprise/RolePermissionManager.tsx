import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Shield, Plus, Trash2, Lock, Eye, Pencil, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  useEnterprisePermissions,
  FEATURE_GROUPS,
  STANDALONE_FEATURES,
  FEATURE_KEYS,
  type AccessLevel,
  type RoleDefinition,
  type FeatureNode,
} from '@/hooks/useEnterprisePermissions';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userRole: string;
}

const ACCESS_ICONS: Record<AccessLevel, React.ReactNode> = {
  none: <Lock className="h-3.5 w-3.5 text-muted-foreground" />,
  readonly: <Eye className="h-3.5 w-3.5 text-blue-500" />,
  edit: <Pencil className="h-3.5 w-3.5 text-green-500" />,
};

export function RolePermissionManager({ workspaceId, userRole }: Props) {
  const { t } = useI18n();
  const { roles, permissions, featureTree, loading, refetch, getAccess } = useEnterprisePermissions(workspaceId);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [deletingRole, setDeletingRole] = useState<RoleDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isOwner = userRole === 'owner';
  const canManage = isOwner || userRole === 'resourceAssistant';

  const accessLabels: Record<AccessLevel, string> = {
    none: t('role_permission_mgr.perm_none'),
    readonly: t('role_permission_mgr.perm_readonly'),
    edit: t('role_permission_mgr.perm_edit'),
  };

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  };

  const handleAddRole = async () => {
    const key = newRoleKey.trim().toLowerCase().replace(/\s+/g, '_') || newRoleName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!newRoleName.trim() || !key) return;

    if (roles.some(r => r.role_key === key)) {
      toast.error(t('role_permission_mgr.role_exists'));
      return;
    }

    const maxSort = Math.max(0, ...roles.map(r => r.sort_order));

    const { error } = await supabase.from('enterprise_role_definitions').insert({
      workspace_id: workspaceId,
      role_key: key,
      display_name: newRoleName.trim(),
      description: newRoleDesc.trim() || null,
      is_system: false,
      sort_order: maxSort + 1,
    } as any);

    if (error) {
      toast.error(t('role_permission_mgr.create_failed'));
      return;
    }

    const defaultPerms = FEATURE_KEYS.map(fk => ({
      workspace_id: workspaceId,
      role_key: key,
      feature_key: fk,
      access_level: fk === 'leave_requests_submit' ? 'edit' :
                    ['calendar', 'calendar_leave_days', 'requests_own', 'members', 'notifications'].includes(fk) ? 'readonly' : 'none',
    }));

    await supabase.from('enterprise_role_permissions').insert(defaultPerms as any[]);

    toast.success(t('role_permission_mgr.created'));
    setNewRoleName('');
    setNewRoleKey('');
    setNewRoleDesc('');
    setShowAddRole(false);
    refetch();
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    await supabase.from('enterprise_role_permissions').delete().eq('workspace_id', workspaceId).eq('role_key', deletingRole.role_key);
    await supabase.from('enterprise_role_definitions').delete().eq('id', deletingRole.id);
    toast.success(t('role_permission_mgr.deleted'));
    setDeletingRole(null);
    if (selectedRole === deletingRole.role_key) setSelectedRole(null);
    refetch();
  };

  const handlePermissionChange = async (roleKey: string, featureKey: string, newLevel: AccessLevel) => {
    setSaving(true);
    const existing = permissions.find(p => p.role_key === roleKey && p.feature_key === featureKey);
    if (existing) {
      await supabase.from('enterprise_role_permissions').update({ access_level: newLevel } as any).eq('id', existing.id);
    } else {
      await supabase.from('enterprise_role_permissions').insert({
        workspace_id: workspaceId,
        role_key: roleKey,
        feature_key: featureKey,
        access_level: newLevel,
      } as any);
    }
    await refetch();
    setSaving(false);
  };

  const renderPermissionRow = (featureKey: string, featureLabel: string, roleKey: string, isOwnerRole: boolean, indent = false) => {
    const level = getAccess(roleKey, featureKey);
    return (
      <div key={featureKey} className={`flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/30 ${indent ? 'pl-6' : ''}`}>
        <div className="flex items-center gap-2">
          {ACCESS_ICONS[level]}
          <span className="text-sm">{featureLabel}</span>
        </div>
        {isOwnerRole ? (
          <Badge variant="default" className="text-[10px]">{t('role_permission_mgr.full_access_badge')}</Badge>
        ) : canManage ? (
          <Select
            value={level}
            onValueChange={(val) => handlePermissionChange(roleKey, featureKey, val as AccessLevel)}
            disabled={saving}
          >
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{accessLabels.none}</SelectItem>
              <SelectItem value="readonly">{accessLabels.readonly}</SelectItem>
              <SelectItem value="edit">{accessLabels.edit}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="text-[10px]">{accessLabels[level]}</Badge>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const activeRole = roles.find(r => r.role_key === selectedRole);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          {roles.map(role => (
            <div
              key={role.id}
              className={`flex items-center justify-between rounded-md border p-2.5 cursor-pointer transition-colors ${
                selectedRole === role.role_key ? 'border-primary bg-primary/5' : 'hover:bg-accent/30'
              }`}
              onClick={() => setSelectedRole(selectedRole === role.role_key ? null : role.role_key)}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{role.display_name}</span>
                {role.is_system && <Badge variant="outline" className="text-[9px] h-4">{t('role_permission_mgr.system_badge')}</Badge>}
                {role.description && <span className="text-xs text-muted-foreground hidden sm:inline">— {role.description}</span>}
              </div>
              <div className="flex items-center gap-1">
                {!role.is_system && canManage && (
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); setDeletingRole(role); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {canManage && !showAddRole && (
          <Button variant="outline" size="sm" onClick={() => setShowAddRole(true)} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" />
          </Button>
        )}

        {showAddRole && (
          <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium">{t('role_permission_mgr.new_role_heading')}</p>
            <Input
              value={newRoleName}
              onChange={e => {
                setNewRoleName(e.target.value);
                if (!newRoleKey) setNewRoleKey(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
              }}
              className="h-8 text-sm"
            />
            <Input
              value={newRoleKey}
              onChange={e => setNewRoleKey(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
              className="h-8 text-sm"
            />
            <Textarea
              value={newRoleDesc}
              onChange={e => setNewRoleDesc(e.target.value)}
              className="text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddRole} disabled={!newRoleName.trim()}>{t('role_permission_mgr.btn_create')}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddRole(false); setNewRoleName(''); setNewRoleKey(''); setNewRoleDesc(''); }}>{t('role_permission_mgr.btn_cancel')}</Button>
            </div>
          </div>
        )}

        {activeRole && (
          <div className="border rounded-md p-3 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{activeRole.display_name}</span>
              {activeRole.is_system && <Badge variant="outline" className="text-[9px]">{t('role_permission_mgr.system_badge')}</Badge>}
            </div>

            <div className="space-y-1">
              {featureTree.length > 0 ? (
                featureTree.map(node => (
                  <FeatureTreeRow
                    key={node.feature_key}
                    node={node}
                    depth={0}
                    roleKey={activeRole.role_key}
                    isOwnerRole={activeRole.role_key === 'owner'}
                    openGroups={openGroups}
                    toggleGroup={toggleGroup}
                    renderRow={renderPermissionRow}
                  />
                ))
              ) : (
                <>
                  {FEATURE_GROUPS.map(group => {
                    const isOpen = !!openGroups[group.label];
                    return (
                      <Collapsible key={group.label} open={isOpen} onOpenChange={() => toggleGroup(group.label)}>
                        <CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent/30 cursor-pointer">
                          <span className="text-sm font-medium">{group.label}</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-0.5 mt-0.5">
                          {group.children.map(child =>
                            renderPermissionRow(child.key, child.label, activeRole.role_key, activeRole.role_key === 'owner', true)
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                  {STANDALONE_FEATURES.map(f =>
                    renderPermissionRow(f.key, f.label, activeRole.role_key, activeRole.role_key === 'owner')
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <AlertDialog open={!!deletingRole} onOpenChange={open => !open && setDeletingRole(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('role_permission_mgr.delete_dialog_title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {deletingRole?.display_name}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('role_permission_mgr.btn_cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteRole}>{t('role_permission_mgr.btn_delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

interface FeatureTreeRowProps {
  node: FeatureNode;
  depth: number;
  roleKey: string;
  isOwnerRole: boolean;
  openGroups: Record<string, boolean>;
  toggleGroup: (key: string) => void;
  renderRow: (
    featureKey: string,
    featureLabel: string,
    roleKey: string,
    isOwnerRole: boolean,
    indent?: boolean,
  ) => React.ReactNode;
}

function FeatureTreeRow({ node, depth, roleKey, isOwnerRole, openGroups, toggleGroup, renderRow }: FeatureTreeRowProps) {
  const hasChildren = node.children.length > 0;
  const groupId = `tree:${node.feature_key}`;
  const isOpen = !!openGroups[groupId];
  const indentStyle = { paddingLeft: `${depth * 12}px` };

  if (!hasChildren) {
    return (
      <div style={indentStyle}>
        {renderRow(node.feature_key, node.display_name, roleKey, isOwnerRole, depth > 0)}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={() => toggleGroup(groupId)}>
      <div style={indentStyle} className="flex items-center justify-between gap-2">
        <CollapsibleTrigger className="flex-1 flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent/30 cursor-pointer">
          <span className="text-sm font-medium">{node.display_name}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <div className="pr-2">
          {renderRow(node.feature_key, '', roleKey, isOwnerRole, false)}
        </div>
      </div>
      <CollapsibleContent className="space-y-0.5 mt-0.5">
        {node.children.map(child => (
          <FeatureTreeRow
            key={child.feature_key}
            node={child}
            depth={depth + 1}
            roleKey={roleKey}
            isOwnerRole={isOwnerRole}
            openGroups={openGroups}
            toggleGroup={toggleGroup}
            renderRow={renderRow}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
