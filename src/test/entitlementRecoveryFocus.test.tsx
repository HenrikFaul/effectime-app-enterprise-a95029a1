import { useRef } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveEntitlementSurfaceState,
  useEntitlementRecoveryFocus,
} from '@/hooks/useEntitlementRecoveryFocus';

function FocusHarness({
  contextKey,
  featureAccessAvailable,
  showRecovery,
}: {
  contextKey: string;
  featureAccessAvailable: boolean;
  showRecovery: boolean;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const requestFocusRestore = useEntitlementRecoveryFocus(
    contextKey,
    featureAccessAvailable,
    showRecovery,
    targetRef,
  );

  return (
    <>
      {showRecovery && (
        <button type="button" onClick={requestFocusRestore}>Retry</button>
      )}
      <div id="main-content" ref={targetRef} data-testid="main-content" tabIndex={-1}>
        Workspace content
      </div>
    </>
  );
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('entitlement recovery focus and surface state', () => {
  it.each([
    [false, false, false],
    [false, true, false],
    [false, false, true],
    [false, true, true],
    [true, false, false],
    [true, true, false],
    [true, false, true],
    [true, true, true],
  ])('never exposes business content and recovery together (%s, %s, %s)', (
    featuresSuccess,
    featuresError,
    entitlementRetrying,
  ) => {
    const state = resolveEntitlementSurfaceState(
      featuresSuccess,
      featuresError,
      entitlementRetrying,
    );
    expect(state.featureAccessAvailable && state.showRecovery).toBe(false);
  });

  it('moves focus from the unmounted retry control to main content after success', async () => {
    const view = render(
      <FocusHarness
        contextKey="workspace-a:user-a"
        featureAccessAvailable={false}
        showRecovery
      />,
    );
    const retry = screen.getByRole('button', { name: 'Retry' });
    retry.focus();
    fireEvent.click(retry);

    view.rerender(
      <FocusHarness
        contextKey="workspace-a:user-a"
        featureAccessAvailable
        showRecovery={false}
      />,
    );

    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('main-content')));
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('keeps focus in recovery after a failed retry', () => {
    const view = render(
      <FocusHarness
        contextKey="workspace-a:user-a"
        featureAccessAvailable={false}
        showRecovery
      />,
    );
    const retry = screen.getByRole('button', { name: 'Retry' });
    retry.focus();
    fireEvent.click(retry);

    view.rerender(
      <FocusHarness
        contextKey="workspace-a:user-a"
        featureAccessAvailable={false}
        showRecovery
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry' }));
    expect(document.activeElement).not.toBe(screen.getByTestId('main-content'));
  });

  it('invalidates a pending focus restoration when the actor or workspace changes', () => {
    const view = render(
      <FocusHarness
        contextKey="workspace-a:user-a"
        featureAccessAvailable={false}
        showRecovery
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    view.rerender(
      <FocusHarness
        contextKey="workspace-b:user-a"
        featureAccessAvailable={false}
        showRecovery
      />,
    );
    view.rerender(
      <FocusHarness
        contextKey="workspace-b:user-a"
        featureAccessAvailable
        showRecovery={false}
      />,
    );

    expect(document.activeElement).not.toBe(screen.getByTestId('main-content'));
  });

  it('cancels a queued focus frame when the entitlement context changes', () => {
    const queuedFrames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      const id = nextFrame;
      nextFrame += 1;
      queuedFrames.set(id, callback);
      return id;
    });
    vi.mocked(window.cancelAnimationFrame).mockImplementation((id) => {
      queuedFrames.delete(id);
    });

    const view = render(
      <FocusHarness
        contextKey="workspace-a:user-a"
        featureAccessAvailable={false}
        showRecovery
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    view.rerender(
      <FocusHarness
        contextKey="workspace-a:user-a"
        featureAccessAvailable
        showRecovery={false}
      />,
    );
    expect(queuedFrames.size).toBe(1);

    view.rerender(
      <FocusHarness
        contextKey="workspace-b:user-a"
        featureAccessAvailable
        showRecovery={false}
      />,
    );

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(queuedFrames.size).toBe(0);
    expect(document.activeElement).not.toBe(screen.getByTestId('main-content'));
  });
});
