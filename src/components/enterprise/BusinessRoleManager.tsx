import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Briefcase, UserPlus, Star, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PositionPickerDialog, type PositionPickerResult } from './positions/PositionPickerDialog';
import { useI18n } from '@/i18n/I18nProvider';
import {
  mutateWorkspaceMemberBusinessRole,
  WorkspaceBusinessRoleDraftError,
} from '@/lib/businessRoleAllocationApi';
import {
  WorkspaceMemberProfileError,
  WorkspaceMemberProfileReadError,
} from '@/lib/workspaceMemberProfileApi';
import {
  deleteWorkspaceBusinessRole,
  WorkspaceBusinessRoleDeleteError,
} from '@/lib/workspaceBusinessRoleApi';

interface Props {
  workspaceId: string;
  canEditMemberProfiles: boolean;
}

interface AllocationRow {
  id: string;
  membership_id: string;
  business_role: string;
  percentage: number;
  is_priority: boolean;
}

interface MemberRow {
  id: string;
  user_id: string;
  display_name: string;
  business_role: string | null;
  base_working_hours: number;
}

interface PositionGroup {
  name: string;
  members: {
    membership_id: string;
    user_id: string;
    display_name: string;
    percentage: number;
    is_priority: boolean;
    base_working_hours: number;
    hours_per_day: number;
  }[];
  totalPercentage: number;
  totalHours: number;
}

interface MutationResult<Result> {
  value: Result | null;
  failure: unknown | null;
  stale: boolean;
  generation: number;
}

