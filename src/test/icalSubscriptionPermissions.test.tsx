import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ICalSubscription } from '@/components/enterprise/ICalSubscription';

const { deleteToken, from, insertToken, loadRows, t, toastError, toastSuccess } = vi.hoisted(() => ({
  deleteToken: vi.fn(),
  from: vi.fn(),
  insertToken: vi.fn(),
  loadRows: { current: [] as Array<{ id: string; token: string; scope: 'own' | 'team' }> },
  t: (key: string) => key,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));

beforeEach(() => {
  loadRows.current = [];
  insertToken.mockResolvedValue({ error: null });
  deleteToken.mockResolvedValue({ error: null });
  from.mockImplementation(() => ({
    select: vi.fn(() => {
      let equalityCount = 0;
      const query = {
        eq: vi.fn(() => {
          equalityCount += 1;
          return equalityCount === 2
            ? Promise.resolve({ data: loadRows.current, error: null })
            : query;
        }),
      };
      return query;
    }),
    insert: insertToken,
    delete: vi.fn(() => ({ eq: deleteToken })),
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('iCal subscription role boundary', () => {
  it('shows only the personal feed action to a regular member', async () => {
    loadRows.current = [{ id: 'own-token', token: 'own-secret-token', scope: 'own' }];
    render(
      <ICalSubscription
        workspaceId="workspace-a"
        userId="member-a"
        canUseIcalFeed
        canCreateTeamFeed={false}
      />,
    );

    const ownCreate = screen.getByRole('button', { name: 'ical_subscription.btn_own' });
    expect(ownCreate).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ical_subscription.btn_team' })).not.toBeInTheDocument();
    fireEvent.click(ownCreate);
    await waitFor(() => expect(insertToken).toHaveBeenCalledWith({
      workspace_id: 'workspace-a',
      user_id: 'member-a',
      scope: 'own',
    }));
    expect(insertToken).not.toHaveBeenCalledWith(expect.objectContaining({ scope: 'team' }));
    expect(await screen.findByRole('textbox', { name: 'ical_subscription.feed_url' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ical_subscription.copy_url' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ical_subscription.delete_feed' })).toBeInTheDocument();
    await waitFor(() => expect(from).toHaveBeenCalledWith('enterprise_ical_tokens'));
  });

  it('shows the team feed action to a workspace administrator', async () => {
    render(
      <ICalSubscription
        workspaceId="workspace-a"
        userId="admin-a"
        canUseIcalFeed
        canCreateTeamFeed
      />,
    );

    expect(screen.getByRole('button', { name: 'ical_subscription.btn_own' })).toBeInTheDocument();
    const teamCreate = screen.getByRole('button', { name: 'ical_subscription.btn_team' });
    expect(teamCreate).toBeInTheDocument();
    fireEvent.click(teamCreate);
    await waitFor(() => expect(insertToken).toHaveBeenCalledWith({
      workspace_id: 'workspace-a',
      user_id: 'admin-a',
      scope: 'team',
    }));
    await waitFor(() => expect(from).toHaveBeenCalledWith('enterprise_ical_tokens'));
  });

  it('keeps a dormant team token revocable without exposing its bearer URL', async () => {
    loadRows.current = [{ id: 'team-token', token: 'secret-team-token', scope: 'team' }];

    render(
      <ICalSubscription
        workspaceId="workspace-a"
        userId="member-a"
        canUseIcalFeed={false}
        canCreateTeamFeed={false}
      />,
    );

    const revoke = await screen.findByRole('button', { name: 'ical_subscription.delete_feed' });
    expect(screen.queryByRole('button', { name: 'ical_subscription.btn_own' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ical_subscription.btn_team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ical_subscription.copy_url' })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/secret-team-token/)).not.toBeInTheDocument();

    fireEvent.click(revoke);
    await waitFor(() => expect(deleteToken).toHaveBeenCalledWith('id', 'team-token'));
  });

  it('hides an existing bearer immediately when the entitlement is downgraded', async () => {
    loadRows.current = [{ id: 'own-token', token: 'downgrade-secret', scope: 'own' }];
    const view = render(
      <ICalSubscription
        workspaceId="workspace-a"
        userId="member-a"
        canUseIcalFeed
        canCreateTeamFeed={false}
      />,
    );
    expect(await screen.findByDisplayValue(/downgrade-secret/)).toBeInTheDocument();

    view.rerender(
      <ICalSubscription
        workspaceId="workspace-a"
        userId="member-a"
        canUseIcalFeed={false}
        canCreateTeamFeed={false}
      />,
    );

    expect(screen.queryByDisplayValue(/downgrade-secret/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ical_subscription.copy_url' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ical_subscription.delete_feed' })).toBeInTheDocument();
  });
});
