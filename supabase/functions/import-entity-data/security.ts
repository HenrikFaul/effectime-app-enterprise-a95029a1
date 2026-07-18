export type ImportActorRole = 'owner' | 'resourceAssistant';
export type EnterpriseRole = 'owner' | 'resourceAssistant' | 'member';
export type MembershipStatus = 'active' | 'invited' | 'suspended' | 'removed';

const ENTERPRISE_ROLES = new Set<EnterpriseRole>(['owner', 'resourceAssistant', 'member']);
const MEMBERSHIP_STATUSES = new Set<MembershipStatus>([
  'active',
  'invited',
  'suspended',
  'removed',
]);

export function parseEnterpriseRole(value: unknown): EnterpriseRole | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim() as EnterpriseRole;
  return ENTERPRISE_ROLES.has(normalized) ? normalized : null;
}

export function parseMembershipStatus(value: unknown): MembershipStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim() === 'inactive' ? 'suspended' : value.trim();
  return MEMBERSHIP_STATUSES.has(normalized as MembershipStatus)
    ? (normalized as MembershipStatus)
    : null;
}

export function validateInvitationAccess(input: {
  actorRole: ImportActorRole;
  requestedRole: EnterpriseRole;
  requestedStatus?: MembershipStatus;
}): string | null {
  if (input.actorRole !== 'owner' && input.requestedRole !== 'member') {
    return 'Only a workspace owner may invite an elevated workspace role';
  }
  if (input.requestedStatus && !['active', 'invited'].includes(input.requestedStatus)) {
    return 'A new workspace member must accept an invitation before being suspended or removed';
  }
  return null;
}

export function validateExistingMemberAccess(input: {
  actorRole: ImportActorRole;
  actorId: string;
  targetUserId: string;
  currentRole: EnterpriseRole;
  currentStatus: MembershipStatus;
  requestedRole?: EnterpriseRole;
  requestedStatus?: MembershipStatus;
}): string | null {
  const roleChanges = Boolean(input.requestedRole && input.requestedRole !== input.currentRole);
  const statusChanges = Boolean(
    input.requestedStatus && input.requestedStatus !== input.currentStatus,
  );

  if (!roleChanges && !statusChanges) return null;
  if (input.actorRole !== 'owner') {
    return 'Only a workspace owner may change membership role or status';
  }
  if (input.actorId === input.targetUserId) {
    return 'Workspace owners cannot change their own role or status through bulk import';
  }
  if (input.requestedStatus === 'invited' && input.currentStatus !== 'invited') {
    return 'An existing member cannot be moved back to invited status';
  }
  return null;
}
