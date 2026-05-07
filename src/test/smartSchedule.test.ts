import { describe, it, expect } from 'vitest';
import { generateSmartSchedule, type EmployeeWithSites, type SiteRuleLite } from '@/lib/smartSchedule';
import type { EligibilityContext } from '@/lib/coverageEligibility';

const OFFICE = 'office-main';

function makeEmployee(
  id: string,
  overrides: Partial<EmployeeWithSites> = {},
): EmployeeWithSites {
  return {
    membership_id: `mem-${id}`,
    user_id: `user-${id}`,
    display_name: `Employee ${id}`,
    business_role: 'Developer',
    weekly_capacity_hours: 40,
    base_working_hours: 8,
    skills: [],
    allowedSites: [{ siteId: OFFICE, priority: 1 }],
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

const singleSlotRule: SiteRuleLite = { office_id: OFFICE, min_headcount: 1 };

describe('generateSmartSchedule', () => {
  it('returns empty array when no employees are allowed for the site', () => {
    const emp = makeEmployee('1', { allowedSites: [] });
    const result = generateSmartSchedule(
      new Date('2026-06-15'),
      new Date('2026-06-15'),
      OFFICE,
      [emp],
      [singleSlotRule],
      makeCtx(),
    );
    expect(result).toHaveLength(0);
  });

  it('assigns one employee per slot per day', () => {
    const employees = [makeEmployee('1'), makeEmployee('2')];
    const result = generateSmartSchedule(
      new Date('2026-06-15'),
      new Date('2026-06-15'),
      OFFICE,
      employees,
      [singleSlotRule],
      makeCtx(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].office_id).toBe(OFFICE);
    expect(result[0].shift_date).toBe('2026-06-15');
  });

  it('generates assignments for each day in the range', () => {
    const employees = [makeEmployee('1'), makeEmployee('2'), makeEmployee('3')];
    const result = generateSmartSchedule(
      new Date('2026-06-15'),
      new Date('2026-06-17'),
      OFFICE,
      employees,
      [singleSlotRule],
      makeCtx(),
    );
    const dates = new Set(result.map(r => r.shift_date));
    expect(dates.has('2026-06-15')).toBe(true);
    expect(dates.has('2026-06-16')).toBe(true);
    expect(dates.has('2026-06-17')).toBe(true);
  });

  it('respects approved leave — leaves a member off on their leave day', () => {
    const emp1 = makeEmployee('1');
    const emp2 = makeEmployee('2');
    const ctx = makeCtx({
      leaves: [{ user_id: 'user-1', start_date: '2026-06-15', end_date: '2026-06-15', status: 'approved' }],
    });
    const result = generateSmartSchedule(
      new Date('2026-06-15'),
      new Date('2026-06-15'),
      OFFICE,
      [emp1, emp2],
      [singleSlotRule],
      ctx,
    );
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe('user-2');
  });

  it('fills multiple slots per day when min_headcount > 1', () => {
    const employees = [makeEmployee('1'), makeEmployee('2'), makeEmployee('3')];
    const rule: SiteRuleLite = { office_id: OFFICE, min_headcount: 2 };
    const result = generateSmartSchedule(
      new Date('2026-06-15'),
      new Date('2026-06-15'),
      OFFICE,
      employees,
      [rule],
      makeCtx(),
    );
    // 2 slots → 2 different people assigned on that day
    expect(result.length).toBeGreaterThanOrEqual(2);
    const users = result.map(r => r.user_id);
    expect(new Set(users).size).toBe(result.length);
  });

  it('prefers role-matching employee when role is specified in rule', () => {
    const devEmp = makeEmployee('dev', { business_role: 'Developer' });
    const qaEmp = makeEmployee('qa', { business_role: 'QA' });
    const rule: SiteRuleLite = {
      office_id: OFFICE,
      min_headcount: 1,
      business_roles: ['Developer'],
    };
    const result = generateSmartSchedule(
      new Date('2026-06-15'),
      new Date('2026-06-15'),
      OFFICE,
      [devEmp, qaEmp],
      [rule],
      makeCtx(),
    );
    expect(result[0].user_id).toBe('user-dev');
  });

  it('returns empty array when no rules are defined for the site', () => {
    const employees = [makeEmployee('1')];
    const result = generateSmartSchedule(
      new Date('2026-06-15'),
      new Date('2026-06-15'),
      OFFICE,
      employees,
      [],
      makeCtx(),
    );
    expect(result).toHaveLength(0);
  });

  it('does not double-book the same employee on the same day', () => {
    const employees = [makeEmployee('1'), makeEmployee('2')];
    const rule: SiteRuleLite = { office_id: OFFICE, min_headcount: 2 };
    const result = generateSmartSchedule(
      new Date('2026-06-15'),
      new Date('2026-06-15'),
      OFFICE,
      employees,
      [rule],
      makeCtx(),
    );
    const userIds = result.map(r => r.user_id);
    expect(new Set(userIds).size).toBe(userIds.length);
  });
});
