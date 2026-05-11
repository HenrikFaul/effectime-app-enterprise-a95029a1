import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GitMerge, ListChecks, Plug, Inbox, Server, Stethoscope, ClipboardList } from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';
import { OnboardingTemplates } from './OnboardingTemplates';
import { OnboardingInbox } from './OnboardingInbox';
import { AccessSystems } from './AccessSystems';
import { AccessTemplates } from './AccessTemplates';
import { AccessInbox } from './AccessInbox';
import { HRWorkflowTemplates } from './HRWorkflowTemplates';
import { HRWorkflowInbox } from './HRWorkflowInbox';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
  userId: string;
}

export function WorkflowsModule({ workspaceId, isAdmin, userId }: Props) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{t('workflows.title')}</CardTitle>
              <CardDescription className="text-xs">{t('workflows.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="hr-inbox">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="hr-inbox" className="gap-1">
                <Inbox className="h-4 w-4" />
                {t('hr_workflow.tab_inbox')}
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="hr-templates" className="gap-1">
                  <Stethoscope className="h-4 w-4" />
                  {t('hr_workflow.tab_templates')}
                </TabsTrigger>
              )}
              <TabsTrigger value="onboarding-templates" className="gap-1">
                <ListChecks className="h-4 w-4" />
                {t('workflows.tabs.onboarding_templates')}
              </TabsTrigger>
              <TabsTrigger value="onboarding-inbox" className="gap-1">
                <ClipboardList className="h-4 w-4" />
                {t('workflows.tabs.onboarding_inbox')}
              </TabsTrigger>
              <TabsTrigger value="access-systems" className="gap-1">
                <Server className="h-4 w-4" />
                {t('workflows.tabs.access_systems')}
              </TabsTrigger>
              <TabsTrigger value="access-templates" className="gap-1">
                <Plug className="h-4 w-4" />
                {t('workflows.tabs.access_templates')}
              </TabsTrigger>
              <TabsTrigger value="access-inbox" className="gap-1">
                <Inbox className="h-4 w-4" />
                {t('workflows.tabs.access_inbox')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hr-inbox" className="mt-4">
              <HRWorkflowInbox workspaceId={workspaceId} isAdmin={isAdmin} userId={userId} />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="hr-templates" className="mt-4">
                <HRWorkflowTemplates workspaceId={workspaceId} />
              </TabsContent>
            )}
            <TabsContent value="onboarding-templates" className="mt-4">
              <OnboardingTemplates workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="onboarding-inbox" className="mt-4">
              <OnboardingInbox workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="access-systems" className="mt-4">
              <AccessSystems workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="access-templates" className="mt-4">
              <AccessTemplates workspaceId={workspaceId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="access-inbox" className="mt-4">
              <AccessInbox workspaceId={workspaceId} isAdmin={isAdmin} userId={userId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
