import { describe, expect, it } from 'vitest';
import {
  canUseIcalScope,
  parseIcalScope,
} from '../../supabase/functions/leave-ical/security';

describe('iCal feed authorization boundary', () => {
  it('rejects unknown persisted scopes', () => {
    expect(parseIcalScope('own')).toBe('own');
    expect(parseIcalScope('team')).toBe('team');
    expect(parseIcalScope('workspace')).toBeNull();
  });

  it('allows every active role to use only its own feed', () => {
    expect(canUseIcalScope('own', 'member')).toBe(true);
    expect(canUseIcalScope('own', 'resourceAssistant')).toBe(true);
    expect(canUseIcalScope('own', 'owner')).toBe(true);
  });

  it('reserves the team feed for workspace administrators', () => {
    expect(canUseIcalScope('team', 'member')).toBe(false);
    expect(canUseIcalScope('team', 'resourceAssistant')).toBe(true);
    expect(canUseIcalScope('team', 'owner')).toBe(true);
  });
});
