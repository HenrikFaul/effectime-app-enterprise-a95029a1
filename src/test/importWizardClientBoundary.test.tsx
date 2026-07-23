import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ImportWizard } from '@/components/enterprise/import-export/ImportWizard';
import { getEntityConfig } from '@/components/enterprise/import-export/config/entity-registry';
import { buildTemplateGuidanceRow } from '@/components/enterprise/import-export/utils/validator';
import { maxExportArtifactDataRows } from '@/lib/exportArtifactLimits';

const {
  downloadFile,
  fetchEntityRows,
  generateCSV,
  generateExcelXML,
  invoke,
  parseUploadedFile,
  toastError,
  toastInfo,
  toastSuccess,
} = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  fetchEntityRows: vi.fn(),
  generateCSV: vi.fn(() => 'generated,csv'),
  generateExcelXML: vi.fn(() => '<Workbook />'),
  invoke: vi.fn(),
  parseUploadedFile: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke },
  },
}));

vi.mock('@/components/enterprise/import-export/utils/data-fetcher', () => ({
  fetchEntityRows,
}));

vi.mock('@/components/enterprise/import-export/utils/file-parser', () => ({
  downloadFile,
  generateCSV,
  generateExcelXML,
  parseUploadedFile,
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string, variables?: Record<string, unknown>) => {
      if (key === 'import_wizard.row_ref') return `source-row:${String(variables?.n)}`;
      if (key === 'import_wizard.support_reference') {
        return `support-reference:${String(variables?.requestId)}`;
      }
      return key;
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    info: toastInfo,
    success: toastSuccess,
  },
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      aria-label="import-confirmation"
      type="checkbox"
      checked={checked ?? false}
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
    />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

const skillsEntity = getEntityConfig('skills');

if (!skillsEntity) {
  throw new Error('The skills import entity must exist for the ImportWizard contract tests.');
}

const mixedRows = [['Alpha'], [''], ['Gamma']];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

function renderWizard() {
  return render(
    <ImportWizard
      entity={skillsEntity}
      workspaceId="workspace-1"
      userId="user-1"
      onClose={vi.fn()}
    />,
  );
}

async function uploadParsedRows(
  headers: string[],
  rows: string[][],
  fileName = 'skills.csv',
) {
  parseUploadedFile.mockResolvedValueOnce({
    headers,
    rows,
    detectedFormat: 'csv',
  });

  const view = renderWizard();
  const input = view.container.querySelector<HTMLInputElement>('#ie-file-input');
  expect(input).not.toBeNull();

  fireEvent.change(input!, {
    target: { files: [new File(['fixture'], fileName, { type: 'text/csv' })] },
  });

  await screen.findByText('import_wizard.mapping_title');
  return view;
}

async function uploadRows(rows: string[][] = mixedRows) {
  return uploadParsedRows(['name'], rows);
}

async function advanceToValidation(rows: string[][] = mixedRows) {
  const view = await uploadRows(rows);
  fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_validate/ }));
  await screen.findByText('import_wizard.label_valid');
  return view;
}

async function advanceToImport(rows: string[][] = mixedRows) {
  const view = await advanceToConfirmation(rows);

  fireEvent.click(screen.getByRole('checkbox', { name: 'import-confirmation' }));
  const submit = screen.getByRole('button', { name: /import_wizard\.btn_start_import/ });
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  return view;
}

async function advanceToConfirmation(rows: string[][] = mixedRows) {
  const view = await advanceToValidation(rows);
  fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_next/ }));
  await screen.findByText('import_wizard.mode_label');

  fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_next/ }));
  await screen.findByText('import_wizard.summary_title');
  return view;
}

