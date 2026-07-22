import { describe, expect, it } from 'vitest';
import {
  MAX_ROLE_ALLOCATIONS,
  MAX_ROLE_NAME_CODE_POINTS,
  addRoleAllocation,
  canonicalizeRoleName,
  normalizeRoleAllocations,
  removeRoleAllocation,
  setRoleAllocationPercentage,
  setRoleAllocationPriority,
  toggleRoleAllocationLock,
  type RoleAllocationDraft,
  type RoleAllocationResult,
} from '@/lib/roleAllocationDraft';

function expectSuccess(result: RoleAllocationResult): RoleAllocationDraft[] {
  expect(result.ok).toBe(true);
  if (result.ok === false) throw new Error(`Expected success, received ${result.reason}`);
  return result.allocations;
}

function expectInvariant(allocations: readonly RoleAllocationDraft[]) {
  expect(allocations.length).toBeLessThanOrEqual(MAX_ROLE_ALLOCATIONS);
  if (allocations.length === 0) return;

  const totalUnits = allocations.reduce(
    (sum, allocation) => sum + Math.round(allocation.percentage * 100),
    0,
  );
  expect(totalUnits).toBe(10_000);
  expect(allocations.filter(allocation => allocation.is_priority).length).toBe(1);
  expect(
    allocations.every(allocation => {
      const units = allocation.percentage * 100;
      return Math.abs(units - Math.round(units)) < 1e-8;
    }),
  ).toBe(true);

  const keys = allocations.map(allocation => allocation.business_role.toLowerCase());
  expect(new Set(keys).size).toBe(allocations.length);
  allocations.forEach(allocation => {
    expect(allocation.business_role).toBe(allocation.business_role.normalize('NFKC').trim());
  });
}

function draft(count: number): RoleAllocationDraft[] {
  return Array.from({ length: count }, (_, index) => ({
    business_role: `Role ${index + 1}`,
    percentage: 0,
    is_priority: index === 0,
  }));
}

describe('role allocation cardinality and rounding invariants', () => {
  it.each([
    [0, []],
    [1, [100]],
    [2, [50, 50]],
    [3, [33.34, 33.33, 33.33]],
    [7, [14.29, 14.29, 14.29, 14.29, 14.28, 14.28, 14.28]],
    [20, Array.from({ length: 20 }, () => 5)],
  ] as const)('normalizes %i roles with deterministic hundredths', (count, expected) => {
    const allocations = expectSuccess(normalizeRoleAllocations(draft(count)));

    expect(allocations.map(allocation => allocation.percentage)).toEqual(expected);
    expectInvariant(allocations);
  });

  it('rounds an edited percentage once and distributes the remainder proportionally', () => {
    const allocations = expectSuccess(
      setRoleAllocationPercentage(
        [
          { business_role: 'A', percentage: 50, is_priority: true },
          { business_role: 'B', percentage: 30 },
          { business_role: 'C', percentage: 20 },
        ],
        'A',
        33.335,
      ),
    );

    expect(allocations.map(allocation => allocation.percentage)).toEqual([33.34, 40, 26.66]);
    expectInvariant(allocations);
  });

  it.each([
    ['add', (input: RoleAllocationDraft[]) => addRoleAllocation(input, 'C')],
    ['remove', (input: RoleAllocationDraft[]) => removeRoleAllocation(input, 'B')],
    ['set percentage', (input: RoleAllocationDraft[]) => (
      setRoleAllocationPercentage(input, 'A', 40)
    )],
    ['toggle lock', (input: RoleAllocationDraft[]) => toggleRoleAllocationLock(input, 'A')],
    ['set priority', (input: RoleAllocationDraft[]) => setRoleAllocationPriority(input, 'B')],
  ])('rejects a historical non-100%% snapshot before %s', (_name, mutate) => {
    const input: RoleAllocationDraft[] = [
      { business_role: 'A', percentage: 60, is_priority: true },
      { business_role: 'B', percentage: 30 },
    ];
    const before = structuredClone(input);

    expect(mutate(input)).toEqual({ ok: false, reason: 'invalid_total' });
    expect(input).toEqual(before);
  });

  it.each([
    ['add', (input: RoleAllocationDraft[]) => addRoleAllocation(input, 'C')],
    ['remove', (input: RoleAllocationDraft[]) => removeRoleAllocation(input, 'B')],
    ['set percentage', (input: RoleAllocationDraft[]) => (
      setRoleAllocationPercentage(input, 'A', 40)
    )],
    ['toggle lock', (input: RoleAllocationDraft[]) => toggleRoleAllocationLock(input, 'A')],
    ['set priority', (input: RoleAllocationDraft[]) => setRoleAllocationPriority(input, 'B')],
  ])('rejects a historical snapshot without exactly one priority before %s', (_name, mutate) => {
    const invalidSnapshots: RoleAllocationDraft[][] = [
      [
        { business_role: 'A', percentage: 50 },
        { business_role: 'B', percentage: 50 },
      ],
      [
        { business_role: 'A', percentage: 50, is_priority: true },
        { business_role: 'B', percentage: 50, is_priority: true },
      ],
    ];

    invalidSnapshots.forEach(input => {
      const before = structuredClone(input);
      expect(mutate(input)).toEqual({ ok: false, reason: 'invalid_priority' });
      expect(input).toEqual(before);
    });
  });

  it('rejects historical precision that an edit would otherwise round silently', () => {
    const input: RoleAllocationDraft[] = [
      { business_role: 'A', percentage: 33.335, is_priority: true },
      { business_role: 'B', percentage: 66.665 },
    ];

    expect(toggleRoleAllocationLock(input, 'A')).toEqual({
      ok: false,
      reason: 'invalid_percentage',
      role: 'A',
    });
  });
});

