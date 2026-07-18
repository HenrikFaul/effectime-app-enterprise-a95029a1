import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReleaseIdentityStatus } from '@/components/superadmin/ReleaseIdentityStatus';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'superadmin.release_title': 'Release identity',
      'superadmin.release_web': 'Web artifact',
      'superadmin.release_edge': 'Edge runtime',
      'superadmin.release_expected_edge_source': 'Expected Edge source',
      'superadmin.release_observed_edge_source': 'Observed Edge source',
      'superadmin.release_checking': 'Checking',
      'superadmin.release_match': 'Matched',
      'superadmin.release_mismatch': 'Mismatch',
      'superadmin.release_unknown': 'Unknown',
      'superadmin.release_mismatch_detail': 'Release validation must fail.',
      'superadmin.release_edge_error': 'The Edge release identity could not be verified.',
      'superadmin.release_retry': 'Retry check',
    }[key] ?? key),
  }),
}));

const SHA_A = '0123456789abcdef0123456789abcdef01234567';
const SHA_B = '89abcdef0123456789abcdef0123456789abcdef';
const SOURCE_A = 'a'.repeat(64);
const SOURCE_B = 'b'.repeat(64);
const invoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
  vi.stubGlobal('__EFFECTIME_RELEASE_SHA__', SHA_A);
  vi.stubGlobal('__EFFECTIME_RELEASE_ATTESTABLE__', true);
  vi.stubGlobal('__EFFECTIME_EDGE_SOURCE_SHA256__', SOURCE_A);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ReleaseIdentityStatus', () => {
  it('shows the exact SHAs and a match only when both runtimes agree', async () => {
    invoke.mockResolvedValue({
      data: {
        release: { sha: SHA_A, sourceTreeSha256: SOURCE_A, status: 'identified' },
      },
      error: null,
    } as never);

    render(<ReleaseIdentityStatus />);

    expect(await screen.findByText('Matched')).toBeInTheDocument();
    expect(screen.getByTestId('web-release-sha')).toHaveTextContent(SHA_A);
    expect(screen.getByTestId('edge-release-sha')).toHaveTextContent(SHA_A);
    expect(screen.getByTestId('web-edge-source-sha')).toHaveTextContent(SOURCE_A);
    expect(screen.getByTestId('edge-source-sha')).toHaveTextContent(SOURCE_A);
    expect(invoke).toHaveBeenCalledWith('superadmin-hub', {
      body: { action: 'platform-version' },
    });
  });

  it('makes a same-environment mismatch prominent and fail-visible', async () => {
    invoke.mockResolvedValue({
      data: {
        release: { sha: SHA_B, sourceTreeSha256: SOURCE_A, status: 'identified' },
      },
      error: null,
    } as never);

    render(<ReleaseIdentityStatus />);

    expect(await screen.findByText('Mismatch')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Release validation must fail.');
    expect(screen.getByTestId('edge-release-sha')).toHaveTextContent(SHA_B);
  });

  it('fails visibly when the Git SHA matches but the Edge source tree is stale', async () => {
    invoke.mockResolvedValue({
      data: {
        release: { sha: SHA_A, sourceTreeSha256: SOURCE_B, status: 'identified' },
      },
      error: null,
    } as never);

    render(<ReleaseIdentityStatus />);

    expect(await screen.findByText('Mismatch')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Release validation must fail.');
    expect(screen.getByTestId('edge-source-sha')).toHaveTextContent(SOURCE_B);
  });

  it('never presents an unavailable Edge identity as a successful match', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new Error('network unavailable'),
    } as never);

    render(<ReleaseIdentityStatus />);

    expect(await screen.findByText('The Edge release identity could not be verified.'))
      .toBeInTheDocument();
    expect(screen.getByTestId('edge-release-sha')).toHaveTextContent('Unknown');
    expect(screen.queryByText('Matched')).not.toBeInTheDocument();

    invoke.mockResolvedValue({
      data: {
        release: { sha: SHA_A, sourceTreeSha256: SOURCE_A, status: 'identified' },
      },
      error: null,
    } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Retry check' }));

    await waitFor(() => expect(screen.getByText('Matched')).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
