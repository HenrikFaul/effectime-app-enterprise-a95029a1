import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, GitBranch, ClipboardList, Briefcase, BookOpen, Layers, Network } from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';
import { OrgStructure } from './OrgStructure';
import { LeadershipLevels } from './LeadershipLevels';
import { ContractTypes } from './ContractTypes';
import { Industries } from './Industries';
import { WorkCategories } from './WorkCategories';
import { JobFamilies } from './JobFamilies';
import { OrgChart } from './OrgChart';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

export function OrganizationModule({ workspaceId, isAdmin }: Props) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{t('organization.title')}</CardTitle>
              <CardDescription className="text-xs">{t('organization.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="structure">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="structure" className="gap-1">
                <GitBranch className="h-4 w-4" /> {t('organization.tabs.structure')}
              </TabsTrigger>
              <TabsTrigger value="leadership" className="gap-1">
                <Layers className="h-4 w-4" /> {t('organization.tabs.leadership')}
              </TabsTrigger>
              <TabsTrigger value="contracts" className="gap-1">
                <ClipboardList className="h-4 w-4" /> {t('organization.tabs.contracts')}
              </TabsTrigger>
              <TabsTrigger value="industry" className="gap-1">
                <Briefcase className="h-4 w-4" /> {t('organization.tabs.industry')}
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

            <TabsContent value="structure" className="mt-4">
              <OrgStructure workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="leadership" className="mt-4">
              <LeadershipLevels workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="contracts" className="mt-4">
              <ContractTypes workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="industry" className="mt-4">
              <Industries workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="categories" className="mt-4">
              <WorkCategories workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="job_families" className="mt-4">
              <JobFamilies workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="chart" className="mt-4">
              <OrgChart workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
