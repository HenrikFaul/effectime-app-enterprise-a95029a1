import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityConfig } from '@/components/enterprise/import-export/config/entity-registry';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/components/enterprise/import-export/utils/entity-export', () => ({
  executeEntityExport: mocks.execute,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/components/enterprise/import-export/utils/data-fetcher', () => ({
  fetchEntityRows: vi.fn(),
}));

vi.mock('@/components/enterprise/import-export/utils/file-parser', () => ({
  generateCSV: vi.fn(),
  generateExcelXML: vi.fn(),
  downloadFile: vi.fn(),
}));

vi.mock('@/components/enterprise/import-export/utils/validator', () => ({
  buildTemplateGuidanceRow: vi.fn(),
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string, values?: { count?: number }) => (
      typeof values?.count === 'number' ? `${key}:${values.count}` : key
    ),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
  },
}));

import { ExportWizard } from '@/components/enterprise/import-export/ExportWizard';

const entity = {
  key: 'members',
  label: 'Members',
  fields: [
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      importable: true,
      exportable: true,
      group: 'Basic',
    },
  ],
} as EntityConfig;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const result = {
  artifact: {
    content: 'artifact',
    fileName: 'effectime_members_20260722.xls',
    mimeType: 'application/vnd.ms-excel',
  },
  fieldCount: 1,
  rowCount: 1,
};

function props(overrides: Partial<React.ComponentProps<typeof ExportWizard>> = {}) {
  return {
    entity,
    workspaceId: 'workspace-1',
    userId: 'user-1',
    onClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
});

afterEach(cleanup);

describe('ExportWizard request boundary', () => {
  it('uses a synchronous single-flight token and exposes busy and label state', async () => {
    const operation = deferred<typeof result>();
    mocks.execute.mockReturnValue(operation.promise);
    const onClose = vi.fn();
    const view = render(<ExportWizard {...props({ onClose })} />);

    const formatLabel = screen.getByText('export_wizard.format_label');
    const formatTrigger = screen.getByRole('combobox');
    expect(formatLabel.id).toBeTruthy();
    expect(formatTrigger).toHaveAttribute('aria-labelledby', formatLabel.id);
    expect(view.container.firstElementChild).toHaveAttribute('aria-busy', 'false');

    const downloadButton = screen.getByRole('button', { name: 'export_wizard.btn_download' });
    fireEvent.click(downloadButton);
    fireEvent.click(downloadButton);

    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(view.container.firstElementChild).toHaveAttribute('aria-busy', 'true');

    await act(async () => operation.resolve(result));

    expect(mocks.success).toHaveBeenCalledWith('export_wizard.export_ready:1');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not let a stale finally handler unlock or close a newer scope operation', async () => {
    const first = deferred<typeof result>();
    const second = deferred<typeof result>();
    mocks.execute
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const view = render(<ExportWizard {...props({ onClose: firstClose })} />);

    fireEvent.click(screen.getByRole('button', { name: 'export_wizard.btn_download' }));
    const firstIsCurrent = mocks.execute.mock.calls[0][2] as () => boolean;
    expect(firstIsCurrent()).toBe(true);

    view.rerender(<ExportWizard {...props({ workspaceId: 'workspace-2', onClose: secondClose })} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'export_wizard.btn_download' })).toBeEnabled();
    });
    expect(firstIsCurrent()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'export_wizard.btn_download' }));
    expect(mocks.execute).toHaveBeenCalledTimes(2);

    await act(async () => first.resolve(result));
    expect(screen.getByRole('button', { name: 'export_wizard.btn_exporting' })).toBeDisabled();
    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).not.toHaveBeenCalled();

    await act(async () => second.resolve(result));
    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it('renders only the localized stable error for a current-scope failure', async () => {
    mocks.execute.mockRejectedValue(new Error('<script>private provider detail</script>'));
    const onClose = vi.fn();
    render(<ExportWizard {...props({ onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: 'export_wizard.btn_download' }));

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith('export_wizard.export_error');
    });
    expect(mocks.error).not.toHaveBeenCalledWith(expect.stringContaining('private provider'));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
