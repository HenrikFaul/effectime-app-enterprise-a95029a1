import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGate } from './FeatureGate';

const mocks = vi.hoisted(() => ({
  useEnabledFeatures: vi.fn(),
}));

vi.mock('@/hooks/useFeature', () => ({
  useEnabledFeatures: mocks.useEnabledFeatures,
}));

function setGateState({
  enabled = false,
  isLoading = false,
  isError = false,
}: {
  enabled?: boolean;
  isLoading?: boolean;
  isError?: boolean;
} = {}) {
  mocks.useEnabledFeatures.mockReturnValue({
    isEnabled: () => enabled,
    isLoading,
    isError,
    features: enabled ? [{ feature_key: 'target', source: 'tier' }] : [],
  });
}

function renderGate({
  workspaceId = 'workspace-1',
  showFallbackWhileLoading = false,
}: {
  workspaceId?: string | null;
  showFallbackWhileLoading?: boolean;
} = {}) {
  return renderToStaticMarkup(
    <FeatureGate
      workspaceId={workspaceId}
      feature="target"
      fallback={<span>locked</span>}
      showFallbackWhileLoading={showFallbackWhileLoading}
    >
      <span>protected</span>
    </FeatureGate>,
  );
}

describe('FeatureGate fail-closed behavior', () => {
  beforeEach(() => {
    mocks.useEnabledFeatures.mockReset();
    setGateState();
  });

  it('does not flash children while entitlements are loading', () => {
    setGateState({ enabled: true, isLoading: true });

    const html = renderGate();

    expect(html).not.toContain('protected');
    expect(html).not.toContain('locked');
  });

  it('can render the fallback while loading without exposing children', () => {
    setGateState({ enabled: true, isLoading: true });

    const html = renderGate({ showFallbackWhileLoading: true });

    expect(html).toContain('locked');
    expect(html).not.toContain('protected');
  });

  it('denies access when the entitlement result is empty', () => {
    const html = renderGate();

    expect(html).toContain('locked');
    expect(html).not.toContain('protected');
  });

  it('denies access on lookup errors even when stale data says enabled', () => {
    setGateState({ enabled: true, isError: true });

    const html = renderGate();

    expect(html).toContain('locked');
    expect(html).not.toContain('protected');
  });

  it('denies access when no workspace is selected', () => {
    setGateState({ enabled: true });

    const html = renderGate({ workspaceId: null });

    expect(html).toContain('locked');
    expect(html).not.toContain('protected');
  });

  it('renders children only for an enabled feature', () => {
    setGateState({ enabled: true });

    const html = renderGate();

    expect(html).toContain('protected');
    expect(html).not.toContain('locked');
  });
});