describe('role allocation name and size boundary', () => {
  it('canonicalizes surrounding whitespace and NFKC compatibility characters', () => {
    const role = canonicalizeRoleName('  Ｄｅｖ　');
    expect(role).toEqual({ ok: true, name: 'Dev', key: 'dev' });

    const allocations = expectSuccess(addRoleAllocation([], '  Ｄｅｖ　'));
    expect(allocations[0].business_role).toBe('Dev');
  });

  it('rejects a non-canonical persisted role instead of silently rewriting history', () => {
    const input = [{
      business_role: '  Ｄｅｖ　',
      percentage: 100,
      is_priority: true,
    }];
    const expected = { ok: false, reason: 'invalid_role_name', role: '  Ｄｅｖ　' };

    expect(normalizeRoleAllocations(input)).toEqual(expected);
    expect(addRoleAllocation(input, 'Other')).toEqual(expected);
  });

  it.each(['dev', ' DEV ', 'ｄｅｖ'])('rejects a case-insensitive duplicate: %s', duplicate => {
    const result = addRoleAllocation(
      [{ business_role: 'Dev', percentage: 100, is_priority: true }],
      duplicate,
    );

    expect(result).toMatchObject({ ok: false, reason: 'duplicate_role' });
  });

  it('rejects duplicates already present in the input', () => {
    const result = normalizeRoleAllocations([
      { business_role: 'Role', percentage: 50 },
      { business_role: 'ROLE', percentage: 50 },
    ]);
    expect(result).toMatchObject({ ok: false, reason: 'duplicate_role' });
  });

  it('rejects empty role names without throwing', () => {
    expect(() => addRoleAllocation([], '　')).not.toThrow();
    expect(addRoleAllocation([], '　')).toEqual({ ok: false, reason: 'invalid_role_name' });
  });

  it('matches the database role-name code-point and control-character boundary', () => {
    const maximumAstralName = '🧪'.repeat(MAX_ROLE_NAME_CODE_POINTS);
    expect(canonicalizeRoleName(maximumAstralName)).toMatchObject({
      ok: true,
      name: maximumAstralName,
    });
    expect(canonicalizeRoleName(`${maximumAstralName}🧪`)).toEqual({
      ok: false,
      reason: 'invalid_role_name',
    });
    expect(canonicalizeRoleName('Developer\u0000Admin')).toEqual({
      ok: false,
      reason: 'invalid_role_name',
    });
  });

  it('accepts twenty roles and rejects the twenty-first', () => {
    const twenty = expectSuccess(normalizeRoleAllocations(draft(20)));
    expectInvariant(twenty);

    const result = addRoleAllocation(twenty, 'Role 21');
    expect(result).toEqual({ ok: false, reason: 'too_many_roles' });
    expect(normalizeRoleAllocations(draft(21))).toEqual({
      ok: false,
      reason: 'too_many_roles',
    });
  });
});

