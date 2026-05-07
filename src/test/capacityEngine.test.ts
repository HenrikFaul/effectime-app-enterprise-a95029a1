import { describe, it, expect } from 'vitest';
import {
  sortCandidatesForRequirement,
  summarizeRequirements,
  type CapacityRow,
} from '@/lib/capacityEngine';

function makeRow(overrides: Partial<CapacityRow> = {}): CapacityRow {
  return {
    membership_id: 'mem-1',
    user_id: 'user-1',
    display_name: 'Test User',
    business_role: 'Developer',
    base_percentage: 100,
    used_percentage: 0,
    leave_deduction: 0,
    available_percentage: 100,
    base_working_hours: 8,
    available_hours_per_day: 8,
    ...overrides,
  };
}

describe('sortCandidatesForRequirement', () => {
  it('for full-time requirement (≥90%) sorts by most available first', () => {
    const candidates = [
      makeRow({ membership_id: 'a', available_percentage: 40 }),
      makeRow({ membership_id: 'b', available_percentage: 100 }),
      makeRow({ membership_id: 'c', available_percentage: 70 }),
    ];
    const sorted = sortCandidatesForRequirement(candidates, 90);
    expect(sorted.map(r => r.membership_id)).toEqual(['b', 'c', 'a']);
  });

  it('for partial requirement (<90%) eligible candidates (available ≥ required) come first', () => {
    const candidates = [
      makeRow({ membership_id: 'a', available_percentage: 20 }),
      makeRow({ membership_id: 'b', available_percentage: 60 }),
      makeRow({ membership_id: 'c', available_percentage: 50 }),
    ];
    const sorted = sortCandidatesForRequirement(candidates, 50);
    const firstIds = sorted.slice(0, 2).map(r => r.membership_id).sort();
    expect(firstIds).toEqual(['b', 'c']);
    expect(sorted[2].membership_id).toBe('a');
  });

  it('for partial requirement, among eligible candidates, picks the closest fit first', () => {
    const candidates = [
      makeRow({ membership_id: 'a', available_percentage: 80 }),
      makeRow({ membership_id: 'b', available_percentage: 55 }),
      makeRow({ membership_id: 'c', available_percentage: 100 }),
    ];
    const sorted = sortCandidatesForRequirement(candidates, 50);
    // b is closest to 50 (diff=5), a diff=30, c diff=50
    expect(sorted[0].membership_id).toBe('b');
  });

  it('does not mutate the input array', () => {
    const candidates = [
      makeRow({ membership_id: 'a', available_percentage: 30 }),
      makeRow({ membership_id: 'b', available_percentage: 90 }),
    ];
    const original = [...candidates];
    sortCandidatesForRequirement(candidates, 100);
    expect(candidates[0].membership_id).toBe(original[0].membership_id);
  });

  it('handles empty array', () => {
    expect(sortCandidatesForRequirement([], 50)).toEqual([]);
  });
});

describe('summarizeRequirements', () => {
  it('computes gap = required - assigned', () => {
    const reqs = [{ business_role: 'Developer', required_percentage: 100 }];
    const assigns = [{ business_role: 'Developer', allocated_percentage: 60 }];
    const result = summarizeRequirements(reqs, assigns);
    expect(result[0].gap).toBe(40);
    expect(result[0].assigned).toBe(60);
  });

  it('returns zero gap when fully assigned', () => {
    const reqs = [{ business_role: 'Analyst', required_percentage: 80 }];
    const assigns = [
      { business_role: 'Analyst', allocated_percentage: 50 },
      { business_role: 'Analyst', allocated_percentage: 30 },
    ];
    const result = summarizeRequirements(reqs, assigns);
    expect(result[0].gap).toBe(0);
    expect(result[0].assigned).toBe(80);
  });

  it('returns negative gap when over-assigned', () => {
    const reqs = [{ business_role: 'QA', required_percentage: 50 }];
    const assigns = [{ business_role: 'QA', allocated_percentage: 70 }];
    const result = summarizeRequirements(reqs, assigns);
    expect(result[0].gap).toBe(-20);
  });

  it('ignores assignments for other roles', () => {
    const reqs = [{ business_role: 'Designer', required_percentage: 100 }];
    const assigns = [{ business_role: 'Developer', allocated_percentage: 100 }];
    const result = summarizeRequirements(reqs, assigns);
    expect(result[0].assigned).toBe(0);
    expect(result[0].gap).toBe(100);
  });

  it('returns empty array for empty requirements', () => {
    expect(summarizeRequirements([], [])).toEqual([]);
  });

  it('handles multiple requirements independently', () => {
    const reqs = [
      { business_role: 'Dev', required_percentage: 100 },
      { business_role: 'PM', required_percentage: 50 },
    ];
    const assigns = [
      { business_role: 'Dev', allocated_percentage: 100 },
      { business_role: 'PM', allocated_percentage: 20 },
    ];
    const result = summarizeRequirements(reqs, assigns);
    const dev = result.find(r => r.business_role === 'Dev')!;
    const pm = result.find(r => r.business_role === 'PM')!;
    expect(dev.gap).toBe(0);
    expect(pm.gap).toBe(30);
  });
});
