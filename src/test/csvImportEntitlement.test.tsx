import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/enterprise/import-export/EntitySelector', () => ({
  EntitySelector: ({ mode, onSelect }: { mode: 'export' | 'import'; onSelect: (key: string) => void }) => (
    <div>
      <button type="button" onClick={() => onSelect('members')}>
        Select {mode} entity
      </button>
      <button type="button" onClick={() => onSelect('positions')}>
        Select positions
      </button>
    </div>
  ),
}));

vi.mock('@/components/enterprise/import-export/ExportWizard', () => ({
  ExportWizard: () => <div data-testid="export-wizard">Export wizard</div>,
}));

vi.mock('@/components/enterprise/import-export/ImportWizard', () => ({
  ImportWizard: () => <div data-testid="import-wizard">Import wizard</div>,
}));

vi.mock('@/components/enterprise/import-export/config/entity-registry', () => ({
  getEntityConfig: (key: string) => {
    if (key === 'members') {
      return { key, label: 'Members', icon: () => null, exportEnabled: true, importEnabled: true };
    }
    if (key === 'positions') {
      return { key, label: 'Positions', icon: () => null, exportEnabled: true, importEnabled: false };
    }
    return undefined;
  },
}));

import { ImportExportCenter } from '@/components/enterprise/import-export/ImportExportCenter';

const defaultProps = {
  workspaceId: 'workspace-1',
  userId: 'user-1',
  isAdmin: true,
  canExport: true,
};

afterEach(cleanup);

describe('CSV import entitlement UI', () => {
  it('disables import with an accessible explanation while export remains usable', () => {
    render(<ImportExportCenter {...defaultProps} canImport={false} />);

    const importButton = screen.getByRole('button', { name: /import_export\.import_label/ });
    const exportButton = screen.getByRole('button', { name: /import_export\.export_label/ });
    expect(importButton).toBeDisabled();
    expect(importButton).toHaveAttribute('aria-pressed', 'false');
    expect(exportButton).toBeEnabled();
    expect(exportButton).toHaveAttribute('aria-pressed', 'true');

    const descriptionId = importButton.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).toHaveTextContent('feature_gate.locked_desc');

    fireEvent.click(screen.getByRole('button', { name: 'Select export entity' }));
    fireEvent.click(screen.getByRole('button', { name: 'import_export.continue_btn' }));
    expect(screen.getByTestId('export-wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('import-wizard')).not.toBeInTheDocument();
  });

  it('preserves the existing import flow when the exact entitlement decision allows it', () => {
    render(<ImportExportCenter {...defaultProps} canImport />);

    const importButton = screen.getByRole('button', { name: /import_export\.import_label/ });
    fireEvent.click(importButton);
    expect(importButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Select import entity' }));
    fireEvent.click(screen.getByRole('button', { name: 'import_export.continue_btn' }));
    expect(screen.getByTestId('import-wizard')).toBeInTheDocument();
  });

  it('closes and unmounts an active import wizard when entitlement is lost', async () => {
    const view = render(<ImportExportCenter {...defaultProps} canImport />);

    fireEvent.click(screen.getByRole('button', { name: /import_export\.import_label/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Select import entity' }));
    fireEvent.click(screen.getByRole('button', { name: 'import_export.continue_btn' }));
    expect(screen.getByTestId('import-wizard')).toBeInTheDocument();

    view.rerender(<ImportExportCenter {...defaultProps} canImport={false} />);

    expect(screen.queryByTestId('import-wizard')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const exportButton = screen.getByRole('button', { name: /import_export\.export_label/ });
      expect(exportButton).toHaveAttribute('aria-pressed', 'true');
      expect(document.activeElement).toBe(exportButton);
    });
  });

  it('keeps import usable while exact export access is denied', () => {
    render(<ImportExportCenter {...defaultProps} canExport={false} canImport />);

    const exportButton = screen.getByRole('button', { name: /import_export\.export_label/ });
    const importButton = screen.getByRole('button', { name: /import_export\.import_label/ });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute('aria-pressed', 'false');
    expect(importButton).toBeEnabled();
    expect(importButton).toHaveAttribute('aria-pressed', 'true');
    const descriptionId = exportButton.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).toHaveTextContent('feature_gate.locked_desc');

    fireEvent.click(screen.getByRole('button', { name: 'Select import entity' }));
    fireEvent.click(screen.getByRole('button', { name: 'import_export.continue_btn' }));
    expect(screen.getByTestId('import-wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('export-wizard')).not.toBeInTheDocument();
  });

  it('closes export on capability loss and restores focus to the allowed import mode', async () => {
    const view = render(<ImportExportCenter {...defaultProps} canImport />);

    fireEvent.click(screen.getByRole('button', { name: 'Select export entity' }));
    fireEvent.click(screen.getByRole('button', { name: 'import_export.continue_btn' }));
    expect(screen.getByTestId('export-wizard')).toBeInTheDocument();

    view.rerender(<ImportExportCenter {...defaultProps} canExport={false} canImport />);

    expect(screen.queryByTestId('export-wizard')).not.toBeInTheDocument();
    await waitFor(() => {
      const importButton = screen.getByRole('button', { name: /import_export\.import_label/ });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(importButton).toHaveAttribute('aria-pressed', 'true');
      expect(document.activeElement).toBe(importButton);
    });
  });

  it('does not mount data management when neither exact capability is available', () => {
    render(<ImportExportCenter {...defaultProps} canExport={false} canImport={false} />);

    expect(screen.getByText('import_export.access_restricted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import_export\.export_label/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import_export\.import_label/ })).not.toBeInTheDocument();
  });

  it('clears selection on mode change and rechecks the entity capability flag', () => {
    render(<ImportExportCenter {...defaultProps} canImport />);

    fireEvent.click(screen.getByRole('button', { name: 'Select positions' }));
    expect(screen.getByRole('button', { name: 'import_export.continue_btn' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /import_export\.import_label/ }));
    expect(screen.getByRole('button', { name: 'import_export.continue_btn' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Select positions' }));
    const continueButton = screen.getByRole('button', { name: 'import_export.continue_btn' });
    expect(continueButton).toBeDisabled();
    fireEvent.click(continueButton);
    expect(screen.queryByTestId('import-wizard')).not.toBeInTheDocument();
  });
});
