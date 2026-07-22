export const MAX_ROLE_ALLOCATIONS = 20;
export const MAX_ROLE_NAME_CODE_POINTS = 200;

const HUNDREDTHS_PER_PERCENT = 100;
const TOTAL_HUNDREDTHS = 100 * HUNDREDTHS_PER_PERCENT;

export interface RoleAllocationDraft {
  business_role: string;
  percentage: number;
  locked?: boolean;
  is_priority?: boolean;
}

export type RoleAllocationFailureReason =
  | 'invalid_allocations'
  | 'invalid_role_name'
  | 'duplicate_role'
  | 'too_many_roles'
  | 'role_not_found'
  | 'invalid_percentage'
  | 'invalid_total'
  | 'invalid_priority'
  | 'locked_role'
  | 'locked_total_exceeds_100'
  | 'unallocatable_remainder';

export type RoleAllocationResult =
  | {
      ok: true;
      allocations: RoleAllocationDraft[];
      reason?: never;
      role?: never;
    }
  | {
      ok: false;
      reason: RoleAllocationFailureReason;
      role?: string;
      allocations?: never;
    };

type ParsedAllocation = {
  business_role: string;
  units: number;
  locked: boolean;
  is_priority: boolean;
};

type ParsedResult =
  | {
      ok: true;
      allocations: ParsedAllocation[];
      reason?: never;
      role?: never;
    }
  | Extract<RoleAllocationResult, { ok: false }>;

type RoleNameResult =
  | {
      ok: true;
      name: string;
      key: string;
      reason?: never;
      role?: never;
    }
  | Extract<RoleAllocationResult, { ok: false }>;

function failure(
  reason: RoleAllocationFailureReason,
  role?: string,
): Extract<RoleAllocationResult, { ok: false }> {
  return role === undefined ? { ok: false, reason } : { ok: false, reason, role };
}

/** Canonical role names are NFKC-normalized and stripped of surrounding whitespace. */
export function canonicalizeRoleName(role: string): RoleNameResult {
  if (typeof role !== 'string') return failure('invalid_role_name');

  const name = role.normalize('NFKC').trim();
  if (
    name.length === 0
    || Array.from(name).length > MAX_ROLE_NAME_CODE_POINTS
    || Array.from(name).some(character => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    })
  ) return failure('invalid_role_name');

  return { ok: true, name, key: name.toLowerCase() };
}

function percentageToUnits(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0 || value > 100) return undefined;
  return Math.round(value * HUNDREDTHS_PER_PERCENT);
}

function unitsToPercentage(units: number): number {
  return units / HUNDREDTHS_PER_PERCENT;
}

function parseAllocations(input: readonly RoleAllocationDraft[]): ParsedResult {
  if (!Array.isArray(input)) return failure('invalid_allocations');
  if (input.length > MAX_ROLE_ALLOCATIONS) return failure('too_many_roles');

  const seen = new Set<string>();
  const allocations: ParsedAllocation[] = [];

  for (const allocation of input) {
    if (!allocation || typeof allocation !== 'object') return failure('invalid_allocations');

    const role = canonicalizeRoleName(allocation.business_role);
    if (role.ok === false) return role;
    // Existing persisted snapshots must never be rewritten as a side effect of an
    // unrelated edit. New role input is canonicalized by the public add helper,
    // while historical non-canonical data is surfaced for an explicit repair.
    if (allocation.business_role !== role.name) {
      return failure('invalid_role_name', allocation.business_role);
    }
    if (seen.has(role.key)) return failure('duplicate_role', role.name);

    const units = percentageToUnits(allocation.percentage);
    if (units === undefined) return failure('invalid_percentage', role.name);
    if (Math.abs(allocation.percentage * HUNDREDTHS_PER_PERCENT - units) > 1e-8) {
      return failure('invalid_percentage', role.name);
    }

    seen.add(role.key);
    allocations.push({
      business_role: role.name,
      units,
      locked: allocation.locked === true,
      is_priority: allocation.is_priority === true,
    });
  }

  return { ok: true, allocations };
}

/**
 * Distributes integer hundredths using a stable largest-remainder calculation.
 * Equal remainders are awarded in input order, so identical input is reproducible
 * in every browser and native WebView.
 */
function distributeUnits(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];

  const safeWeights = weights.map(weight => Math.max(0, Math.trunc(weight)));
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0);
  const effectiveWeights = weightTotal === 0 ? safeWeights.map(() => 1) : safeWeights;
  const effectiveTotal = weightTotal === 0 ? effectiveWeights.length : weightTotal;

  const result = effectiveWeights.map(weight => Math.floor((total * weight) / effectiveTotal));
  const remainder = total - result.reduce((sum, units) => sum + units, 0);

  const order = effectiveWeights
    .map((weight, index) => ({ index, residue: (total * weight) % effectiveTotal }))
    .sort((left, right) => right.residue - left.residue || left.index - right.index);

  for (let index = 0; index < remainder; index += 1) {
    result[order[index].index] += 1;
  }

  return result;
}

