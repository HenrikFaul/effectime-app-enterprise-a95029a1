import { describe, it, expect } from 'vitest';
import {
  evaluateEligibility,
  rankCandidates,
  type MemberInput,
  type RequirementInput,
  type EligibilityContext,
} from '@/lib/coverageEligibility';

const SHIFT_DATE = '2026-06-15'; // Monday
const OFFICE_A = 'office-a';
const OFFICE_B = 'office-b';

function makeMember(overrides: Partial<MemberInput> = {}): MemberInput {
  return {
    membership_id: 'mem-1',
    user_id: 'user-1',
    display_name: 'Alice',
    business_role: 'Developer',
    weekly_capacity_hours: 40,
    base_working_hours: 8,
    skills: [],
    ...overrides,
  };
}

function makeReq(overrides: Partial<RequirementInput> = {}): RequirementInput {
  return {
    office_id: OFFICE_A,
    shift_date: SHIFT_DATE,
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

describe('evaluateEligibility — availability constraints', () => {
  it('returns eligible with score 100 when no issues', () => {
    const result = evaluateEligibility(makeMember(), makeReq(), makeCtx());
    expect(result.isEligible).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.matchScore).toBe(100);
  });

  it('holiday adds warning but does not block', () => {
    const ctx = makeCtx({ holidaysISO: new Set([SHIFT_DATE]) });
    const result = evaluateEligibility(makeMember(), makeReq(), ctx);
    expect(result.isEligible).toBe(true);
    const issue = result.issues.find(i => i.code === 'HOLIDAY');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(result.matchScore).toBeLessThan(100);
  });

  it('blocked date prevents eligibility', () => {
    const ctx = makeCtx({ blockedDatesISO: new Set([SHIFT_DATE]) });
    const result = evaluateEligibility(makeMember(), makeReq(), ctx);
    expect(result.isEligible).toBe(false);
    const issue = result.issues.find(i => i.code === 'BLOCKED');
    expect(issue!.severity).toBe('blocking');
  });

  it('approved leave blocks the member', () => {
    const ctx = makeCtx({
      leaves: [{ user_id: 'user-1', start_date: '2026-06-14', end_date: '2026-06-16', status: 'approved' }],
    });
    const result = evaluateEligibility(makeMember(), makeReq(), ctx);
    expect(result.isEligible).toBe(false);
    expect(result.issues.find(i => i.code === 'ON_LEAVE')).toBeDefined();
  });

  it('pending leave adds warning but does not block', () => {
    const ctx = makeCtx({
      leaves: [{ user_id: 'user-1', start_date: SHIFT_DATE, end_date: SHIFT_DATE, status: 'pending' }],
    });
    const result = evaluateEligibility(makeMember(), makeReq(), ctx);
    expect(result.isEligible).toBe(true);
    expect(result.issues.find(i => i.code === 'PENDING_LEAVE')).toBeDefined();
  });

  it('leave from a different user does not affect this member', () => {
    const ctx = makeCtx({
      leaves: [{ user_id: 'user-99', start_date: SHIFT_DATE, end_date: SHIFT_DATE, status: 'approved' }],
    });
    const result = evaluateEligibility(makeMember(), makeReq(), ctx);
    expect(result.isEligible).toBe(true);
  });

  it('leave outside the shift date does not block', () => {
    const ctx = makeCtx({
      leaves: [{ user_id: 'user-1', start_date: '2026-06-01', end_date: '2026-06-10', status: 'approved' }],
    });
    const result = evaluateEligibility(makeMember(), makeReq(), ctx);
    expect(result.isEligible).toBe(true);
  });
});

describe('evaluateEligibility — role and skill constraints', () => {
  it('matching business_role increases score', () => {
    const base = evaluateEligibility(makeMember({ business_role: 'Designer' }), makeReq(), makeCtx());
    const withRole = evaluateEligibility(
      makeMember({ business_role: 'Developer' }),
      makeReq({ business_role: 'Developer' }),
      makeCtx(),
    );
    expect(withRole.matchScore).toBeGreaterThan(base.matchScore);
  });

  it('wrong role adds warning but not blocking', () => {
    const result = evaluateEligibility(
      makeMember({ business_role: 'Designer' }),
      makeReq({ business_role: 'Developer' }),
      makeCtx(),
    );
    expect(result.isEligible).toBe(true);
    expect(result.issues.find(i => i.code === 'WRONG_ROLE')).toBeDefined();
  });

  it('multi-role requirement: matching any role qualifies', () => {
    const result = evaluateEligibility(
      makeMember({ business_role: 'QA' }),
      makeReq({ business_roles: ['Developer', 'QA'] }),
      makeCtx(),
    );
    expect(result.isEligible).toBe(true);
    expect(result.issues.find(i => i.code === 'WRONG_ROLE')).toBeUndefined();
  });

  it('missing required skill blocks when no role match', () => {
    const result = evaluateEligibility(
      makeMember({ business_role: null, skills: [] }),
      makeReq({ skill_id: 'skill-react' }),
      makeCtx(),
    );
    const issue = result.issues.find(i => i.code === 'MISSING_SKILL');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('blocking');
    expect(result.isEligible).toBe(false);
  });

  it('missing skill with role match becomes warning only', () => {
    const result = evaluateEligibility(
      makeMember({ business_role: 'Developer', skills: [] }),
      makeReq({ business_role: 'Developer', skill_id: 'skill-react' }),
      makeCtx(),
    );
    const issue = result.issues.find(i => i.code === 'MISSING_SKILL');
    expect(issue!.severity).toBe('warning');
    expect(result.isEligible).toBe(true);
  });

  it('skill level below minimum adds SKILL_LEVEL_LOW warning', () => {
    const result = evaluateEligibility(
      makeMember({ skills: [{ skill_id: 'skill-ts', level: 1 }] }),
      makeReq({ skill_id: 'skill-ts', min_skill_level: 3 }),
      makeCtx(),
    );
    expect(result.issues.find(i => i.code === 'SKILL_LEVEL_LOW')).toBeDefined();
    expect(result.isEligible).toBe(true);
  });

  it('skill level meeting minimum adds score bonus', () => {
    const base = evaluateEligibility(makeMember({ skills: [] }), makeReq(), makeCtx());
    const withSkill = evaluateEligibility(
      makeMember({ skills: [{ skill_id: 'sk', level: 3 }] }),
      makeReq({ skill_id: 'sk', min_skill_level: 2 }),
      makeCtx(),
    );
    expect(withSkill.matchScore).toBeGreaterThan(base.matchScore);
  });
});

describe('evaluateEligibility — double-booking constraint', () => {
  it('assigns to same office on same day: no double-booking issue', () => {
    const ctx = makeCtx({
      shifts: [{ user_id: 'user-1', office_id: OFFICE_A, shift_date: SHIFT_DATE }],
    });
    const result = evaluateEligibility(makeMember(), makeReq({ office_id: OFFICE_A }), ctx);
    expect(result.issues.find(i => i.code === 'DOUBLE_BOOKED')).toBeUndefined();
  });

  it('already assigned to different office on same day: DOUBLE_BOOKED blocking', () => {
    const ctx = makeCtx({
      shifts: [{ user_id: 'user-1', office_id: OFFICE_B, shift_date: SHIFT_DATE }],
    });
    const result = evaluateEligibility(makeMember(), makeReq({ office_id: OFFICE_A }), ctx);
    expect(result.isEligible).toBe(false);
    expect(result.issues.find(i => i.code === 'DOUBLE_BOOKED')).toBeDefined();
  });
});

describe('evaluateEligibility — over-capacity constraint', () => {
  it('warns when projected weekly hours exceed capacity', () => {
    // Member has 5 shifts already this ISO week, adding one more = 6*8=48h > 40h capacity
    const sameWeekShifts: Array<{ user_id: string; office_id: string; shift_date: string }> = [
      { user_id: 'user-1', office_id: OFFICE_A, shift_date: '2026-06-15' },
      { user_id: 'user-1', office_id: OFFICE_A, shift_date: '2026-06-16' },
      { user_id: 'user-1', office_id: OFFICE_A, shift_date: '2026-06-17' },
      { user_id: 'user-1', office_id: OFFICE_A, shift_date: '2026-06-18' },
      { user_id: 'user-1', office_id: OFFICE_A, shift_date: '2026-06-19' },
    ];
    const ctx = makeCtx({ shifts: sameWeekShifts });
    const result = evaluateEligibility(
      makeMember({ weekly_capacity_hours: 40, base_working_hours: 8 }),
      makeReq({ shift_date: '2026-06-20' }), // Saturday same week
      ctx,
    );
    expect(result.issues.find(i => i.code === 'OVER_CAPACITY')).toBeDefined();
  });

  it('no over-capacity warning when within weekly limit', () => {
    const ctx = makeCtx({
      shifts: [{ user_id: 'user-1', office_id: OFFICE_A, shift_date: '2026-06-15' }],
    });
    const result = evaluateEligibility(
      makeMember({ weekly_capacity_hours: 40, base_working_hours: 8 }),
      makeReq({ shift_date: '2026-06-16' }),
      ctx,
    );
    expect(result.issues.find(i => i.code === 'OVER_CAPACITY')).toBeUndefined();
  });
});

describe('rankCandidates', () => {
  it('eligible members sort before ineligible', () => {
    const m1 = makeMember({ user_id: 'u1', membership_id: 'a' });
    const m2 = makeMember({
      user_id: 'u2',
      membership_id: 'b',
      business_role: null,
      skills: [],
    });
    const ctx = makeCtx({
      leaves: [{ user_id: 'u2', start_date: SHIFT_DATE, end_date: SHIFT_DATE, status: 'approved' }],
    });
    const ranked = rankCandidates([m2, m1], makeReq(), ctx);
    expect(ranked[0].member.membership_id).toBe('a');
  });

  it('among eligible, higher score ranks first', () => {
    const m1 = makeMember({ user_id: 'u1', membership_id: 'low', business_role: 'Designer' });
    const m2 = makeMember({ user_id: 'u2', membership_id: 'high', business_role: 'Developer' });
    const req = makeReq({ business_role: 'Developer' });
    const ranked = rankCandidates([m1, m2], req, makeCtx());
    expect(ranked[0].member.membership_id).toBe('high');
  });

  it('returns empty array for no candidates', () => {
    expect(rankCandidates([], makeReq(), makeCtx())).toEqual([]);
  });
});