describe('deterministic add, remove, locking and priority operations', () => {
  it('adds the first role at 100% and makes it primary', () => {
    const allocations = expectSuccess(addRoleAllocation([], '  Ｏｗｎｅｒ '));
    expect(allocations).toEqual([
      { business_role: 'Owner', percentage: 100, locked: false, is_priority: true },
    ]);
    expectInvariant(allocations);
  });

  it('uses the editor-compatible equal split when no requested percentage is supplied', () => {
    const allocations = expectSuccess(
      addRoleAllocation(
        [
          { business_role: 'A', percentage: 70, is_priority: true },
          { business_role: 'B', percentage: 30 },
        ],
        'C',
      ),
    );

    expect(allocations.map(allocation => allocation.percentage)).toEqual([33.34, 33.33, 33.33]);
    expectInvariant(allocations);
  });

  it('honors a requested add percentage and proportionally resizes existing unlocked rows', () => {
    const allocations = expectSuccess(
      addRoleAllocation(
        [
          { business_role: 'A', percentage: 70, is_priority: true },
          { business_role: 'B', percentage: 30 },
        ],
        'C',
        25,
      ),
    );

    expect(allocations.map(allocation => allocation.percentage)).toEqual([52.5, 22.5, 25]);
    expectInvariant(allocations);
  });

  it('rejects a requested first-role percentage that cannot make a complete allocation', () => {
    expect(addRoleAllocation([], 'A', 30)).toEqual({
      ok: false,
      reason: 'unallocatable_remainder',
      role: 'A',
    });
  });

  it('preserves locked percentages while setting an unlocked percentage', () => {
    const allocations = expectSuccess(
      setRoleAllocationPercentage(
        [
          { business_role: 'Locked', percentage: 60, locked: true, is_priority: true },
          { business_role: 'B', percentage: 20 },
          { business_role: 'C', percentage: 20 },
        ],
        'B',
        30,
      ),
    );

    expect(allocations.map(allocation => allocation.percentage)).toEqual([60, 30, 10]);
    expect(allocations[0].locked).toBe(true);
    expectInvariant(allocations);
  });

  it('fails without mutation when locked rows leave an impossible remainder', () => {
    const input: RoleAllocationDraft[] = [
      { business_role: 'Locked', percentage: 60, locked: true, is_priority: true },
      { business_role: 'Only unlocked', percentage: 40 },
    ];
    const before = structuredClone(input);

    const result = setRoleAllocationPercentage(input, 'Only unlocked', 30);

    expect(result).toEqual({
      ok: false,
      reason: 'unallocatable_remainder',
      role: 'Only unlocked',
    });
    expect(input).toEqual(before);
  });

  it('does not permit editing a locked row', () => {
    const result = setRoleAllocationPercentage(
      [
        { business_role: 'Locked', percentage: 60, locked: true, is_priority: true },
        { business_role: 'B', percentage: 40 },
      ],
      'Locked',
      50,
    );
    expect(result).toEqual({ ok: false, reason: 'locked_role', role: 'Locked' });
  });

  it('fails a remove that would require changing the only remaining locked row', () => {
    const input: RoleAllocationDraft[] = [
      { business_role: 'Locked', percentage: 80, locked: true, is_priority: true },
      { business_role: 'Remove', percentage: 20 },
    ];
    const before = structuredClone(input);

    expect(removeRoleAllocation(input, 'Remove')).toEqual({
      ok: false,
      reason: 'unallocatable_remainder',
      role: 'Remove',
    });
    expect(input).toEqual(before);
  });

  it('promotes the deterministic first remaining row when the primary is removed', () => {
    const allocations = expectSuccess(
      removeRoleAllocation(
        [
          { business_role: 'Primary', percentage: 40, is_priority: true },
          { business_role: 'First remaining', percentage: 30 },
          { business_role: 'Second remaining', percentage: 30 },
        ],
        'Primary',
      ),
    );

    expect(allocations).toEqual([
      {
        business_role: 'First remaining',
        percentage: 50,
        locked: false,
        is_priority: true,
      },
      {
        business_role: 'Second remaining',
        percentage: 50,
        locked: false,
        is_priority: false,
      },
    ]);
    expectInvariant(allocations);
  });

  it('keeps the existing primary when a non-primary row is removed', () => {
    const allocations = expectSuccess(
      removeRoleAllocation(
        [
          { business_role: 'Primary', percentage: 50, is_priority: true },
          { business_role: 'Remove', percentage: 25 },
          { business_role: 'Remain', percentage: 25 },
        ],
        'Remove',
      ),
    );
    expect(allocations[0].is_priority).toBe(true);
    expectInvariant(allocations);
  });

  it('normalizes multiple priorities to the deterministic first one', () => {
    const allocations = expectSuccess(
      normalizeRoleAllocations([
        { business_role: 'A', percentage: 50, is_priority: true },
        { business_role: 'B', percentage: 50, is_priority: true },
      ]),
    );
    expect(allocations.map(allocation => allocation.is_priority)).toEqual([true, false]);
  });

  it('toggles locks and switches priority without changing total allocation', () => {
    const initial: RoleAllocationDraft[] = [
      { business_role: 'A', percentage: 50, is_priority: true },
      { business_role: 'B', percentage: 50 },
    ];
    const locked = expectSuccess(toggleRoleAllocationLock(initial, 'B'));
    const prioritized = expectSuccess(setRoleAllocationPriority(locked, 'B'));

    expect(prioritized.map(allocation => allocation.locked)).toEqual([false, true]);
    expect(prioritized.map(allocation => allocation.is_priority)).toEqual([false, true]);
    expectInvariant(prioritized);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 101])(
    'returns a failure instead of throwing for invalid percentage %s',
    percentage => {
      const input = [
        { business_role: 'A', percentage: 50, is_priority: true },
        { business_role: 'B', percentage: 50 },
      ];
      expect(() => setRoleAllocationPercentage(input, 'A', percentage)).not.toThrow();
      expect(setRoleAllocationPercentage(input, 'A', percentage)).toMatchObject({
        ok: false,
        reason: 'invalid_percentage',
      });
    },
  );
});