function normalizeParsed(allocations: ParsedAllocation[]): RoleAllocationResult {
  if (allocations.length === 0) return { ok: true, allocations: [] };

  const lockedTotal = allocations.reduce(
    (sum, allocation) => sum + (allocation.locked ? allocation.units : 0),
    0,
  );
  if (lockedTotal > TOTAL_HUNDREDTHS) return failure('locked_total_exceeds_100');

  const unlocked = allocations.filter(allocation => !allocation.locked);
  if (unlocked.length === 0 && lockedTotal !== TOTAL_HUNDREDTHS) {
    return failure('unallocatable_remainder');
  }

  const distributed = distributeUnits(
    TOTAL_HUNDREDTHS - lockedTotal,
    unlocked.map(allocation => allocation.units),
  );
  let unlockedIndex = 0;
  const requestedPriorityIndex = allocations.findIndex(allocation => allocation.is_priority);
  const priorityIndex = requestedPriorityIndex >= 0 ? requestedPriorityIndex : 0;

  const normalized = allocations.map((allocation, index) => {
    const units = allocation.locked ? allocation.units : distributed[unlockedIndex++];
    return {
      business_role: allocation.business_role,
      percentage: unitsToPercentage(units),
      locked: allocation.locked,
      is_priority: index === priorityIndex,
    };
  });

  return { ok: true, allocations: normalized };
}

export function normalizeRoleAllocations(
  input: readonly RoleAllocationDraft[],
): RoleAllocationResult {
  const parsed = parseAllocations(input);
  if (parsed.ok === false) return parsed;
  return normalizeParsed(parsed.allocations);
}

/**
 * Mutations only accept a complete persisted snapshot. Repairing a historical
 * total or primary marker as a side effect of an unrelated edit would hide bad
 * data and can change business meaning, so callers must repair it explicitly.
 */
function validatedSnapshotToParsed(
  input: readonly RoleAllocationDraft[],
): ParsedResult {
  const parsed = parseAllocations(input);
  if (parsed.ok === false || parsed.allocations.length === 0) return parsed;

  const total = parsed.allocations.reduce(
    (sum, allocation) => sum + allocation.units,
    0,
  );
  if (total !== TOTAL_HUNDREDTHS) return failure('invalid_total');

  const priorityCount = parsed.allocations.filter(
    allocation => allocation.is_priority,
  ).length;
  if (priorityCount !== 1) return failure('invalid_priority');

  return parsed;
}

/**
 * Adds a role without mutating the input. When requestedPercentage is omitted,
 * all unlocked rows receive an equal share (the editor's historic behavior).
 * When supplied, that exact rounded hundredth is reserved for the new role and
 * the existing unlocked rows are resized proportionally.
 */
export function addRoleAllocation(
  input: readonly RoleAllocationDraft[],
  roleName: string,
  requestedPercentage?: number,
): RoleAllocationResult {
  const parsed = validatedSnapshotToParsed(input);
  if (parsed.ok === false) return parsed;
  if (parsed.allocations.length >= MAX_ROLE_ALLOCATIONS) return failure('too_many_roles');

  const role = canonicalizeRoleName(roleName);
  if (role.ok === false) return role;
  if (
    parsed.allocations.some(
      allocation => allocation.business_role.toLowerCase() === role.key,
    )
  ) {
    return failure('duplicate_role', role.name);
  }

  const lockedTotal = parsed.allocations.reduce(
    (sum, allocation) => sum + (allocation.locked ? allocation.units : 0),
    0,
  );
  const availableUnits = TOTAL_HUNDREDTHS - lockedTotal;
  const existingUnlocked = parsed.allocations.filter(allocation => !allocation.locked);

  let newRoleUnits: number;
  let existingUnits: number[];
  if (requestedPercentage === undefined) {
    const equal = distributeUnits(availableUnits, [
      ...existingUnlocked.map(() => 1),
      1,
    ]);
    newRoleUnits = equal[equal.length - 1];
    existingUnits = equal.slice(0, -1);
  } else {
    const requestedUnits = percentageToUnits(requestedPercentage);
    if (requestedUnits === undefined) return failure('invalid_percentage', role.name);
    if (requestedUnits > availableUnits) return failure('locked_total_exceeds_100', role.name);
    if (existingUnlocked.length === 0 && requestedUnits !== availableUnits) {
      return failure('unallocatable_remainder', role.name);
    }

    newRoleUnits = requestedUnits;
    existingUnits = distributeUnits(
      availableUnits - newRoleUnits,
      existingUnlocked.map(allocation => allocation.units),
    );
  }

  let existingIndex = 0;
  const next: ParsedAllocation[] = parsed.allocations.map(allocation =>
    allocation.locked
      ? { ...allocation }
      : { ...allocation, units: existingUnits[existingIndex++] },
  );
  next.push({
    business_role: role.name,
    units: newRoleUnits,
    locked: false,
    is_priority: next.length === 0,
  });

  return normalizeParsed(next);
}

