import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/enterprise/import-export/EntitySelector', () => ({
  EntitySelector: ({ mode, onSelect }: { mode: 'export' | 'import'; onSelect: (key: string) => void }) => (
    <button type="button" onClick={() => onSelect('members')}>
      Select {mode} entity
    </button>
  ),
}));

vi.mock('@/components/enterprise/import-export/ExportWizard', () => ({
  ExportWizard: () => <div data-testid="export-wizard">Export wizard</div>,
}));

vi.mock('@/components/enterprise/import-export/ImportWizard', () => ({
  ImportWizard: () => <div data-testid="import-wizard">Import wizard</div>,
}));

vi.mock('@/components/enterprise/import-export/config/entity-registry', () => ({
  getEntityConfig: (key: string) => key === 'members'
    ? { key, label: 'Members', icon: () => null }
    : undefined,
}));

import { ImportExportCenter } from '@/components/enterprise/import-export/ImportExportCenter';

const defaultProps = {
  workspaceId: 'workspace-1',
  userId: 'user-1',
  isAdmin: true,
};

afterEach(cleanup);

describe('CSV import entitlement UI', () => {
  it('disables import with an accessible explanation while export remains usable', () => {
    render(<ImportExportCenter {...defaultProps} canImport={false} />);

    const importButton = screen.getByRole('button', { name: /^Import/ });
    const exportButton = screen.getByRole('button', { name: /^Export/ });
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

    const importButton = screen.getByRole('button', { name: /^Import/ });
    fireEvent.click(importButton);
    expect(importButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Select import entity' }));
    fireEvent.click(screen.getByRole('button', { name: 'import_export.continue_btn' }));
    expect(screen.getByTestId('import-wizard')).toBeInTheDocument();
  });

  it('closes and unmounts an active import wizard when entitlement is lost', async () => {
    const view = render(<ImportExportCenter {...defaultProps} canImport />);

    fireEvent.click(screen.getByRole('button', { name: /^Import/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Select import entity' }));
    fireEvent.click(screen.getByRole('button', { name: 'import_export.continue_btn' }));
    expect(screen.getByTestId('import-wizard')).toBeInTheDocument();

    view.rerender(<ImportExportCenter {...defaultProps} canImport={false} />);

    expect(screen.queryByTestId('import-wizard')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const exportButton = screen.getByRole('button', { name: /^Export/ });
      expect(exportButton).toHaveAttribute('aria-pressed', 'true');
      expect(document.activeElement).toBe(exportButton);
    });
  });
});
