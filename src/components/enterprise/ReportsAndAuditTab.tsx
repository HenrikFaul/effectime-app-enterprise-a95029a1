import { useState } from 'react';
import { BarChart3, ChevronDown, Download, History } from 'lucide-react';
import { ComplianceDashboard } from '@/components/compliance/ComplianceDashboard';
import { DocumentGeneratorPanel } from '@/components/documents/DocumentGeneratorPanel';
import { RecruitingPanel } from '@/components/candidates/RecruitingPanel';
import { FeatureGate } from '@/components/feature-gate/FeatureGate';
import { LockedFeatureNotice } from '@/components/feature-gate/LockedFeatureNotice';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { CollapsibleCardTrigger } from '@/components/ui/collapsible-card-trigger';
import { useI18n } from '@/i18n/I18nProvider';
import { AuditLog } from './AuditLog';
import { ExportCenter } from './ExportCenter';
import { ReportingDashboard } from './ReportingDashboard';
import { ReportLibrary } from './reports/ReportLibrary';
import { PinnedReportsWidget } from './reports/PinnedReportsWidget';

interface ReportsAndAuditTabProps {
  workspaceId: string;
  userId: string;
  canAccessAudit: boolean;
  canAccessExport: boolean;
  canAccessReports: boolean;
}

/**
 * Keeps the three independently configurable workspace permissions isolated.
 * Tier feature gates are intentionally nested below the reports permission;
 * an entitlement can never broaden a role permission.
 */
export function ReportsAndAuditTab({
  workspaceId,
  userId,
  canAccessAudit,
  canAccessExport,
  canAccessReports,
}: ReportsAndAuditTabProps) {
  const { t } = useI18n();
  const [auditOpen, setAuditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(true);

  return (
    <div className="space-y-4">
      {canAccessAudit && (
        <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
          <CollapsibleCardTrigger
            label={t('ws_nav.section_audit')}
            className="cursor-pointer hover:bg-accent/40 transition-colors duration-150 overflow-hidden"
            contentClassName="flex items-center justify-between py-3 px-4"
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{t('ws_nav.section_audit')}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${auditOpen ? 'rotate-180' : ''}`} />
          </CollapsibleCardTrigger>
          <CollapsibleContent className="mt-2">
            <AuditLog workspaceId={workspaceId} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {canAccessExport && (
        <Collapsible open={exportOpen} onOpenChange={setExportOpen}>
          <CollapsibleCardTrigger
            label={t('ws_nav.section_export')}
            className="cursor-pointer hover:bg-accent/40 transition-colors duration-150 overflow-hidden"
            contentClassName="flex items-center justify-between py-3 px-4"
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{t('ws_nav.section_export')}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </CollapsibleCardTrigger>
          <CollapsibleContent className="mt-2">
            <ExportCenter workspaceId={workspaceId} userId={userId} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {canAccessReports && (
        <>
          <Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
            <CollapsibleCardTrigger
              label={t('ws_nav.section_reports')}
              className="cursor-pointer hover:bg-accent/40 transition-colors duration-150 overflow-hidden"
              contentClassName="flex items-center justify-between py-3 px-4"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{t('ws_nav.section_reports')}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${reportsOpen ? 'rotate-180' : ''}`} />
            </CollapsibleCardTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <PinnedReportsWidget workspaceId={workspaceId} />
              <ReportingDashboard workspaceId={workspaceId} />
              <ReportLibrary workspaceId={workspaceId} userId={userId} />
            </CollapsibleContent>
          </Collapsible>

          <FeatureGate
            workspaceId={workspaceId}
            feature="compliance_engine"
            fallback={<LockedFeatureNotice feature="compliance_engine" />}
          >
            <ComplianceDashboard workspaceId={workspaceId} />
          </FeatureGate>
          <FeatureGate
            workspaceId={workspaceId}
            feature="document_generator"
            fallback={<LockedFeatureNotice feature="document_generator" />}
          >
            <DocumentGeneratorPanel workspaceId={workspaceId} />
          </FeatureGate>
          <FeatureGate
            workspaceId={workspaceId}
            feature="candidate_pipeline"
            fallback={<LockedFeatureNotice feature="candidate_pipeline" />}
          >
            <RecruitingPanel workspaceId={workspaceId} />
          </FeatureGate>
        </>
      )}
    </div>
  );
}