function functionsHttpError(
  status: number,
  body: Record<string, unknown>,
  requestId?: string,
): unknown {
  const headers = requestId ? { 'X-Request-Id': requestId } : undefined;
  return {
    name: 'FunctionsHttpError',
    message: 'provider stack and credential must remain private',
    context: new Response(JSON.stringify(body), { status, headers }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchEntityRows.mockResolvedValue([]);
});

describe('ImportWizard client safety boundary', () => {
  it('blocks an oversized current-data XLS template before artifact or download', async () => {
    fetchEntityRows.mockResolvedValueOnce(
      new Array(maxExportArtifactDataRows('xls', true) + 1).fill({
        name: 'TypeScript',
        category: 'Engineering',
        color: '#3178c6',
        skill_id: 'skill-1',
      }),
    );
    renderWizard();

    fireEvent.click(screen.getByRole('button', {
      name: /import_wizard\.btn_current_data/,
    }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('import_wizard.toast_error');
    });
    expect(generateExcelXML).not.toHaveBeenCalled();
    expect(downloadFile).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('lands directly on Step 3 mapping after a successful file upload', async () => {
    await uploadRows([['Alpha']]);

    expect(screen.getByText('import_wizard.mapping_title')).toBeInTheDocument();
    expect(screen.queryByText(/import_wizard\.file_loaded/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import_wizard\.btn_validate/ })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_back/ }));
    expect(screen.getByText(/import_wizard\.file_loaded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'import_wizard.btn_remove_file' })).toBeEnabled();
    const continueFromPreview = screen.getByRole('button', { name: /import_wizard\.btn_next/ });
    expect(continueFromPreview).toBeEnabled();

    fireEvent.click(continueFromPreview);
    expect(screen.getByText('import_wizard.mapping_title')).toBeInTheDocument();
  });

  it('rejects normalized duplicate source headers before mapping', async () => {
    parseUploadedFile.mockResolvedValueOnce({
      headers: ['Name', ' name *'],
      rows: [['Alpha', 'Beta']],
      detectedFormat: 'csv',
    });
    const view = renderWizard();
    const input = view.container.querySelector<HTMLInputElement>('#ie-file-input');
    fireEvent.change(input!, {
      target: { files: [new File(['fixture'], 'duplicate-headers.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('import_wizard.toast_invalid_headers');
    });
    expect(screen.queryByText('import_wizard.mapping_title')).not.toBeInTheDocument();
  });

  it('blocks validation when two source columns map to one target field', async () => {
    await uploadParsedRows(
      ['name', 'Skill name'],
      [['Alpha', 'Beta']],
      'duplicate-target.csv',
    );

    expect(screen.getByText('import_wizard.duplicate_mapping')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import_wizard\.btn_validate/ })).toBeDisabled();
  });

  it('submits only valid row data and remaps a compact server index to the original third row', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        summary: { total: 2, created: 1, updated: 0, skipped: 0, failed: 1 },
        errors: [{
          row_index: 1,
          field: 'name',
          value: 'Gamma',
          code: 'DB_ERROR',
          message: 'The row could not be saved',
        }],
      },
      error: null,
    });

    await advanceToImport();

    await screen.findByText('import_wizard.result_success');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('import-entity-data', {
      body: {
        workspace_id: 'workspace-1',
        entity: 'skills',
        mode: 'create',
        rows: [{ name: 'Alpha' }, { name: 'Gamma' }],
        dry_run: false,
      },
    });
    expect(JSON.stringify(invoke.mock.calls[0]?.[1])).not.toContain('sourceRowIndex');
    expect(screen.getByText(/source-row:3/)).toHaveTextContent('The row could not be saved');
  });

  it('treats a malformed 200 payload as an unknown outcome without a false success or summary', async () => {
    invoke.mockResolvedValueOnce({
      data: { success: true, summary: { total: 1 } },
      error: null,
    });

    await advanceToImport([['Alpha']]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('import_wizard.result_uncertain');
    expect(alert).toHaveTextContent('import_wizard.result_uncertain_description');
    expect(screen.queryByText('import_wizard.result_success')).not.toBeInTheDocument();
    expect(screen.queryByText(/import_wizard\.result_summary/)).not.toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('shows only the safe request id for a definitive 403 FunctionsHttpError', async () => {
    const requestId = 'request_SAFE_403';
    const providerSecret = 'postgres://provider-user:provider-password@internal-db';
    invoke.mockResolvedValueOnce({
      data: null,
      error: functionsHttpError(403, {
        code: 'FEATURE_DISABLED',
        error: providerSecret,
        request_id: requestId,
      }, requestId),
    });

    await advanceToImport([['Alpha']]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('import_wizard.result_failed');
    expect(alert).toHaveTextContent(`support-reference:${requestId}`);
    expect(alert).not.toHaveTextContent(providerSecret);
    expect(document.body).not.toHaveTextContent('provider-password');
    expect(JSON.stringify(toastError.mock.calls)).not.toContain('provider-password');
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('includes the original validation row index in the downloaded error report', async () => {
    await advanceToValidation();

    fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_download_errors/ }));

    expect(generateCSV).toHaveBeenCalledTimes(1);
    expect(generateCSV).toHaveBeenCalledWith(
      ['row_index', 'field', 'value', 'code', 'message'],
      [['1', 'name', '', 'REQUIRED_EMPTY', 'Required field is empty: Skill name']],
    );
    expect(downloadFile).toHaveBeenCalledWith(
      'generated,csv',
      'effectime_skills_import_errors.csv',
      'text/csv;charset=utf-8',
    );
  });

  it('keeps the latest file selection when an older parse resolves last', async () => {
    const stale = deferred<{ headers: string[]; rows: string[][]; detectedFormat: string }>();
    const latest = deferred<{ headers: string[]; rows: string[][]; detectedFormat: string }>();
    parseUploadedFile
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(latest.promise);

    const view = renderWizard();
    const input = view.container.querySelector<HTMLInputElement>('#ie-file-input');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: { files: [new File(['old'], 'old.csv', { type: 'text/csv' })] },
    });
    fireEvent.change(input!, {
      target: { files: [new File(['new'], 'new.csv', { type: 'text/csv' })] },
    });

    await act(async () => {
      latest.resolve({ headers: ['latest_header'], rows: [['latest']], detectedFormat: 'csv' });
      await latest.promise;
    });
    await screen.findByText('latest_header');

    await act(async () => {
      stale.resolve({ headers: ['stale_header'], rows: [['stale']], detectedFormat: 'csv' });
      await stale.promise;
    });

    expect(screen.getByText('latest_header')).toBeInTheDocument();
    expect(screen.queryByText('stale_header')).not.toBeInTheDocument();
  });

  it('requires fresh confirmation after the import mode changes', async () => {
    await advanceToConfirmation([['Alpha']]);
    const confirmation = screen.getByRole('checkbox', { name: 'import-confirmation' });
    fireEvent.click(confirmation);
    expect(confirmation).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_back/ }));
    await screen.findByText('import_wizard.mode_label');
    const createMode = screen.getByRole('button', { name: /import_wizard\.mode_create_title/ });
    const upsertMode = screen.getByRole('button', { name: /import_wizard\.mode_upsert_title/ });
    expect(createMode).toHaveAttribute('aria-pressed', 'true');
    expect(upsertMode).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(upsertMode);
    expect(createMode).toHaveAttribute('aria-pressed', 'false');
    expect(upsertMode).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_next/ }));
    await screen.findByText('import_wizard.summary_title');

    expect(screen.getByRole('checkbox', { name: 'import-confirmation' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /import_wizard\.btn_start_import/ })).toBeDisabled();
  });

  it('submits a marked guidance template without importing its example row and preserves source indexes', async () => {
    const fields = skillsEntity.fields.filter((field) => field.importable);
    const headers = fields.map((field) => field.key);
    const guidance = buildTemplateGuidanceRow(fields);
    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        summary: { total: 1, created: 0, updated: 0, skipped: 0, failed: 1 },
        errors: [{
          row_index: 0,
          field: 'name',
          value: 'Alpha',
          code: 'DB_ERROR',
          message: 'The row could not be saved',
        }],
      },
      error: null,
    });

    await uploadParsedRows(headers, [guidance, ['Alpha', 'Backend', '#123456']]);
    fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_validate/ }));
    await screen.findByText('import_wizard.label_valid');
    fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_next/ }));
    await screen.findByText('import_wizard.mode_label');
    fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_next/ }));
    await screen.findByText('import_wizard.summary_title');
    fireEvent.click(screen.getByRole('checkbox', { name: 'import-confirmation' }));
    fireEvent.click(screen.getByRole('button', { name: /import_wizard\.btn_start_import/ }));

    await screen.findByText('import_wizard.result_success');
    expect(invoke).toHaveBeenCalledWith('import-entity-data', {
      body: {
        workspace_id: 'workspace-1',
        entity: 'skills',
        mode: 'create',
        rows: [{ name: 'Alpha', category: 'Backend', color: '#123456' }],
        dry_run: false,
      },
    });
    expect(screen.getByText(/source-row:2/)).toHaveTextContent('The row could not be saved');
    expect(toastInfo).toHaveBeenCalledWith('import_wizard.toast_guidance_skipped');
  });

  it('accepts exactly 2,000 data rows after removing a marked guidance row', async () => {
    const fields = skillsEntity.fields.filter((field) => field.importable);
    const headers = fields.map((field) => field.key);
    const guidance = buildTemplateGuidanceRow(fields);
    const dataRows = Array.from({ length: 2_000 }, (_, index) => [
      `Skill ${index}`,
      'Backend',
      '#123456',
    ]);

    await uploadParsedRows(headers, [guidance, ...dataRows], 'limit.csv');

    expect(screen.getByText('import_wizard.mapping_title')).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalledWith('import_wizard.toast_too_many_rows');
  });

  it('rejects 2,001 data rows even when a marked guidance row is removed', async () => {
    const fields = skillsEntity.fields.filter((field) => field.importable);
    const headers = fields.map((field) => field.key);
    const guidance = buildTemplateGuidanceRow(fields);
    const dataRows = Array.from({ length: 2_001 }, (_, index) => [
      `Skill ${index}`,
      'Backend',
      '#123456',
    ]);

    parseUploadedFile.mockResolvedValueOnce({
      headers,
      rows: [guidance, ...dataRows],
      detectedFormat: 'csv',
    });
    const view = renderWizard();
    const input = view.container.querySelector<HTMLInputElement>('#ie-file-input');
    fireEvent.change(input!, {
      target: { files: [new File(['fixture'], 'over-limit.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('import_wizard.toast_too_many_rows');
    });
    expect(screen.queryByText('import_wizard.mapping_title')).not.toBeInTheDocument();
  });

  it('guards a pending import against duplicate submission', async () => {
    const pending = deferred<{ data: unknown; error: null }>();
    invoke.mockReturnValueOnce(pending.promise);
    await advanceToConfirmation([['Alpha']]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'import-confirmation' }));
    const submit = screen.getByRole('button', { name: /import_wizard\.btn_start_import/ });

    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(invoke).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({
        data: {
          success: true,
          summary: { total: 1, created: 1, updated: 0, skipped: 0, failed: 0 },
          errors: [],
        },
        error: null,
      });
      await pending.promise;
    });
    await screen.findByText('import_wizard.result_success');
  });
});
