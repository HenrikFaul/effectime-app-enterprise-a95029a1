import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compareReleaseIdentities,
  getEdgeReleaseIdentity,
  getWebReleaseIdentity,
  parseReleaseIdentity,
} from '@/config/releaseIdentity';

const SHA_A = '0123456789abcdef0123456789abcdef01234567';
const SHA_B = '89abcdef0123456789abcdef0123456789abcdef';
const SOURCE_A = 'a'.repeat(64);
const SOURCE_B = 'b'.repeat(64);
const UNKNOWN = { sha: null, sourceTreeSha256: null, status: 'unknown' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('release identity parser', () => {
  it('accepts only a normalized full Git SHA', () => {
    expect(parseReleaseIdentity(SHA_A, SOURCE_A)).toEqual({
      sha: SHA_A,
      sourceTreeSha256: SOURCE_A,
      status: 'identified',
    });

    for (const invalid of [
      undefined,
      null,
      '',
      'unknown',
      SHA_A.slice(0, 12),
      SHA_A.toUpperCase(),
      `${SHA_A}-dirty`,
    ]) {
      expect(parseReleaseIdentity(invalid, SOURCE_A)).toEqual(UNKNOWN);
    }
    expect(parseReleaseIdentity(SHA_A, 'invalid')).toEqual(UNKNOWN);
  });

  it('reads the Vite-injected web SHA and fails visibly when it is absent', () => {
    expect(getWebReleaseIdentity()).toEqual(UNKNOWN);

    vi.stubGlobal('__EFFECTIME_RELEASE_SHA__', SHA_A);
    expect(getWebReleaseIdentity()).toEqual(UNKNOWN);

    vi.stubGlobal('__EFFECTIME_RELEASE_ATTESTABLE__', true);
    expect(getWebReleaseIdentity()).toEqual(UNKNOWN);

    vi.stubGlobal('__EFFECTIME_EDGE_SOURCE_SHA256__', SOURCE_A);
    expect(getWebReleaseIdentity()).toEqual({
      sha: SHA_A,
      sourceTreeSha256: SOURCE_A,
      status: 'identified',
    });
  });

  it('does not attest a SHA compiled from a dirty worktree', () => {
    vi.stubGlobal('__EFFECTIME_RELEASE_SHA__', SHA_A);
    vi.stubGlobal('__EFFECTIME_RELEASE_ATTESTABLE__', false);
    vi.stubGlobal('__EFFECTIME_EDGE_SOURCE_SHA256__', SOURCE_A);
    expect(getWebReleaseIdentity()).toEqual(UNKNOWN);
  });

  it('accepts only the canonical status-bearing Edge response', () => {
    expect(getEdgeReleaseIdentity({
      release: { sha: SHA_A, sourceTreeSha256: SOURCE_A, status: 'identified' },
    })).toEqual({ sha: SHA_A, sourceTreeSha256: SOURCE_A, status: 'identified' });
    expect(getEdgeReleaseIdentity({ release_sha: SHA_B }))
      .toEqual(UNKNOWN);
    expect(getEdgeReleaseIdentity({
      release: { sha: 'invalid', sourceTreeSha256: SOURCE_A, status: 'identified' },
    })).toEqual(UNKNOWN);
    expect(getEdgeReleaseIdentity({
      release: { sha: SHA_A, sourceTreeSha256: SOURCE_A, status: 'unknown' },
    })).toEqual(UNKNOWN);
    expect(getEdgeReleaseIdentity({ release: { sha: SHA_A } }))
      .toEqual(UNKNOWN);
  });

  it('reports match, mismatch and unknown from validated identities', () => {
    const a = parseReleaseIdentity(SHA_A, SOURCE_A);
    const b = parseReleaseIdentity(SHA_B, SOURCE_A);
    const staleSource = parseReleaseIdentity(SHA_A, SOURCE_B);
    const unknown = parseReleaseIdentity(undefined, SOURCE_A);

    expect(compareReleaseIdentities(a, a)).toBe('match');
    expect(compareReleaseIdentities(a, b)).toBe('mismatch');
    expect(compareReleaseIdentities(a, staleSource)).toBe('mismatch');
    expect(compareReleaseIdentities(a, unknown)).toBe('unknown');
    expect(compareReleaseIdentities(unknown, unknown)).toBe('unknown');
  });
});
