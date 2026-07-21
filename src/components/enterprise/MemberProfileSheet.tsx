import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { User, Briefcase, Calendar, AlertTriangle, CheckCircle2, Clock, XCircle, Users, Edit2, Save, MapPin, Building2, Star, FileText, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationPreferences } from './NotificationPreferences';
import { RoleAllocationEditor, Allocation } from './RoleAllocationEditor';
import { MemberSitePriorityEditor } from './MemberSitePriorityEditor';
import { MemberExtendedDetails } from './MemberExtendedDetails';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/I18nProvider';
import { AlertCircle } from 'lucide-react';
import {
  canonicalizeWorkspaceProfileDisplayName,
  isWorkspaceMemberBaseWorkingHoursValid,
  isWorkspaceMemberRoleAllocationSnapshotValid,
  loadWorkspaceMemberProfileEditSnapshot,
  saveWorkspaceMemberProfile,
  WorkspaceMemberProfileError,
  type WorkspaceMemberRoleAllocationInput,
} from '@/lib/workspaceMemberProfileApi';

interface Member {
  id: string;
  user_id: string;
  role: string;
  status: string;
  team: string | null;
  location: string | null;
  business_role: string | null;
  joined_at: string | null;
  display_name?: string;
  city?: string | null;
  office_id?: string | null;
  base_working_hours?: number | null;
  org_unit_id?: string | null;
  manager_id?: string | null;
  contract_type_id?: string | null;
  leadership_level_id?: string | null;
}

interface Office {
  id: string;
  name: string;
  city: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  workspaceId: string;
  currentUserId?: string;
  allMembers: Member[];
  isAdmin?: boolean;
  /** Fail-closed profile edit gate: members edit permission plus members_list entitlement. */
  canEditMember?: boolean;
  onMemberUpdated?: () => void;
  showEmail?: boolean;
  /** Optional callback to switch the workspace top-level tab from the "Bővebb adatok" deep links. */
  onNavigateTab?: (tab: string) => void;
}

type ProfileView = 'basic' | 'extended';

// Workspace-wide allocation row used to compute peers per role
interface PeerAllocation {
  membership_id: string;
  business_role: string;
  percentage: number;
  is_priority: boolean;
}

interface LeaveRequest {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  leave_type: string;
}

interface BusinessRoleReference {
  business_role: string | null;
}

interface TeamReference {
  id: string;
  name: string;
}

interface TeamRoleReference {
  team_id: string;
  business_role: string;
}

interface EditFormState {
  display_name: string;
  location: string;
  city: string;
  office_id: string;
  base_working_hours: number;
}

interface AuthoritativeDraftSnapshot {
  scope: string;
  editForm: EditFormState;
  expectedDisplayName: string | null;
  allocations: readonly Allocation[];
}

interface ProfileQueryResult<T> {
  data: T[] | null;
  error: unknown;
}

interface ProfileQuery<T> extends PromiseLike<ProfileQueryResult<T>> {
  select(columns: string): ProfileQuery<T>;
  eq(column: string, value: unknown): ProfileQuery<T>;
  not(column: string, operator: string, value: unknown): ProfileQuery<T>;
  order(column: string, options?: { ascending?: boolean }): ProfileQuery<T>;
  abortSignal(signal: AbortSignal): ProfileQuery<T>;
}

interface MemberProfileReadClient {
  from<T>(table: string): ProfileQuery<T>;
}

const memberProfileReadClient = supabase as unknown as MemberProfileReadClient;

