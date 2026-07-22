import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportCenter } from '@/components/enterprise/ExportCenter';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  loadFilters: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  download: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/legacyLeaveExport', () => ({
  executeLegacyLeaveExport: mocks.execute,
  loadLegacyLeaveExportFilterOptions: mocks.loadFilters,
}));
vi.mock('@/components/enterprise/import-export/utils/file-parser', () => ({
  downloadFile: mocks.download,
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/i18n/I18nProvider', () => ({
  useDateLocale: () => undefined,
  useI18n: () => ({
    t: (key: string) => key === 'export_center.dow'
      ? 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday'
      : key,
  }),
}));
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date) => void }) => (
    <button
      type="button"
      data-testid="select-date"
      onClick={() => onSelect?.(new Date(2026, 6, 13, 12))}
    >
      select date
    </button>
  ),
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const WORKSPACE_A = '11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID_B = '44444444-4444-4444-8444-444444444444';

describe('ExportCenter request ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFilters.mockResolvedValue({ teams: [], roles: [] });
  });

  it('uses a synchronous single-flight guard for rapid duplicate clicks', async () => {
    let finish: ((value: { rowCount: number; artifact: object }) => void) | undefined;
    mocks.execute.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<ExportCenter workspaceId={WORKSPACE_A} userId={USER_ID} />);
    const dateButtons = screen.getAllByTestId('select-date');
    fireEvent.click(dateButtons[0]);
    fireEvent.click(dateButtons[1]);

    const exportButton = screen.getByRole('button', { name: /export_center\.btn_download/ });
    act(() => {
      exportButton.click();
      exportButton.click();
    });

    expect(mocks.execute).toHaveBeenCalledOnce();
    await act(async () => {
      finish?.({ rowCount: 1, artifact: {} });
    });
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('invalidates the old tenant callback synchronously on workspace change', () => {
    mocks.execute.mockImplementation(() => new Promise(() => undefined));
    const view = render(<ExportCenter workspaceId={WORKSPACE_A} userId={USER_ID} />);
    const dateButtons = screen.getAllByTestId('select-date');
    fireEvent.click(dateButtons[0]);
    fireEvent.click(dateButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: /export_center\.btn_download/ }));

    const isCurrent = mocks.execute.mock.calls[0][4] as () => boolean;
    expect(isCurrent()).toBe(true);
    view.rerender(<ExportCenter workspaceId={WORKSPACE_B} userId={USER_ID} />);
    expect(isCurrent()).toBe(false);
  });

  it('invalidates the old actor callback without relying on a workspace change', () => {
    mocks.execute.mockImplementation(() => new Promise(() => undefined));
    const view = render(<ExportCenter workspaceId={WORKSPACE_A} userId={USER_ID} />);
    const dateButtons = screen.getAllByTestId('select-date');
    fireEvent.click(dateButtons[0]);
    fireEvent.click(dateButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: /export_center\.btn_download/ }));

    const isCurrent = mocks.execute.mock.calls[0][4] as () => boolean;
    expect(isCurrent()).toBe(true);
    view.rerender(<ExportCenter workspaceId={WORKSPACE_A} userId={USER_ID_B} />);
    expect(isCurrent()).toBe(false);
  });
});
