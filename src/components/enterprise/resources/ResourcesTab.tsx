import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { FolderKanban, BarChart3, ListTodo, TrendingDown, ChevronDown, Briefcase, Users, Activity, Tag, FlaskConical, Wallet } from 'lucide-react';
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

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

export function ResourcesTab({ workspaceId, userId, isAdmin }: Props) {
  const [tab, setTab] = useState('dashboard');
  const [positionsOpen, setPositionsOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="gap-1"><BarChart3 className="h-4 w-4" /> Áttekintés</TabsTrigger>
          <TabsTrigger value="heatmap" className="gap-1"><Activity className="h-4 w-4" /> Hőtérkép</TabsTrigger>
          <TabsTrigger value="projects" className="gap-1"><FolderKanban className="h-4 w-4" /> Projektek</TabsTrigger>
          <TabsTrigger value="agile" className="gap-1"><ListTodo className="h-4 w-4" /> Agile</TabsTrigger>
          <TabsTrigger value="skills" className="gap-1"><Tag className="h-4 w-4" /> Készségek</TabsTrigger>
          <TabsTrigger value="scenarios" className="gap-1"><FlaskConical className="h-4 w-4" /> Forgatókönyvek</TabsTrigger>
          <TabsTrigger value="financials" className="gap-1"><Wallet className="h-4 w-4" /> Pénzügy</TabsTrigger>
          <TabsTrigger value="gaps" className="gap-1"><TrendingDown className="h-4 w-4" /> Kapacitás-hiány</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><ResourceDashboard workspaceId={workspaceId} /></TabsContent>
        <TabsContent value="heatmap"><UtilizationHeatmap workspaceId={workspaceId} /></TabsContent>
        <TabsContent value="projects"><ProjectList workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="agile"><AgilePanel workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="skills"><SkillsManager workspaceId={workspaceId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="scenarios"><ScenarioPlanner workspaceId={workspaceId} userId={userId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="financials"><FinancialsPanel workspaceId={workspaceId} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="gaps"><CapacityGapReport workspaceId={workspaceId} /></TabsContent>
      </Tabs>

      {/* Pozíciók — áthelyezve a Beállításokból. Default collapsed. */}
      <Collapsible open={positionsOpen} onOpenChange={setPositionsOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Pozíciók kezelése</span>
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
                <span className="font-medium text-sm">Csapatok kezelése</span>
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
