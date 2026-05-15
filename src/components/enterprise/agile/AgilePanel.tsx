import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ListTodo, Plug, Search, PlusCircle, Gauge, Database, BarChart3, KanbanSquare } from 'lucide-react';
import { IntegrationManager } from '../IntegrationManager';
import { BacklogBrowser } from './BacklogBrowser';
import { IssueWriteback } from './IssueWriteback';
import { CapacityFit } from './CapacityFit';
import { FieldDiscovery } from './FieldDiscovery';
import { AgileInsights } from './AgileInsights';
import { AgileBoards } from './AgileBoards';

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  base_url: string;
  project_key: string | null;
  is_active: boolean;
  selected_field_ids: string[];
}

export function AgilePanel({ workspaceId, userId, isAdmin }: Props) {
  const { t } = useI18n();
  const [integrations, setIntegrations] = useState<IntegrationMini[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [tab, setTab] = useState('browser');

  const loadIntegrations = async () => {
    const { data } = await supabase
      .from('enterprise_workspace_integrations')
      .select('id,provider,base_url,project_key,is_active,selected_field_ids')
      .eq('workspace_id', workspaceId);
    const list = ((data as IntegrationMini[]) ?? []).filter((i) => i.is_active);
    setIntegrations(list);
    if (list.length && !activeId) setActiveId(list[0].id);
  };

  useEffect(() => { loadIntegrations(); }, [workspaceId]);

  const active = integrations.find((i) => i.id === activeId);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" /> {t('agile_panel.card_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('agile_panel.no_integration')}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('agile_panel.active_integration_label')}</span>
              <Select value={activeId} onValueChange={setActiveId}>
                <SelectTrigger className="h-8 text-xs w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {integrations.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.provider === 'jira' ? 'Jira' : 'Azure DevOps'} — {i.base_url}
                      {i.project_key ? ` / ${i.project_key}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {active && (
                <Badge variant="outline" className="text-[10px]">
                  {active.provider === 'jira' ? 'Jira Cloud' : 'Azure DevOps'}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="browser" className="gap-1"><Search className="h-4 w-4" /> {t('agile_panel.tab_browser')}</TabsTrigger>
          <TabsTrigger value="boards" className="gap-1"><KanbanSquare className="h-4 w-4" /> {t('agile_panel.tab_boards')}</TabsTrigger>
          <TabsTrigger value="writeback" className="gap-1"><PlusCircle className="h-4 w-4" /> {t('agile_panel.tab_writeback')}</TabsTrigger>
          <TabsTrigger value="capacity" className="gap-1"><Gauge className="h-4 w-4" /> {t('agile_panel.tab_capacity')}</TabsTrigger>
          <TabsTrigger value="fields" className="gap-1"><Database className="h-4 w-4" /> {t('agile_panel.tab_fields')}</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1"><BarChart3 className="h-4 w-4" /> {t('agile_panel.tab_insights')}</TabsTrigger>
          <TabsTrigger value="connections" className="gap-1"><Plug className="h-4 w-4" /> {t('agile_panel.tab_connections')}</TabsTrigger>
        </TabsList>
        <TabsContent value="browser">
          {active ? <BacklogBrowser integration={active} /> : <EmptyState />}
        </TabsContent>
        <TabsContent value="boards">
          {active ? <AgileBoards integration={active} /> : <EmptyState />}
        </TabsContent>
        <TabsContent value="writeback">
          {active ? <IssueWriteback integration={active} userId={userId} /> : <EmptyState />}
        </TabsContent>
        <TabsContent value="capacity">
          {active ? <CapacityFit integration={active} workspaceId={workspaceId} /> : <EmptyState />}
        </TabsContent>
        <TabsContent value="fields">
          {active ? <FieldDiscovery integration={active} onSelectionChange={loadIntegrations} /> : <EmptyState />}
        </TabsContent>
        <TabsContent value="insights">
          {active ? <AgileInsights integrationId={active.id} /> : <EmptyState />}
        </TabsContent>
        <TabsContent value="connections">
          <IntegrationManager workspaceId={workspaceId} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <Card><CardContent className="py-8 text-center text-xs text-muted-foreground">
      {t('agile_panel.no_integration_selected')}
    </CardContent></Card>
  );
}