export function removeRoleAllocation(
  input: readonly RoleAllocationDraft[],
  roleName: string,
): RoleAllocationResult {
  const parsed = validatedSnapshotToParsed(input);
  if (parsed.ok === false) return parsed;

  const role = canonicalizeRoleName(roleName);
  if (role.ok === false) return role;
  const removeIndex = parsed.allocations.findIndex(
    allocation => allocation.business_role.toLowerCase() === role.key,
  );
  if (removeIndex < 0) return failure('role_not_found', role.name);

  const removedWasPriority = parsed.allocations[removeIndex].is_priority;
  const next = parsed.allocations
    .filter((_, index) => index !== removeIndex)
    .map(allocation => ({ ...allocation }));
  if (next.length === 0) return { ok: true, allocations: [] };

  const lockedTotal = next.reduce(
    (sum, allocation) => sum + (allocation.locked ? allocation.units : 0),
    0,
  );
  const unlocked = next.filter(allocation => !allocation.locked);
  if (unlocked.length === 0 && lockedTotal !== TOTAL_HUNDREDTHS) {
    return failure('unallocatable_remainder', role.name);
  }

  const redistributed = distributeUnits(
    TOTAL_HUNDREDTHS - lockedTotal,
    unlocked.map(() => 1),
  );
  let unlockedIndex = 0;
  next.forEach(allocation => {
    if (!allocation.locked) allocation.units = redistributed[unlockedIndex++];
  });

  if (removedWasPriority) {
    next.forEach((allocation, index) => {
      allocation.is_priority = index === 0;
    });
  }

  return normalizeParsed(next);
}

export function setRoleAllocationPercentage(
  input: readonly RoleAllocationDraft[],
  roleName: string,
  percentage: number,
): RoleAllocationResult {
  const parsed = validatedSnapshotToParsed(input);
  if (parsed.ok === false) return parsed;

  const role = canonicalizeRoleName(roleName);
  if (role.ok === false) return role;
  const targetIndex = parsed.allocations.findIndex(
    allocation => allocation.business_role.toLowerCase() === role.key,
  );
  if (targetIndex < 0) return failure('role_not_found', role.name);
  if (parsed.allocations[targetIndex].locked) return failure('locked_role', role.name);

  const requestedUnits = percentageToUnits(percentage);
  if (requestedUnits === undefined) return failure('invalid_percentage', role.name);

  const lockedTotal = parsed.allocations.reduce(
    (sum, allocation) => sum + (allocation.locked ? allocation.units : 0),
    0,
  );
  const availableUnits = TOTAL_HUNDREDTHS - lockedTotal;
  if (requestedUnits > availableUnits) return failure('locked_total_exceeds_100', role.name);

  const otherUnlocked = parsed.allocations.filter(
    (_, index) => index !== targetIndex && !parsed.allocations[index].locked,
  );
  if (otherUnlocked.length === 0 && requestedUnits !== availableUnits) {
    return failure('unallocatable_remainder', role.name);
  }

  const redistributed = distributeUnits(
    availableUnits - requestedUnits,
    otherUnlocked.map(allocation => allocation.units),
  );
  let redistributedIndex = 0;
  const next = parsed.allocations.map((allocation, index) => {
    if (index === targetIndex) return { ...allocation, units: requestedUnits };
    if (allocation.locked) return { ...allocation };
    return { ...allocation, units: redistributed[redistributedIndex++] };
  });

  return normalizeParsed(next);
}

export function toggleRoleAllocationLock(
  input: readonly RoleAllocationDraft[],
  roleName: string,
): RoleAllocationResult {
  const parsed = validatedSnapshotToParsed(input);
  if (parsed.ok === false) return parsed;

  const role = canonicalizeRoleName(roleName);
  if (role.ok === false) return role;
  const targetIndex = parsed.allocations.findIndex(
    allocation => allocation.business_role.toLowerCase() === role.key,
  );
  if (targetIndex < 0) return failure('role_not_found', role.name);

  const next = parsed.allocations.map((allocation, index) =>
    index === targetIndex ? { ...allocation, locked: !allocation.locked } : { ...allocation },
  );
  return normalizeParsed(next);
}

export function setRoleAllocationPriority(
  input: readonly RoleAllocationDraft[],
  roleName: string,
): RoleAllocationResult {
  const parsed = validatedSnapshotToParsed(input);
  if (parsed.ok === false) return parsed;

  const role = canonicalizeRoleName(roleName);
  if (role.ok === false) return role;
  const targetIndex = parsed.allocations.findIndex(
    allocation => allocation.business_role.toLowerCase() === role.key,
  );
  if (targetIndex < 0) return failure('role_not_found', role.name);

  const next = parsed.allocations.map((allocation, index) => ({
    ...allocation,
    is_priority: index === targetIndex,
  }));
  return normalizeParsed(next);
}
