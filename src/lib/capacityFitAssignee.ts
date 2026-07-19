export interface CapacityFitMemberIdentity {
  display_name: string | null;
}

export interface CapacityFitProviderAssignee {
  assignee_name: string | null;
  assignee_email?: string | null;
}

export interface CapacityFitIssueRow {
  assignee_email: string | null;
  assignee_name: string | null;
  story_points: number | null;
  original_estimate_hours: number | null;
  remaining_hours: number | null;
  sprint_name: string | null;
  iteration_path: string | null;
  status: string | null;
}

export type CapacityFitAssigneeMatcher = (
  assignee: CapacityFitProviderAssignee,
) => number | null;

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNonNegativeNumber(value: unknown): value is number | null {
  return value === null || (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
  );
}

function isCapacityFitIssueRow(value: unknown): value is CapacityFitIssueRow {
  if (typeof value !== 'object' || value === null) return false;
  const issue = value as Record<string, unknown>;
  return isNullableString(issue.assignee_email)
    && isNullableString(issue.assignee_name)
    && isNullableNonNegativeNumber(issue.story_points)
    && isNullableNonNegativeNumber(issue.original_estimate_hours)
    && isNullableNonNegativeNumber(issue.remaining_hours)
    && isNullableString(issue.sprint_name)
    && isNullableString(issue.iteration_path)
    && isNullableString(issue.status);
}

export function parseCapacityFitIssueSearchResponse(
  value: unknown,
): { issues: CapacityFitIssueRow[]; count: number } | null {
  if (typeof value !== 'object' || value === null) return null;
  const response = value as Record<string, unknown>;
  if (response.ok !== true || !Array.isArray(response.issues)) return null;
  if (!response.issues.every(isCapacityFitIssueRow)) return null;
  if (
    typeof response.count !== 'number'
    || !Number.isSafeInteger(response.count)
    || response.count !== response.issues.length
    || response.count > 200
  ) {
    return null;
  }
  return { issues: response.issues, count: response.count };
}

export function normalizeCapacityFitDisplayName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase();

  return normalized || null;
}

/**
 * Builds a matcher that resolves provider assignees only when their normalized
 * display name identifies exactly one active workspace member.
 *
 * Provider e-mail is intentionally ignored: the browser receives no internal
 * member e-mail directory, so an e-mail-only assignee must remain unmatched.
 */
export function createUniqueCapacityFitAssigneeMatcher(
  members: readonly CapacityFitMemberIdentity[],
): CapacityFitAssigneeMatcher {
  const memberIndexesByName = new Map<string, number[]>();

  members.forEach((member, memberIndex) => {
    const normalizedName = normalizeCapacityFitDisplayName(member.display_name);
    if (normalizedName === null) return;

    const indexes = memberIndexesByName.get(normalizedName);
    if (indexes) {
      indexes.push(memberIndex);
    } else {
      memberIndexesByName.set(normalizedName, [memberIndex]);
    }
  });

  return ({ assignee_name }) => {
    const normalizedName = normalizeCapacityFitDisplayName(assignee_name);
    if (normalizedName === null) return null;

    const matchingIndexes = memberIndexesByName.get(normalizedName);
    return matchingIndexes?.length === 1 ? matchingIndexes[0] : null;
  };
}
