import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { FolderKanban, BarChart3, ListTodo, TrendingDown, ChevronDown, Briefcase, Users, Activity, Tag, FlaskConical, Wallet, HeartPulse } from 'lucide-react';
import { ProjectList } from './ProjectList';
import { ResourceDashboard } from './ResourceDashboard';
import { CapacityGapReport } from './CapacityGapReport';
import { UtilizationHeatmap } from './UtilizationHeatmap';
import { SkillsManager } from './SkillsManager';
import { ScenarioPlanner } from './ScenarioPlanner';
import { FinancialsPanel } from './FinancialsPanel';
import { BusinessRoleManager } from '../BusinessRoleManager';
import { TeamManager } from '../TeamManager';
import { AgilePanel } from '../agile/AgilePanel';
import { WellbeingDashboard } from '../wellbeing/WellbeingDashboard';

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

export function ResourcesTab({ workspaceId, userId, isAdmin }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState('dashboard');
  const [positionsOpen, setPositionsOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <TabsList className="sticky top-[calc(var(--ws-header-h)_+_var(--ws-main-tabs-h))] z-10 flex-wrap h-auto w-full !bg-background border-b rounded-none shadow-sm">
          <TabsTrigger value="dashboard" className="gap-1"><BarChart3 className="h-4 w-4" /> {t('resources.tab_dashboard')}</TabsTrigger>
          <TabsTrigger value="heatmap" className="gap-1"><Activity className="h-4 w-4" /> {t('resources.tab_heatmap')}</TabsTrigger>
          <TabsTrigger value="projects" className="gap-1"><FolderKanban className="h-4 w-4" /> {t('resources.tab_projects')}</TabsTrigger>
          <TabsTrigger value="agile" className="gap-1"><ListTodo className="h-4 w-4" /> Agile</TabsTrigger>
          <TabsTrigger value="skills" className="gap-1"><Tag className="h-4 w-4" /> {t('resources.tab_skills')}</TabsTrigger>
          <TabsTrigger value="scenarios" className="gap-1"><FlaskConical className="h-4 w-4" /> {t('resources.tab_scenarios')}</TabsTrigger>
          <TabsTrigger value="financials" className="gap-1"><Wallet className="h-4 w-4" /> {t('resources.tab_financials')}</TabsTrigger>
          <TabsTrigger value="gaps" className="gap-1"><TrendingDown className="h-4 w-4" /> {t('resources.tab_gaps')}</TabsTrigger>
          {isAdmin && <TabsTrigger value="wellbeing" className="gap-1"><HeartPulse className="h-4 w-4" /> {t('wellbeing.dashboard_title')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="dashboard"><ResourceDashboard workspaceId={workspaceId} /></TabsContent>
        <TabsContent value="heatmap"><UtilizationHeatmap workspaceId={workspaceId} /></TabsContent>
        <TabsContent value="projects"><ProjectList workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="agile" data-help-region="workspace.agile"><AgilePanel workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="skills"><SkillsManager workspaceId={workspaceId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="scenarios"><ScenarioPlanner workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="financials"><FinancialsPanel workspaceId={workspaceId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="gaps"><CapacityGapReport workspaceId={workspaceId} /></TabsContent>
        {isAdmin && <TabsContent value="wellbeing"><WellbeingDashboard workspaceId={workspaceId} isAdmin={isAdmin} /></TabsContent>}
      </Tabs>

      {/* Pozíciók — áthelyezve a Beállításokból. Default collapsed. */}
      <Collapsible open={positionsOpen} onOpenChange={setPositionsOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{t('resources.manage_positions')}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${positionsOpen ? 'rotate-180' : ''}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <BusinessRoleManager workspaceId={workspaceId} userId={userId} />
        </CollapsibleContent>
      </Collapsible>

      {/* Csapatok — áthelyezve a Beállításokból. Default collapsed. */}
      <Collapsible open={teamsOpen} onOpenChange={setTeamsOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{t('resources.manage_teams')}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${teamsOpen ? 'rotate-180' : ''}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <TeamManager workspaceId={workspaceId} userId={userId} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
