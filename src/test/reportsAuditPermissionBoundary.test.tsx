import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportsAndAuditTab } from '@/components/enterprise/ReportsAndAuditTab';

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/collapsible-card-trigger', () => ({
  CollapsibleCardTrigger: ({ children, label }: { children: ReactNode; label: string }) => (
    <button type="button" aria-label={label}>{children}</button>
  ),
}));

vi.mock('@/components/feature-gate/FeatureGate', () => ({
  FeatureGate: ({ children, feature }: { children: ReactNode; feature: string }) => (
    <div data-testid={`feature-${feature}`}>{children}</div>
  ),
}));

vi.mock('@/components/feature-gate/LockedFeatureNotice', () => ({
  LockedFeatureNotice: ({ feature }: { feature: string }) => <div>{`locked-${feature}`}</div>,
}));

vi.mock('@/components/enterprise/AuditLog', () => ({
  AuditLog: () => <div data-testid="audit-content" />,
}));
vi.mock('@/components/enterprise/ExportCenter', () => ({
  ExportCenter: () => <div data-testid="export-content" />,
}));
vi.mock('@/components/enterprise/ReportingDashboard', () => ({
  ReportingDashboard: () => <div data-testid="reporting-dashboard" />,
}));
vi.mock('@/components/enterprise/reports/ReportLibrary', () => ({
  ReportLibrary: () => <div data-testid="report-library" />,
}));
vi.mock('@/components/enterprise/reports/PinnedReportsWidget', () => ({
  PinnedReportsWidget: () => <div data-testid="pinned-reports" />,
}));
vi.mock('@/components/compliance/ComplianceDashboard', () => ({
  ComplianceDashboard: () => <div data-testid="compliance-dashboard" />,
}));
vi.mock('@/components/documents/DocumentGeneratorPanel', () => ({
  DocumentGeneratorPanel: () => <div data-testid="document-generator" />,
}));
vi.mock('@/components/candidates/RecruitingPanel', () => ({
  RecruitingPanel: () => <div data-testid="recruiting-panel" />,
}));

const baseProps = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
};

describe('Reports/Audit/Export permission isolation', () => {
  it('mounts only the audit capability for an audit-only role', () => {
    render(
      <ReportsAndAuditTab
        {...baseProps}
        canAccessAudit
        canAccessExport={false}
        canAccessReports={false}
      />
    );

    expect(screen.getByTestId('audit-content')).toBeInTheDocument();
    expect(screen.queryByTestId('export-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reporting-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compliance-dashboard')).not.toBeInTheDocument();
  });

  it('mounts only the export capability for an export-only role', () => {
    render(
      <ReportsAndAuditTab
        {...baseProps}
        canAccessAudit={false}
        canAccessExport
        canAccessReports={false}
      />
    );

    expect(screen.getByTestId('export-content')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reporting-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('document-generator')).not.toBeInTheDocument();
  });

  it('keeps reports and all report-adjacent feature gates behind reports permission', () => {
    render(
      <ReportsAndAuditTab
        {...baseProps}
        canAccessAudit={false}
        canAccessExport={false}
        canAccessReports
      />
    );

    expect(screen.getByTestId('reporting-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('report-library')).toBeInTheDocument();
    expect(screen.getByTestId('pinned-reports')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('document-generator')).toBeInTheDocument();
    expect(screen.getByTestId('recruiting-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-content')).not.toBeInTheDocument();
  });

  it('mounts no capability when every role permission is denied', () => {
    const { container } = render(
      <ReportsAndAuditTab
        {...baseProps}
        canAccessAudit={false}
        canAccessExport={false}
        canAccessReports={false}
      />
    );

    expect(container.querySelector('.space-y-4')).toBeEmptyDOMElement();
  });
});
