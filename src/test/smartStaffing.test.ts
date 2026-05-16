import { describe, it, expect } from 'vitest';
import {
  evaluateEligibility,
  rankCandidates,
  type MemberInput,
  type RequirementInput,
  type EligibilityContext,
} from '@/lib/coverageEligibility';

const DATE = '2026-07-14';
const OFFICE = 'office-a';

function makeMember(overrides: Partial<MemberInput> = {}): MemberInput {
  return {
    membership_id: 'mem-1',
    user_id: 'user-1',
    display_name: 'Alice',
    business_role: 'Optician',
    weekly_capacity_hours: 40,
    base_working_hours: 8,
    skills: [],
    ...overrides,
  };
}

function makeReq(overrides: Partial<RequirementInput> = {}): RequirementInput {
  return {
    office_id: OFFICE,
    shift_date: DATE,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    holidaysISO: new Set(),
    blockedDatesISO: new Set(),
    leaves: [],
    shifts: [],
    ...overrides,
  };
}

// ─── Availability boost ───────────────────────────────────────────────────────

describe('availability boost', () => {
  it('adds +20 to score when member is marked available on the shift date', () => {
    const member = makeMember();
    const req = makeReq();
    const avail = new Map([[DATE, new Set(['user-1'])]]);
    const withAvail = evaluateEligibility(member, req, makeCtx({ availabilityByDate: avail }));
    const withoutAvail = evaluateEligibility(member, req, makeCtx());
    expect(withAvail.matchScore).toBe(withoutAvail.matchScore + 20);
  });

  it('does not boost members not marked available', () => {
    const member = makeMember();
    const req = makeReq();
    const avail = new Map([[DATE, new Set(['user-other'])]]);
    const withAvail = evaluateEligibility(member, req, makeCtx({ availabilityByDate: avail }));
    const withoutAvail = evaluateEligibility(member, req, makeCtx());
    expect(withAvail.matchScore).toBe(withoutAvail.matchScore);
  });

  it('does not boost when availability is for a different date', () => {
    const member = makeMember();
    const req = makeReq();
    const avail = new Map([['2026-07-15', new Set(['user-1'])]]);
    const withAvail = evaluateEligibility(member, req, makeCtx({ availabilityByDate: avail }));
    const withoutAvail = evaluateEligibility(member, req, makeCtx());
    expect(withAvail.matchScore).toBe(withoutAvail.matchScore);
  });

  it('is backward compatible when availabilityByDate is absent', () => {
    const member = makeMember();
    const req = makeReq();
    // ctx without availabilityByDate field at all
    const result = evaluateEligibility(member, req, makeCtx());
    expect(result.isEligible).toBe(true);
    expect(result.matchScore).toBeGreaterThan(0);
  });
});

// ─── Ranking with availability ────────────────────────────────────────────────

describe('rankCandidates with availability', () => {
  it('ranks available member above equally-qualified unavailable member', () => {
    const alice = makeMember({ membership_id: 'mem-1', user_id: 'user-1', display_name: 'Alice' });
    const bob = makeMember({ membership_id: 'mem-2', user_id: 'user-2', display_name: 'Bob' });
    const avail = new Map([[DATE, new Set(['user-1'])]]);
    const results = rankCandidates([bob, alice], makeReq(), makeCtx({ availabilityByDate: avail }));
    expect(results[0].member.display_name).toBe('Alice');
  });

  it('still ranks by eligibility first (blocking issue overrides availability boost)', () => {
    const alice = makeMember({ user_id: 'user-1' });
    const bob = makeMember({ membership_id: 'mem-2', user_id: 'user-2' });
    const avail = new Map([[DATE, new Set(['user-1'])]]);
    const leaves = [{ user_id: 'user-1', start_date: DATE, end_date: DATE, status: 'approved' }];
    const results = rankCandidates([alice, bob], makeReq(), makeCtx({ availabilityByDate: avail, leaves }));
    // Alice is on leave (blocking) — Bob should rank first despite no availability boost
    expect(results[0].member.user_id).toBe('user-2');
  });
});

// ─── EligibilityContext backwards compatibility ───────────────────────────────

describe('EligibilityContext', () => {
  it('accepts context without availabilityByDate (optional field)', () => {
    const ctx: EligibilityContext = {
      holidaysISO: new Set(),
      blockedDatesISO: new Set(),
      leaves: [],
      shifts: [],
      // availabilityByDate intentionally omitted
    };
    const result = evaluateEligibility(makeMember(), makeReq(), ctx);
    expect(result.isEligible).toBe(true);
  });
});