export function BusinessRoleManager({ workspaceId, canEditMemberProfiles }: Props) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<PositionGroup[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState('');
  const [assignDialog, setAssignDialog] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [assignPercentage, setAssignPercentage] = useState<number>(100);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const loadGenerationRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const mutationGenerationRef = useRef(0);
  const mutationAbortRef = useRef<AbortController | null>(null);
  const mutationInFlightRef = useRef(false);

  const fetchData = useCallback(async () => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const isCurrent = () => (
      !controller.signal.aborted
      && loadGenerationRef.current === generation
    );

    setLoading(true);
    setLoadError(false);
    try {
      const [memberResponse, allocationResponse] = await Promise.all([
        supabase
          .from('enterprise_memberships')
          .select('id, user_id, business_role, base_working_hours')
          .eq('workspace_id', workspaceId)
          .in('status', ['active', 'invited'])
          .abortSignal(controller.signal),
        supabase
          .from('enterprise_member_role_allocations')
          .select('id, membership_id, business_role, percentage, is_priority')
          .eq('workspace_id', workspaceId)
          .abortSignal(controller.signal),
      ]);
      if (memberResponse.error || allocationResponse.error) {
        throw new Error('business-role-load-failed');
      }

      const membersList: MemberRow[] = (memberResponse.data as MemberRow[] | null) || [];
      if (membersList.length > 0) {
        const userIds = membersList.map((member) => member.user_id);
        const profileResponse = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds)
          .abortSignal(controller.signal);
        if (profileResponse.error) throw new Error('business-role-profile-load-failed');
        const profileMap = new Map(
          ((profileResponse.data as Array<{ user_id: string; display_name: string | null }> | null) || [])
            .map((profile) => [profile.user_id, profile.display_name]),
        );
        membersList.forEach((member) => {
          member.display_name = profileMap.get(member.user_id) || t('approval_inbox.unknown');
        });
      }

      const memberById = new Map(membersList.map((member) => [member.id, member]));
      const allAllocs: AllocationRow[] = (
        (allocationResponse.data as AllocationRow[] | null) || []
      ).map((allocation) => ({
        id: allocation.id,
        membership_id: allocation.membership_id,
        business_role: allocation.business_role,
        percentage: Number(allocation.percentage),
        is_priority: !!allocation.is_priority,
      }));
      const groupMap = new Map<string, PositionGroup>();
      allAllocs.forEach((allocation) => {
        const group = groupMap.get(allocation.business_role) || {
          name: allocation.business_role,
          members: [],
          totalPercentage: 0,
          totalHours: 0,
        };
        // The tenant-wide delete RPC deliberately includes suspended/removed
        // memberships. Keep a role discoverable even when every allocation is
        // currently outside the active/invited member directory; member PII and
        // capacity totals remain hidden until that membership is in scope.
        const member = memberById.get(allocation.membership_id);
        if (!member) {
          groupMap.set(allocation.business_role, group);
          return;
        }
        const baseHours = Number(member.base_working_hours ?? 8);
        const hoursPerDay = baseHours * (allocation.percentage / 100);
        group.members.push({
          membership_id: allocation.membership_id,
          user_id: member.user_id,
          display_name: member.display_name,
          percentage: allocation.percentage,
          is_priority: allocation.is_priority,
          base_working_hours: baseHours,
          hours_per_day: hoursPerDay,
        });
        group.totalPercentage += allocation.percentage;
        group.totalHours += hoursPerDay;
        groupMap.set(allocation.business_role, group);
      });

      membersList.forEach((member) => {
        if (
          member.business_role
          && !allAllocs.some((allocation) => (
            allocation.membership_id === member.id
            && allocation.business_role === member.business_role
          ))
        ) {
          const group = groupMap.get(member.business_role) || {
            name: member.business_role,
            members: [],
            totalPercentage: 0,
            totalHours: 0,
          };
          groupMap.set(member.business_role, group);
        }
      });

      const nextGroups = Array.from(groupMap.values())
        .sort((left, right) => left.name.localeCompare(right.name));
      nextGroups.forEach((group) => group.members.sort((left, right) => (
        (right.is_priority ? 1 : 0) - (left.is_priority ? 1 : 0)
        || right.percentage - left.percentage
      )));
      if (!isCurrent()) return;
      setMembers(membersList);
      setGroups(nextGroups);
    } catch {
      if (!isCurrent()) return;
      setMembers([]);
      setGroups([]);
      setLoadError(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [t, workspaceId]);

  useEffect(() => {
    void fetchData();
    return () => {
      loadGenerationRef.current += 1;
      loadAbortRef.current?.abort();
    };
  }, [fetchData]);

  useEffect(() => {
    // The previous workspace cleanup invalidates and aborts its mutation. Reset
    // the rendered guard as the new workspace becomes active so an unresolved
    // transport promise cannot leave every mutation control permanently busy.
    mutationInFlightRef.current = false;
    setMutationBusy(false);

    return () => {
      mutationGenerationRef.current += 1;
      const controller = mutationAbortRef.current;
      mutationAbortRef.current = null;
      mutationInFlightRef.current = false;
      controller?.abort();
    };
  }, [workspaceId]);

  const handleCreateRole = async () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    if (groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(t('business_role_mgr.already_exists'));
      return;
    }
    setGroups((prev) => [...prev, { name: trimmed, members: [], totalPercentage: 0, totalHours: 0 }]);
    setNewRoleName('');
    toast.success(t('business_role_mgr.created_with_hint', { name: trimmed }));
  };

  const handlePickerResult = (result: PositionPickerResult) => {
    const label = result.positionLabel.trim();
    if (!label) return;
    if (groups.some((g) => g.name.toLowerCase() === label.toLowerCase())) {
      toast.message(t('business_role_mgr.catalog_already_exists', { name: label }));
      return;
    }
    setGroups((prev) => [...prev, { name: label, members: [], totalPercentage: 0, totalHours: 0 }]);
    toast.success(t('business_role_mgr.added_from_catalog', { name: label }));
  };

  const mutationErrorMessage = (error: unknown) => {
    if (
      (error instanceof WorkspaceMemberProfileError && error.code === 'conflict')
      || (error instanceof WorkspaceBusinessRoleDeleteError && error.code === 'conflict')
    ) {
      return t('business_role_mgr.save_conflict');
    }
    if (
      error instanceof WorkspaceBusinessRoleDraftError
      || (error instanceof WorkspaceMemberProfileError && error.code === 'invalid-input')
    ) {
      return t('business_role_mgr.allocation_invalid');
    }
    if (
      error instanceof WorkspaceMemberProfileReadError
      || error instanceof WorkspaceMemberProfileError
    ) {
      return t('business_role_mgr.save_failed');
    }
    return t('business_role_mgr.save_failed');
  };

  const runMutation = async <Result,>(
    operation: (signal: AbortSignal) => Promise<Result>,
  ): Promise<MutationResult<Result>> => {
    if (
      !canEditMemberProfiles
      || mutationInFlightRef.current
    ) {
      return {
        value: null,
        failure: new Error('mutation-not-started'),
        stale: true,
        generation: mutationGenerationRef.current,
      };
    }

    mutationInFlightRef.current = true;
    setMutationBusy(true);
    const generation = mutationGenerationRef.current + 1;
    mutationGenerationRef.current = generation;
    mutationAbortRef.current?.abort();
    const controller = new AbortController();
    mutationAbortRef.current = controller;
    let value: Result | null = null;
    let failure: unknown | null = null;

    try {
      value = await operation(controller.signal);
    } catch (error) {
      failure = error;
    } finally {
      if (
        mutationGenerationRef.current === generation
        && mutationAbortRef.current === controller
      ) {
        mutationAbortRef.current = null;
        mutationInFlightRef.current = false;
        setMutationBusy(false);
      }
    }

    if (
      controller.signal.aborted
      || mutationGenerationRef.current !== generation
    ) {
      return {
        value: null,
        failure: failure ?? new WorkspaceMemberProfileError('aborted'),
        stale: true,
        generation,
      };
    }
    return { value, failure, stale: false, generation };
  };

  const handleAssignMember = async () => {
    if (
      !canEditMemberProfiles
      || !selectedMemberId
      || !assignDialog
      || mutationInFlightRef.current
    ) return;
    const result = await runMutation(signal => mutateWorkspaceMemberBusinessRole({
      workspaceId,
      membershipId: selectedMemberId,
      mutation: {
        type: 'assign',
        role: assignDialog,
        percentage: Math.max(1, Math.min(100, assignPercentage)),
      },
    }, { signal }));
    if (result.stale) return;
    await fetchData();
    if (mutationGenerationRef.current !== result.generation) return;
    if (result.failure) {
      toast.error(mutationErrorMessage(result.failure));
      return;
    }
    toast.success(t('business_role_mgr.member_assigned'));
    setAssignDialog(null);
    setSelectedMemberId('');
    setAssignPercentage(100);
  };

  const handleRemoveAllocation = async (membershipId: string, role: string) => {
    if (!canEditMemberProfiles || mutationInFlightRef.current) return;
    const result = await runMutation(signal => mutateWorkspaceMemberBusinessRole({
      workspaceId,
      membershipId,
      mutation: { type: 'remove', role },
    }, { signal }));
    if (result.stale) return;
    await fetchData();
    if (mutationGenerationRef.current !== result.generation) return;
    if (result.failure) {
      toast.error(mutationErrorMessage(result.failure));
      return;
    }
    toast.success(t('business_role_mgr.allocation_deleted'));
  };

  const handleDeleteRole = async (roleName: string) => {
    if (!canEditMemberProfiles || mutationInFlightRef.current) return;
    const result = await runMutation(signal => deleteWorkspaceBusinessRole(
      workspaceId,
      roleName,
      { signal },
    ));
    if (result.stale) return;
    await fetchData();
    if (mutationGenerationRef.current !== result.generation) return;
    if (result.failure) {
      toast.error(mutationErrorMessage(result.failure));
      return;
    }
    toast.success(t('business_role_mgr.role_deleted', { name: roleName }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" role="status" aria-label={t('business_role_mgr.loading')}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4" role="alert">
        <p className="text-sm text-destructive">{t('business_role_mgr.load_failed')}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => void fetchData()}
        >
          {t('business_role_mgr.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> {t('business_role_mgr.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {t('business_role_mgr.description')}
          </p>

          {canEditMemberProfiles ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  placeholder={t('business_role_mgr.new_role_placeholder')}
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="text-sm"
                  disabled={mutationBusy}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
                />
                <Button
                  size="sm"
                  onClick={handleCreateRole}
                  disabled={mutationBusy || !newRoleName.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" /> {t('business_role_mgr.btn_create')}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{t('business_role_mgr.catalog_hint')}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  className="h-7 gap-1"
                  disabled={mutationBusy}
                >
                  <ListChecks className="h-3.5 w-3.5" /> {t('business_role_mgr.btn_catalog')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('business_role_mgr.readonly_hint')}</p>
          )}

          {mutationBusy && (
            <p className="text-xs text-muted-foreground" role="status">
              {t('business_role_mgr.saving')}
            </p>
          )}

          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{t('business_role_mgr.empty')}</p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <Card key={group.name} className="border-dashed">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{group.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{t('business_role_mgr.member_count', { count: group.members.length })}</Badge>
                        <Badge variant="outline" className="text-[10px]">∑ {group.totalPercentage.toFixed(0)}%</Badge>
                        <Badge variant="outline" className="text-[10px]">{t('business_role_mgr.hours_per_day', { value: group.totalHours.toFixed(1) })}</Badge>
                      </div>
                      {canEditMemberProfiles && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={mutationBusy}
                            aria-label={t('business_role_mgr.assign_member_action', { name: group.name })}
                            onClick={() => {
                              setAssignDialog(group.name);
                              setSelectedMemberId('');
                              setAssignPercentage(100);
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            disabled={mutationBusy}
                            aria-label={t('business_role_mgr.delete_role_action', { name: group.name })}
                            onClick={() => setDeleteRoleTarget(group.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {group.members.length > 0 ? (
                      <div className="space-y-1 ml-6">
                        {group.members.map((m) => (
                          <div key={m.membership_id + group.name} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5">
                              {m.is_priority && <Star className="h-3 w-3 fill-primary text-primary" />}
                              <span>{m.display_name}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{m.percentage.toFixed(0)}%</Badge>
                              <Badge variant="outline" className="text-[10px]">{t('business_role_mgr.hours_label', { hours: m.hours_per_day.toFixed(1) })}</Badge>
                              {canEditMemberProfiles && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  disabled={mutationBusy}
                                  aria-label={t('business_role_mgr.remove_allocation_action', {
                                    member: m.display_name,
                                    role: group.name,
                                  })}
                                  onClick={() => void handleRemoveAllocation(m.membership_id, group.name)}
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic ml-6">{t('business_role_mgr.no_members')}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {members.filter((m) => !groups.some((g) => g.members.some((x) => x.membership_id === m.id))).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('business_role_mgr.unassigned_members')}</p>
              <div className="flex flex-wrap gap-1">
                {members
                  .filter((m) => !groups.some((g) => g.members.some((x) => x.membership_id === m.id)))
                  .map((m) => (
                    <Badge key={m.id} variant="outline" className="text-xs">{m.display_name}</Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={canEditMemberProfiles && !!assignDialog}
        onOpenChange={(open) => !open && setAssignDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t('business_role_mgr.assign_dialog_title', { position: assignDialog })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">{t('business_role_mgr.label_member')}</label>
              <Select
                value={selectedMemberId}
                onValueChange={setSelectedMemberId}
                disabled={mutationBusy}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('business_role_mgr.select_member_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name} {t('business_role_mgr.hours_label', { hours: m.base_working_hours })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('business_role_mgr.label_allocation')}</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={assignPercentage}
                onChange={(e) => setAssignPercentage(Math.max(1, Math.min(100, Number(e.target.value) || 100)))}
                className="h-9"
                disabled={mutationBusy}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialog(null)}
              disabled={mutationBusy}
            >
              {t('business_role_mgr.btn_cancel')}
            </Button>
            <Button
              onClick={() => void handleAssignMember()}
              disabled={mutationBusy || !selectedMemberId}
            >
              {t('business_role_mgr.btn_assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={canEditMemberProfiles && deleteRoleTarget !== null}
        onOpenChange={(open) => {
          if (!open && !mutationBusy) setDeleteRoleTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('business_role_mgr.delete_role_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('business_role_mgr.delete_role_confirm_description', {
                name: deleteRoleTarget ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutationBusy}>
              {t('business_role_mgr.btn_cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutationBusy || deleteRoleTarget === null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteRoleTarget === null) return;
                const target = deleteRoleTarget;
                setDeleteRoleTarget(null);
                void handleDeleteRole(target);
              }}
            >
              {t('business_role_mgr.btn_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PositionPickerDialog
        open={canEditMemberProfiles && pickerOpen}
        onOpenChange={setPickerOpen}
        workspaceId={workspaceId}
        onPick={handlePickerResult}
      />
    </div>
  );
}
