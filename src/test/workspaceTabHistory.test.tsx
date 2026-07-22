import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { setWorkspaceTabSearchParam } from '@/lib/workspaceTabs';

function HistoryHarness() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname}{location.search}</output>
      <button
        type="button"
        onClick={() => setWorkspaceTabSearchParam(
          searchParams,
          setSearchParams,
          'workspace-a',
          'members',
          { replace: true },
        )}
      >
        Repair hidden tab
      </button>
      <button
        type="button"
        onClick={() => setWorkspaceTabSearchParam(
          searchParams,
          setSearchParams,
          'workspace-a',
          'calendar',
        )}
      >
        User tab change
      </button>
      <button type="button" onClick={() => navigate(-1)}>Back</button>
    </>
  );
}

function renderHistory(initialEntries: string[], initialIndex: number) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <Routes>
        <Route path="*" element={<HistoryHarness />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('workspace tab history semantics', () => {
  it('replaces an unauthorized deep link so Back cannot re-enter it', async () => {
    renderHistory(['/before', '/w/workspace-a?tab=security'], 1);

    fireEvent.click(screen.getByRole('button', { name: 'Repair hidden tab' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
      '/w/workspace-a?tab=members',
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/before'));
    expect(screen.getByTestId('location')).not.toHaveTextContent('tab=security');
  });

  it('keeps normal user tab navigation as a history push', async () => {
    renderHistory(['/w/workspace-a?tab=members'], 0);

    fireEvent.click(screen.getByRole('button', { name: 'User tab change' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
      '/w/workspace-a?tab=calendar',
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
      '/w/workspace-a?tab=members',
    ));
  });
});
