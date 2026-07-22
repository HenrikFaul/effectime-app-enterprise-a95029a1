import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, GitBranch, ClipboardList, Briefcase, BookOpen,
  Layers, Network, Users, Tag,
} from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';
import { OrgStructure } from './OrgStructure';
import { LeadershipLevels } from './LeadershipLevels';
import { ContractTypes } from './ContractTypes';
import { Industries } from './Industries';
import { WorkCategories } from './WorkCategories';
import { JobFamilies } from './JobFamilies';
import { OrgChart } from './OrgChart';
import { BusinessRoleManager } from '../BusinessRoleManager';
import { TeamManager } from '../TeamManager';
import { SkillsManager } from '../resources/SkillsManager';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
  canEditMemberProfiles?: boolean;
  onNavigateTab?: (tab: string) => void;
  userId?: string;
}

export function OrganizationModule({ workspaceId, isAdmin, canEditMemberProfiles = false, onNavigateTab, userId }: Props) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Tabs defaultValue="structure" className="space-y-3">
        <TabsList className="sticky top-[calc(var(--ws-header-h)_+_var(--ws-main-tabs-h))] z-10 flex-wrap h-auto w-full !bg-background border-b rounded-none shadow-sm">
          <TabsTrigger value="structure" className="gap-1">
            <GitBranch className="h-4 w-4" /> {t('organization.tabs.structure')}
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-1">
            <Briefcase className="h-4 w-4" /> {t('organization.tabs.positions')}
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1">
            <Users className="h-4 w-4" /> {t('organization.tabs.teams')}
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1">
            <Tag className="h-4 w-4" /> {t('organization.tabs.skills')}
          </TabsTrigger>
          <TabsTrigger value="leadership" className="gap-1">
            <Layers className="h-4 w-4" /> {t('organization.tabs.leadership')}
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1">
            <ClipboardList className="h-4 w-4" /> {t('organization.tabs.contracts')}
          </TabsTrigger>
          <TabsTrigger value="industry" className="gap-1">
            <Building2 className="h-4 w-4" /> {t('organization.tabs.industry')}
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1">
            <BookOpen className="h-4 w-4" /> {t('organization.tabs.categories')}
          </TabsTrigger>
          <TabsTrigger value="job_families" className="gap-1">
            <Briefcase className="h-4 w-4" /> {t('organization.tabs.job_families')}
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-1">
            <Network className="h-4 w-4" /> {t('organization.tabs.chart')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure">
          <OrgStructure workspaceId={workspaceId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="positions">
          <BusinessRoleManager
            workspaceId={workspaceId}
            canEditMemberProfiles={canEditMemberProfiles}
          />
        </TabsContent>
        <TabsContent value="teams">
          <TeamManager workspaceId={workspaceId} userId={userId ?? ''} />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsManager workspaceId={workspaceId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="leadership">
          <LeadershipLevels workspaceId={workspaceId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="contracts">
          <ContractTypes workspaceId={workspaceId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="industry">
          <Industries workspaceId={workspaceId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="categories">
          <WorkCategories workspaceId={workspaceId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="job_families">
          <JobFamilies workspaceId={workspaceId} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="chart">
          <OrgChart
            workspaceId={workspaceId}
            isAdmin={isAdmin}
            canEditMemberProfiles={canEditMemberProfiles}
            onNavigateTab={onNavigateTab}
            userId={userId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
