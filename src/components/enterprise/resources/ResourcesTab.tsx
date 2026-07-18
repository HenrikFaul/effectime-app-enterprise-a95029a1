import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderKanban, BarChart3, ListTodo, TrendingDown, Activity, FlaskConical, Wallet, HeartPulse, CreditCard, type LucideIcon } from 'lucide-react';
import { useEnabledFeatures } from '@/hooks/useFeature';
import { LockedFeatureNotice } from '@/components/feature-gate/LockedFeatureNotice';
import { getAvailableResourceTabs, shouldShowProjectGantt, type ResourceTabKey } from '@/lib/resourceTabs';
import { ProjectList } from './ProjectList';
import { GanttTimeline } from './GanttTimeline';
import { ResourceDashboard } from './ResourceDashboard';
import { CapacityGapReport } from './CapacityGapReport';
import { UtilizationHeatmap } from './UtilizationHeatmap';
import { ScenarioPlanner } from './ScenarioPlanner';
import { FinancialsPanel } from './FinancialsPanel';
import { AgilePanel } from '../agile/AgilePanel';
import { WellbeingDashboard } from '../wellbeing/WellbeingDashboard';
import { PayrollPanel } from '../payroll/PayrollPanel';

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

interface ResourceTabDefinition {
  key: ResourceTabKey;
  labelKey?: string;
  label?: string;
  icon: LucideIcon;
}

const RESOURCE_TABS: readonly ResourceTabDefinition[] = [
  { key: 'dashboard', labelKey: 'resources.tab_dashboard', icon: BarChart3 },
  { key: 'heatmap', labelKey: 'resources.tab_heatmap', icon: Activity },
  { key: 'projects', labelKey: 'resources.tab_projects', icon: FolderKanban },
  { key: 'agile', label: 'Agile', icon: ListTodo },
  { key: 'scenarios', labelKey: 'resources.tab_scenarios', icon: FlaskConical },
  { key: 'financials', labelKey: 'resources.tab_financials', icon: Wallet },
  { key: 'gaps', labelKey: 'resources.tab_gaps', icon: TrendingDown },
  { key: 'wellbeing', labelKey: 'wellbeing.dashboard_title', icon: HeartPulse },
  { key: 'payroll', labelKey: 'payroll.title', icon: CreditCard },
];

export function ResourcesTab({ workspaceId, userId, isAdmin }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState('dashboard');
  const { isEnabled, isLoading, isError } = useEnabledFeatures(workspaceId);
  const availableTabs = getAvailableResourceTabs(isEnabled, isAdmin);

  useEffect(() => {
    if (isLoading || isError || availableTabs.length === 0) return;
    if (!availableTabs.includes(tab as ResourceTabKey)) setTab(availableTabs[0]);
  }, [availableTabs, isError, isLoading, tab]);

  if (isLoading) return null;
  if (isError || availableTabs.length === 0) {
    return <LockedFeatureNotice feature="resource_dashboard" />;
  }

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <TabsList className="sticky top-[calc(var(--ws-header-h)_+_var(--ws-main-tabs-h))] z-10 flex-wrap h-auto w-full !bg-background border-b rounded-none shadow-sm">
          {RESOURCE_TABS.filter((item) => availableTabs.includes(item.key)).map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger key={item.key} value={item.key} className="gap-1">
                <Icon className="h-4 w-4" /> {item.label ?? t(item.labelKey ?? '')}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {availableTabs.includes('dashboard') && <TabsContent value="dashboard"><ResourceDashboard workspaceId={workspaceId} /></TabsContent>}
        {availableTabs.includes('heatmap') && <TabsContent value="heatmap"><UtilizationHeatmap workspaceId={workspaceId} /></TabsContent>}
        {availableTabs.includes('projects') && (
          <TabsContent value="projects" className="space-y-3">
            <ProjectList workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} />
            {shouldShowProjectGantt(isEnabled) && <GanttTimeline workspaceId={workspaceId} />}
          </TabsContent>
        )}
        {availableTabs.includes('agile') && <TabsContent value="agile" data-help-region="workspace.agile"><AgilePanel workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>}
        {availableTabs.includes('scenarios') && <TabsContent value="scenarios"><ScenarioPlanner workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>}
        {availableTabs.includes('financials') && <TabsContent value="financials"><FinancialsPanel workspaceId={workspaceId} isAdmin={isAdmin} /></TabsContent>}
        {availableTabs.includes('gaps') && <TabsContent value="gaps"><CapacityGapReport workspaceId={workspaceId} /></TabsContent>}
        {availableTabs.includes('wellbeing') && <TabsContent value="wellbeing"><WellbeingDashboard workspaceId={workspaceId} isAdmin={isAdmin} /></TabsContent>}
        {availableTabs.includes('payroll') && <TabsContent value="payroll"><PayrollPanel workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>}
      </Tabs>
    </div>
  );
}