export function MemberProfileSheet({ open, onOpenChange, member, workspaceId, currentUserId, allMembers, canEditMember = false, onMemberUpdated, showEmail = false, onNavigateTab }: Props) {
  const t = useT();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [readyProfileScope, setReadyProfileScope] = useState<string | null>(null);
  const [failedProfileScope, setFailedProfileScope] = useState<string | null>(null);
  const [failedPeerScope, setFailedPeerScope] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);
  const [loadedProfileRevision, setLoadedProfileRevision] = useState<number | null>(null);
  const authoritativeDraftRef = useRef<AuthoritativeDraftSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictProfileScope, setConflictProfileScope] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const saveGenerationRef = useRef(0);
  const saveAbortControllerRef = useRef<AbortController | null>(null);
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<ProfileView>('basic');
  const [offices, setOffices] = useState<Office[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [businessRoles, setBusinessRoles] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allWorkspaceAllocations, setAllWorkspaceAllocations] = useState<PeerAllocation[]>([]);
  const [teamsData, setTeamsData] = useState<{ id: string; name: string; roles: string[] }[]>([]);
  const [editForm, setEditForm] = useState<EditFormState>({
    display_name: '',
    location: '',
    city: '',
    office_id: '',
    base_working_hours: 8,
  });

  const memberTeamNames = useMemo(() => {
    const allocRoles = new Set(allocations.map(a => a.business_role));
    const matched = teamsData.filter(t => t.roles.some(r => allocRoles.has(r)));
    return matched.map(t => t.name);
  }, [allocations, teamsData]);

  const priorityRole = useMemo(() => {
    return allocations.find(a => a.is_priority)?.business_role || allocations[0]?.business_role || null;
  }, [allocations]);

  const canEditDisplayName = Boolean(
    currentUserId && member?.user_id === currentUserId,
  );
  const profileLoadScope = member && open
    ? `${workspaceId}:${member.id}:${loadAttempt}`
    : null;
  const profileDataReady = profileLoadScope !== null
    && readyProfileScope === profileLoadScope
    && loadedProfileRevision !== null;
  const loadError = profileLoadScope !== null && failedProfileScope === profileLoadScope;
  const peerLoadError = profileLoadScope !== null && failedPeerScope === profileLoadScope;
  const saveConflict = profileLoadScope !== null && conflictProfileScope === profileLoadScope;

  const invalidateSaveScope = useCallback((resetUi: boolean) => {
    saveGenerationRef.current += 1;
    saveAbortControllerRef.current?.abort();
    saveAbortControllerRef.current = null;
    saveInFlightRef.current = false;
    if (resetUi) {
      setSaving(false);
      setSaveError(null);
      setConflictProfileScope(null);
    }
  }, []);

  const roleAllocationSnapshot = useMemo<readonly WorkspaceMemberRoleAllocationInput[]>(
    () => Object.freeze(allocations.map(allocation => Object.freeze({
      businessRole: allocation.business_role,
      percentage: allocation.percentage,
      isPriority: Boolean(allocation.is_priority),
    }))),
    [allocations],
  );
  const isAllocationSnapshotValid = isWorkspaceMemberRoleAllocationSnapshotValid(
    roleAllocationSnapshot,
  );
  const isBaseWorkingHoursValid = isWorkspaceMemberBaseWorkingHoursValid(
    editForm.base_working_hours,
  );
  const normalizedDisplayName = canonicalizeWorkspaceProfileDisplayName(editForm.display_name);
  const expectedDisplayName = authoritativeDraftRef.current?.scope === profileLoadScope
    ? authoritativeDraftRef.current.expectedDisplayName ?? ''
    : '';
  const hasDisplayNameEdit = canEditDisplayName
    && profileDataReady
    && editForm.display_name !== expectedDisplayName;
  const isDisplayNameValid = !hasDisplayNameEdit || normalizedDisplayName !== undefined;

  // Sorted allocations: priority first, then by percentage desc
  const sortedAllocations = useMemo(() => {
    return [...allocations].sort((a, b) => {
      if (a.is_priority && !b.is_priority) return -1;
      if (!a.is_priority && b.is_priority) return 1;
      return b.percentage - a.percentage;
    });
  }, [allocations]);

  // For each role of this member, compute peers (other memberships) who have the same business_role
  const peersByRole = useMemo(() => {
    const result: Record<string, { display_name: string; percentage: number; user_id: string }[]> = {};
    if (!member) return result;
    sortedAllocations.forEach(a => {
      const peers = allWorkspaceAllocations
        .filter(p => p.business_role === a.business_role && p.membership_id !== member.id)
        .map(p => {
          const peerMember = allMembers.find(m => m.id === p.membership_id);
          return peerMember
            ? { display_name: peerMember.display_name || t('member_profile.unknown'), percentage: Number(p.percentage), user_id: peerMember.user_id }
            : null;
        })
        .filter((x): x is { display_name: string; percentage: number; user_id: string } => x !== null)
        .sort((x, y) => y.percentage - x.percentage);
      result[a.business_role] = peers;
    });
    return result;
  }, [sortedAllocations, allWorkspaceAllocations, allMembers, member, t]);

  const approvedLeaves = useMemo(() => leaveRequests.filter(r => r.status === 'approved'), [leaveRequests]);
  const pendingLeaves = useMemo(() => leaveRequests.filter(r => r.status === 'pending' || r.status === 'draft'), [leaveRequests]);
  const rejectedLeaves = useMemo(() => leaveRequests.filter(r => r.status === 'rejected'), [leaveRequests]);
  const pastLeaves = useMemo(() => approvedLeaves.filter(r => new Date(r.end_date) < new Date()), [approvedLeaves]);
  const upcomingLeaves = useMemo(() => approvedLeaves.filter(r => new Date(r.end_date) >= new Date()), [approvedLeaves]);

  const totalApprovedDays = useMemo(() => {
    return approvedLeaves.reduce((sum, r) => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }, 0);
  }, [approvedLeaves]);

  const sickDays = useMemo(() => {
    return leaveRequests
      .filter(r => r.leave_type === 'sick_leave' && r.status === 'approved')
      .reduce((sum, r) => {
        const start = new Date(r.start_date);
        const end = new Date(r.end_date);
        return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }, 0);
  }, [leaveRequests]);

  useLayoutEffect(() => {
    invalidateSaveScope(true);
    if (!open) {
      loadGenerationRef.current += 1;
      setReadyProfileScope(null);
      setLoadedProfileRevision(null);
      authoritativeDraftRef.current = null;
    }
    return () => invalidateSaveScope(false);
  }, [open, workspaceId, member?.id, invalidateSaveScope]);

  useLayoutEffect(() => {
    if (!canEditMember) {
      invalidateSaveScope(true);
      setEditing(false);
    }
  }, [canEditMember, invalidateSaveScope]);

  useEffect(() => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    const controller = new AbortController();
    const isCurrent = () => (
      !controller.signal.aborted
      && loadGenerationRef.current === generation
    );

    setEditing(false);
    setSaveError(null);
    setView('basic');
    setReadyProfileScope(null);
    setFailedProfileScope(null);
    setFailedPeerScope(null);
    setLoadedProfileRevision(null);
    setConflictProfileScope(null);
    authoritativeDraftRef.current = null;
    setLeaveRequests([]);
    setOffices([]);
    setBusinessRoles([]);
    setAllocations([]);
    setAllWorkspaceAllocations([]);
    setTeamsData([]);
    setUserEmail(null);

    if (!member || !open || profileLoadScope === null) {
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setEditForm({
      location: '',
      city: '',
      office_id: '',
      display_name: member.display_name || '',
      base_working_hours: 8,
    });

    const loadProfileData = async () => {
      try {
        const [leaveRes, officeRes, editSnapshot, peerAllocRes, rolesRes, teamsRes, teamRolesRes, authRes] = await Promise.all([
          memberProfileReadClient.from<LeaveRequest>('leave_requests').select('*').eq('workspace_id', workspaceId).eq('user_id', member.user_id).order('start_date', { ascending: false }).abortSignal(controller.signal),
          memberProfileReadClient.from<Office>('enterprise_offices').select('id, name, city').eq('workspace_id', workspaceId).order('name').abortSignal(controller.signal),
          loadWorkspaceMemberProfileEditSnapshot(workspaceId, member.id, { signal: controller.signal }),
          memberProfileReadClient.from<PeerAllocation>('enterprise_member_role_allocations').select('membership_id, business_role, percentage, is_priority').eq('workspace_id', workspaceId).abortSignal(controller.signal),
          memberProfileReadClient.from<BusinessRoleReference>('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId).not('business_role', 'is', null).abortSignal(controller.signal),
          memberProfileReadClient.from<TeamReference>('enterprise_teams').select('id, name').eq('workspace_id', workspaceId).abortSignal(controller.signal),
          memberProfileReadClient.from<TeamRoleReference>('enterprise_team_roles').select('team_id, business_role').eq('workspace_id', workspaceId).abortSignal(controller.signal),
          showEmail
            ? supabase.auth.getUser()
            : Promise.resolve({ data: { user: null }, error: null }),
        ]);

        if (!isCurrent()) return;
        if (
          leaveRes.error
          || officeRes.error
          || rolesRes.error
          || teamsRes.error
          || teamRolesRes.error
          || authRes.error
        ) {
          throw new Error('member-profile-load-failed');
        }

        const allAllocs = peerAllocRes.error
          ? []
          : (peerAllocRes.data || []).map(allocation => ({
            membership_id: allocation.membership_id,
            business_role: allocation.business_role,
            percentage: Number(allocation.percentage),
            is_priority: !!allocation.is_priority,
          }));
        const myAllocs: Allocation[] = editSnapshot.roleAllocations.map(allocation => ({
          business_role: allocation.businessRole,
          percentage: allocation.percentage,
          is_priority: allocation.isPriority,
        }));

        if (myAllocs.length === 0 && editSnapshot.businessRole) {
          myAllocs.push({ business_role: editSnapshot.businessRole, percentage: 100, is_priority: true });
        } else if (myAllocs.length > 0 && !myAllocs.some(allocation => allocation.is_priority)) {
          const legacyPrimaryMatches = editSnapshot.businessRole
            ? myAllocs.filter(allocation => allocation.business_role === editSnapshot.businessRole)
            : [];
          if (legacyPrimaryMatches.length === 1) {
            legacyPrimaryMatches[0].is_priority = true;
          }
        }

        const roleSet = new Set<string>();
        (rolesRes.data || []).forEach(membership => {
          if (membership.business_role) roleSet.add(membership.business_role);
        });
        myAllocs.forEach(allocation => roleSet.add(allocation.business_role));
        allAllocs.forEach(allocation => roleSet.add(allocation.business_role));

        const teamRows = teamsRes.data || [];
        const teamRoleRows = teamRolesRes.data || [];
        const rolesByTeam = new Map<string, string[]>();
        teamRoleRows.forEach(teamRole => {
          const roles = rolesByTeam.get(teamRole.team_id) || [];
          roles.push(teamRole.business_role);
          rolesByTeam.set(teamRole.team_id, roles);
        });
        const authoritativeEditForm: EditFormState = {
          location: editSnapshot.location || '',
          city: editSnapshot.city || '',
          office_id: editSnapshot.officeId || '',
          display_name: canEditDisplayName
            ? editSnapshot.displayName || ''
            : member.display_name || '',
          base_working_hours: editSnapshot.baseWorkingHours,
        };
        const authoritativeAllocations = myAllocs.map(allocation => ({ ...allocation }));

        if (!isCurrent()) return;
        setLeaveRequests(leaveRes.data || []);
        setOffices(officeRes.data || []);
        setAllWorkspaceAllocations(allAllocs);
        setAllocations(myAllocs);
        setEditForm(authoritativeEditForm);
        setLoadedProfileRevision(editSnapshot.profileRevision);
        authoritativeDraftRef.current = {
          scope: profileLoadScope,
          editForm: { ...authoritativeEditForm },
          expectedDisplayName: canEditDisplayName ? editSnapshot.displayName : null,
          allocations: authoritativeAllocations,
        };
        setBusinessRoles(Array.from(roleSet).sort());
        setTeamsData(teamRows.map(team => ({
          id: team.id,
          name: team.name,
          roles: rolesByTeam.get(team.id) || [],
        })));
        setUserEmail(showEmail ? authRes.data?.user?.email || null : null);
        setFailedPeerScope(peerAllocRes.error ? profileLoadScope : null);
        setReadyProfileScope(profileLoadScope);
      } catch {
        if (!isCurrent()) return;
        setLoadedProfileRevision(null);
        authoritativeDraftRef.current = null;
        setFailedProfileScope(profileLoadScope);
      } finally {
        if (isCurrent()) setLoading(false);
      }
    };

    void loadProfileData();
    return () => controller.abort();
  }, [member, open, workspaceId, showEmail, profileLoadScope, canEditDisplayName]);

  const reloadProfileSnapshot = useCallback(() => {
    invalidateSaveScope(true);
    loadGenerationRef.current += 1;
    setEditing(false);
    setReadyProfileScope(null);
    setLoadedProfileRevision(null);
    authoritativeDraftRef.current = null;
    setLoadAttempt(attempt => attempt + 1);
  }, [invalidateSaveScope]);

  const handleCancelEdit = () => {
    const authoritativeDraft = authoritativeDraftRef.current;
    if (authoritativeDraft && authoritativeDraft.scope === profileLoadScope) {
      setEditForm({ ...authoritativeDraft.editForm });
      setAllocations(authoritativeDraft.allocations.map(allocation => ({ ...allocation })));
      setSaveError(null);
      setConflictProfileScope(null);
      setEditing(false);
      return;
    }
    reloadProfileSnapshot();
  };

  const handleSave = async () => {
    if (
      !member
      || !open
      || !canEditMember
      || loading
      || !profileDataReady
      || loadError
      || saveConflict
      || loadedProfileRevision === null
      || saveInFlightRef.current
    ) return;
    const authoritativeDraft = authoritativeDraftRef.current;
    if (!authoritativeDraft || authoritativeDraft.scope !== profileLoadScope) return;
    if (!isBaseWorkingHoursValid) return;
    const hasCurrentDisplayNameEdit = canEditDisplayName
      && editForm.display_name !== (authoritativeDraft.expectedDisplayName ?? '');
    if (hasCurrentDisplayNameEdit && normalizedDisplayName === undefined) return;
    if (!isAllocationSnapshotValid) {
      setSaveError(t('member_profile.allocation_validation_error'));
      return;
    }

    const displayName = hasCurrentDisplayNameEdit
      ? normalizedDisplayName
      : null;
    const payload = Object.freeze({
      workspaceId,
      membershipId: member.id,
      expectedProfileRevision: loadedProfileRevision,
      location: editForm.location.trim() || null,
      city: editForm.city.trim() || null,
      officeId: editForm.office_id || null,
      baseWorkingHours: editForm.base_working_hours,
      roleAllocations: roleAllocationSnapshot,
      displayName,
      expectedDisplayName: displayName === null
        ? null
        : authoritativeDraft.expectedDisplayName,
    });

    saveInFlightRef.current = true;
    const generation = saveGenerationRef.current;
    const controller = new AbortController();
    saveAbortControllerRef.current = controller;
    setSaving(true);
    setSaveError(null);
    try {
      await saveWorkspaceMemberProfile(payload, { signal: controller.signal });
      if (controller.signal.aborted || generation !== saveGenerationRef.current) return;
      toast.success(t('member_profile.save_success'));
      setEditing(false);
      onMemberUpdated?.();
      onOpenChange(false);
    } catch (error) {
      if (controller.signal.aborted || generation !== saveGenerationRef.current) return;
      const conflict = error instanceof WorkspaceMemberProfileError && error.code === 'conflict';
      const message = conflict
        ? t('member_profile.save_conflict')
        : t('member_profile.save_error');
      setConflictProfileScope(conflict ? profileLoadScope : null);
      setSaveError(message);
      toast.error(message);
    } finally {
      if (generation === saveGenerationRef.current && saveAbortControllerRef.current === controller) {
        saveAbortControllerRef.current = null;
        saveInFlightRef.current = false;
        setSaving(false);
      }
    }
  };

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) invalidateSaveScope(true);
    onOpenChange(nextOpen);
  };

  if (!member) return null;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t('members.roles.owner');
      case 'resourceAssistant': return t('members.roles.resource_assistant');
      default: return t('members.roles.member');
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation': return t('leave_request.type_vacation');
      case 'sick_leave': return t('leave_request.type_sick_leave');
      case 'unpaid_leave': return t('leave_request.type_unpaid_leave');
      default: return t('leave_request.type_other');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
      case 'pending': return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'rejected': return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const officeName = offices.find(o => o.id === editForm.office_id)?.name;
  const authoritativeDisplayName = canEditDisplayName
    && profileDataReady
    && authoritativeDraftRef.current?.scope === profileLoadScope
    ? authoritativeDraftRef.current.editForm.display_name
    : member.display_name || '';

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 overflow-x-hidden">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold">{authoritativeDisplayName || t('member_profile.unknown')}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{getRoleLabel(member.role)}</Badge>
                {priorityRole && (
                  <Badge variant="default" className="text-[10px] gap-1">
                    <Star className="h-2.5 w-2.5 fill-current" /> {priorityRole}
                  </Badge>
                )}
              </div>
            </div>
            {canEditMember && !editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSaveError(null);
                  setEditing(true);
                }}
                disabled={loading || !profileDataReady || loadError}
                aria-describedby={loadError ? 'member-profile-load-error' : undefined}
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" /> {t('member_profile.edit_btn')}
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* View toggle: Alapadatok | Bővebb adatok */}
        <div className="px-6 pt-3 pb-2 border-b">
          <div
            role="tablist"
            aria-label={t('member_profile.tab_list_label')}
            className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5"
          >
            <button
              role="tab"
              aria-selected={view === 'basic'}
              type="button"
              onClick={() => setView('basic')}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors",
                view === 'basic'
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5" /> {t('member_profile.tab_basic')}
            </button>
            <button
              role="tab"
              aria-selected={view === 'extended'}
              type="button"
              onClick={() => setView('extended')}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors",
                view === 'extended'
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> {t('member_profile.tab_extended')}
            </button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-170px)] overflow-x-hidden">
          <div className="p-4 space-y-4" hidden={view !== 'basic'}>
            {loading && (
              <p role="status" className="sr-only">{t('common.loading')}</p>
            )}
            {loadError && (
              <div
                id="member-profile-load-error"
                role="alert"
                className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
              >
                <p className="text-xs text-destructive">{t('member_profile.load_error')}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={reloadProfileSnapshot}
                >
                  {t('member_profile.retry_load')}
                </Button>
              </div>
            )}
            {peerLoadError && !loadError && (
              <p role="status" className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                {t('member_profile.peers_load_error')}
              </p>
            )}
            <OrganizationCompletionBanner member={member} />
            {/* Basic Info / Edit */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" /> {t('member_profile.basic_card_title')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2 text-sm">
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">{t('common.name')}</Label>
                      <Input
                        value={editForm.display_name}
                        onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                        placeholder={t('member_profile.name_placeholder')}
                        disabled={!canEditDisplayName}
                        aria-invalid={canEditDisplayName && !isDisplayNameValid}
                        aria-describedby={!canEditDisplayName
                          ? 'member-profile-name-scope'
                          : !isDisplayNameValid
                            ? 'member-profile-name-error'
                            : undefined}
                        className="h-8 text-sm"
                      />
                      {!canEditDisplayName && (
                        <p id="member-profile-name-scope" className="mt-1 text-xs text-muted-foreground">
                          {t('member_profile.name_self_only_hint')}
                        </p>
                      )}
                      {canEditDisplayName && !isDisplayNameValid && (
                        <p id="member-profile-name-error" role="alert" className="mt-1 text-xs text-destructive">
                          {t('profile.display_name_validation_error')}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">{t('member_profile.roles_label')}</Label>
                      <div className="mt-1.5">
                        <RoleAllocationEditor
                          allocations={allocations}
                          onChange={setAllocations}
                          availableRoles={businessRoles}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('member_profile.team_label')}</Label>
                      <p className="text-sm mt-1">{memberTeamNames.length > 0 ? memberTeamNames.join(', ') : <span className="text-muted-foreground italic">{t('member_profile.team_auto_desc')}</span>}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{t('member_profile.office_label')}</Label>
                        <Select value={editForm.office_id || '__none__'} onValueChange={v => setEditForm(f => ({ ...f, office_id: v === '__none__' ? '' : v }))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('member_profile.office_placeholder')} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t('member_profile.office_none')}</SelectItem>
                            {offices.map(o => (
                              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">{t('member_profile.city_label')}</Label>
                        <Input value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} placeholder={t('member_profile.city_placeholder')} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">{t('member_profile.location_note_label')}</Label>
                      <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder={t('member_profile.location_note_placeholder')} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label htmlFor="member-profile-base-working-hours" className="text-xs">{t('member_profile.base_hours_label')}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="member-profile-base-working-hours"
                          type="number"
                          min={0}
                          max={24}
                          step={0.01}
                          value={editForm.base_working_hours}
                          onChange={e => setEditForm(f => ({ ...f, base_working_hours: Math.max(0, Math.min(24, Number(e.target.value) || 0)) }))}
                          aria-invalid={!isBaseWorkingHoursValid}
                          aria-describedby={!isBaseWorkingHoursValid ? 'member-profile-base-working-hours-error' : undefined}
                          className="h-8 text-sm w-24"
                        />
                        <span className="text-xs text-muted-foreground">{t('member_profile.base_hours_helper')}</span>
                      </div>
                      {!isBaseWorkingHoursValid && (
                        <p
                          id="member-profile-base-working-hours-error"
                          role="alert"
                          className="mt-1 text-xs text-destructive"
                        >
                          {t('member_profile.base_hours_validation_error')}
                        </p>
                      )}
                    </div>
                    {!isAllocationSnapshotValid && (
                      <p role="alert" className="text-xs text-destructive">
                        {t('member_profile.allocation_validation_error')}
                      </p>
                    )}
                    {saveConflict && saveError && isAllocationSnapshotValid && (
                      <div
                        id="member-profile-save-error"
                        role="alert"
                        aria-live="assertive"
                        className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
                      >
                        <p className="text-xs text-destructive">{saveError}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={reloadProfileSnapshot}
                        >
                          {t('member_profile.reload_after_conflict')}
                        </Button>
                      </div>
                    )}
                    {saveError && !saveConflict && isAllocationSnapshotValid && (
                      <p id="member-profile-save-error" role="alert" aria-live="assertive" className="text-xs text-destructive">
                        {saveError}
                      </p>
                    )}
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={loading || saving || !profileDataReady || loadError || saveConflict || !isDisplayNameValid || !isBaseWorkingHoursValid || !isAllocationSnapshotValid}
                        aria-busy={saving}
                        aria-describedby={saveError ? 'member-profile-save-error' : undefined}
                      >
                        <Save className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                        {saving ? t('member_profile.save_in_progress') : t('common.save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground shrink-0">{t('member_profile.display_roles_label')}</span>
                      <span className="text-right flex flex-wrap gap-1 justify-end">
                        {sortedAllocations.length === 0 ? '–' : sortedAllocations.map(a => (
                          <Badge
                            key={a.business_role}
                            variant={a.is_priority ? 'default' : 'secondary'}
                            className={cn("text-[10px] gap-1", a.is_priority && "ring-1 ring-primary/40")}
                          >
                            {a.is_priority && <Star className="h-2.5 w-2.5 fill-current" />}
                            {a.business_role} ({a.percentage.toFixed(0)}%)
                          </Badge>
                        ))}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('member_profile.display_team_label')}</span><span>{memberTeamNames.length > 0 ? memberTeamNames.join(', ') : '–'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('member_profile.display_office_label')}</span>
                      <span className="flex items-center gap-1">
                        {officeName ? <><Building2 className="h-3 w-3" />{officeName}</> : '–'}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('member_profile.display_city_label')}</span>
                      <span className="flex items-center gap-1">
                        {editForm.city ? <><MapPin className="h-3 w-3" />{editForm.city}</> : '–'}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('member_profile.display_location_label')}</span><span>{editForm.location || '–'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('member_profile.display_base_hours_label')}</span><span className="font-medium">{editForm.base_working_hours} {t('member_profile.display_hours_unit')}</span></div>
                    {userEmail && (
                      <div className="flex justify-between"><span className="text-muted-foreground">{t('member_profile.display_email_label')}</span><span className="text-sm">{userEmail}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('member_profile.display_joined_label')}</span><span>{member.joined_at ? format(new Date(member.joined_at), 'yyyy. MM. dd.') : '–'}</span></div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Site priorities (Phase II — allowedSites) */}
            <MemberSitePriorityEditor
              workspaceId={workspaceId}
              membershipId={member.id}
              isAdmin={canEditMember}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{totalApprovedDays}</p>
                  <p className="text-[10px] text-muted-foreground">{t('member_profile.kpi_approved')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{pendingLeaves.length}</p>
                  <p className="text-[10px] text-muted-foreground">{t('member_profile.kpi_pending')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{sickDays}</p>
                  <p className="text-[10px] text-muted-foreground">{t('member_profile.kpi_sick')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Same Role Members - per allocation block, priority first */}
            {sortedAllocations.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t('member_profile.peers_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  {sortedAllocations.map(a => {
                    const peers = peersByRole[a.business_role] || [];
                    return (
                      <div key={a.business_role} className={cn("rounded-md p-2", a.is_priority && "bg-primary/5 ring-1 ring-primary/20")}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {a.is_priority && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                            <span className="text-sm font-medium">{a.business_role}</span>
                            <Badge variant="outline" className="text-[9px]">{a.percentage.toFixed(0)}%</Badge>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{peers.length} {t('member_profile.peers_badge')}</Badge>
                        </div>
                        {peers.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">{t('member_profile.peers_empty')}</p>
                        ) : (
                          <div className="space-y-1">
                            {peers.map(p => (
                              <div key={p.user_id + a.business_role} className="flex items-center justify-between text-sm">
                                <span>{p.display_name}</span>
                                <span className="text-xs text-muted-foreground">{p.percentage.toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t('member_profile.conflict_warning')}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Upcoming */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> {t('member_profile.upcoming_title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {loading ? (
                  <div className="flex justify-center py-4"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                ) : upcomingLeaves.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('member_profile.upcoming_empty')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {upcomingLeaves.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <span>{format(new Date(r.start_date), 'MM.dd.')} – {format(new Date(r.end_date), 'MM.dd.')}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{getLeaveTypeLabel(r.leave_type)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending */}
            {pendingLeaves.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" /> {t('member_profile.pending_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {pendingLeaves.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <span>{format(new Date(r.start_date), 'MM.dd.')} – {format(new Date(r.end_date), 'MM.dd.')}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{getLeaveTypeLabel(r.leave_type)}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Past */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" /> {t('member_profile.past_title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {pastLeaves.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('member_profile.past_empty')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {pastLeaves.slice(0, 10).map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <span>{format(new Date(r.start_date), 'MM.dd.')} – {format(new Date(r.end_date), 'MM.dd.')}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{getLeaveTypeLabel(r.leave_type)}</Badge>
                      </div>
                    ))}
                    {pastLeaves.length > 10 && <p className="text-[10px] text-muted-foreground">{t('member_profile.past_more', { count: pastLeaves.length - 10 })}</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rejected */}
            {rejectedLeaves.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" /> {t('member_profile.rejected_title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {rejectedLeaves.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <span>{format(new Date(r.start_date), 'MM.dd.')} – {format(new Date(r.end_date), 'MM.dd.')}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{getLeaveTypeLabel(r.leave_type)}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notification Preferences - only for own profile */}
            {showEmail && (
              <NotificationPreferences workspaceId={workspaceId} userId={member.user_id} />
            )}
          </div>

          <div className="p-4" hidden={view !== 'extended'}>
            <MemberExtendedDetails
              workspaceId={workspaceId}
              member={{ id: member.id, user_id: member.user_id, display_name: authoritativeDisplayName }}
              isAdmin={canEditMember}
              onNavigateTab={onNavigateTab}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// v3.0.0 — Organization metadata completion banner. Visible when one or more
// of the new soft-required fields (manager, org_unit, contract_type,
// leadership_level) are missing on the membership row. Non-blocking, advisory.
function OrganizationCompletionBanner({ member }: { member: Member }) {
  const t = useT();
  const missing: string[] = [];
  if (!member?.org_unit_id) missing.push(t("member.org_unit"));
  if (!member?.manager_id) missing.push(t("member.manager"));
  if (!member?.contract_type_id) missing.push(t("member.contract_type"));
  if (!member?.leadership_level_id) missing.push(t("member.leadership_level"));
  if (missing.length === 0) return null;
  return (
    <div className="flex gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="text-xs">
        <div className="font-semibold text-amber-900 dark:text-amber-200">
          {t("member.completion_banner_title")}
        </div>
        <p className="mt-0.5 text-amber-900/80 dark:text-amber-100/80 leading-relaxed">
          {t("member.completion_banner_body")}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {missing.map((m) => (
            <span
              key={m}
              className="inline-flex items-center rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-900 dark:text-amber-100"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
