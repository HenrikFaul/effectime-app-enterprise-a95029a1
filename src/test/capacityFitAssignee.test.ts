import { describe, expect, it } from 'vitest';
import {
  createUniqueCapacityFitAssigneeMatcher,
  parseCapacityFitIssueSearchResponse,
} from '@/lib/capacityFitAssignee';

const VALID_ISSUE = {
  assignee_email: null,
  assignee_name: 'Anna Kovács',
  story_points: 3,
  original_estimate_hours: null,
  remaining_hours: 8,
  sprint_name: 'Sprint 24',
  iteration_path: null,
  status: 'In progress',
};

describe('createUniqueCapacityFitAssigneeMatcher', () => {
  it('normalizes name casing and whitespace before matching', () => {
    const match = createUniqueCapacityFitAssigneeMatcher([
      { display_name: 'Alice Smith' },
    ]);

    expect(match({ assignee_name: '  ALICE   smith  ' })).toBe(0);
  });

  it('returns the index of exactly one matching member', () => {
    const match = createUniqueCapacityFitAssigneeMatcher([
      { display_name: 'Anna Kovács' },
      { display_name: 'Béla Nagy' },
    ]);

    expect(match({ assignee_name: 'Béla Nagy' })).toBe(1);
  });

  it('fails closed when more than one member has the normalized name', () => {
    const match = createUniqueCapacityFitAssigneeMatcher([
      { display_name: 'Anna Kovács' },
      { display_name: '  ANNA   KOVÁCS ' },
      { display_name: 'Béla Nagy' },
    ]);

    expect(match({ assignee_name: 'Anna Kovács' })).toBeNull();
    expect(match({ assignee_name: 'Béla Nagy' })).toBe(2);
  });

  it('does not index empty member names or match empty assignee names', () => {
    const match = createUniqueCapacityFitAssigneeMatcher([
      { display_name: null },
      { display_name: '   ' },
    ]);

    expect(match({ assignee_name: null })).toBeNull();
    expect(match({ assignee_name: '   ' })).toBeNull();
  });

  it('keeps an e-mail-only provider assignee unmatched', () => {
    const match = createUniqueCapacityFitAssigneeMatcher([
      { display_name: 'member@example.com' },
    ]);

    expect(match({ assignee_name: null, assignee_email: 'member@example.com' })).toBeNull();
  });

  it('accepts only a bounded, internally consistent issue-search response', () => {
    expect(parseCapacityFitIssueSearchResponse({
      ok: true,
      count: 1,
      issues: [VALID_ISSUE],
    })).toEqual({ count: 1, issues: [VALID_ISSUE] });

    expect(parseCapacityFitIssueSearchResponse({
      ok: true,
      count: 2,
      issues: [VALID_ISSUE],
    })).toBeNull();
  });

  it('rejects provider error bodies and malformed numeric fields without exposing details', () => {
    expect(parseCapacityFitIssueSearchResponse({
      ok: false,
      error: 'private provider detail',
    })).toBeNull();
    expect(parseCapacityFitIssueSearchResponse({
      ok: true,
      count: 1,
      issues: [{ ...VALID_ISSUE, story_points: Number.POSITIVE_INFINITY }],
    })).toBeNull();
  });
});
