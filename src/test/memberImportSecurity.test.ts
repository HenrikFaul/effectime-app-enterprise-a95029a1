import { describe, expect, it } from 'vitest';
import {
  parseEnterpriseRole,
  parseMembershipStatus,
  validateExistingMemberAccess,
  validateInvitationAccess,
} from '../../supabase/functions/import-entity-data/security';

describe('member import access boundary', () => {
  it('accepts only the database role and status domains', () => {
    expect(parseEnterpriseRole('owner')).toBe('owner');
    expect(parseEnterpriseRole('admin')).toBeNull();
    expect(parseMembershipStatus('inactive')).toBe('suspended');
    expect(parseMembershipStatus('disabled')).toBeNull();
  });

  it('allows a resource assistant to invite only regular members', () => {
    expect(validateInvitationAccess({
      actorRole: 'resourceAssistant',
      requestedRole: 'member',
      requestedStatus: 'active',
    })).toBeNull();
    expect(validateInvitationAccess({
      actorRole: 'resourceAssistant',
      requestedRole: 'owner',
      requestedStatus: 'active',
    })).toMatch(/Only a workspace owner/);
  });

  it('blocks resource-assistant self-escalation and peer access changes', () => {
    expect(validateExistingMemberAccess({
      actorRole: 'resourceAssistant',
      actorId: 'actor',
      targetUserId: 'actor',
      currentRole: 'resourceAssistant',
      currentStatus: 'active',
      requestedRole: 'owner',
      requestedStatus: 'active',
    })).toMatch(/Only a workspace owner/);
    expect(validateExistingMemberAccess({
      actorRole: 'resourceAssistant',
      actorId: 'actor',
      targetUserId: 'member',
      currentRole: 'member',
      currentStatus: 'active',
      requestedRole: 'resourceAssistant',
    })).toMatch(/Only a workspace owner/);
  });

  it('lets owners change another member but not their own access', () => {
    expect(validateExistingMemberAccess({
      actorRole: 'owner',
      actorId: 'owner-a',
      targetUserId: 'member-a',
      currentRole: 'member',
      currentStatus: 'active',
      requestedRole: 'resourceAssistant',
      requestedStatus: 'suspended',
    })).toBeNull();
    expect(validateExistingMemberAccess({
      actorRole: 'owner',
      actorId: 'owner-a',
      targetUserId: 'owner-a',
      currentRole: 'owner',
      currentStatus: 'active',
      requestedRole: 'member',
    })).toMatch(/cannot change their own role or status/);
  });

  it('does not let an active member be moved back into invitation state', () => {
    expect(validateExistingMemberAccess({
      actorRole: 'owner',
      actorId: 'owner-a',
      targetUserId: 'member-a',
      currentRole: 'member',
      currentStatus: 'active',
      requestedStatus: 'invited',
    })).toMatch(/cannot be moved back to invited/);
  });
});
