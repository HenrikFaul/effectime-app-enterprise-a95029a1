import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Users, UserPlus, Shield, Settings, Trash2, FileText, ShieldAlert, BarChart3, Bell, Download, History, CalendarDays, ChevronDown, Plus, User, Briefcase, Wallet, Plug, Rss, Inbox, LayoutPanelLeft, LogOut, Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { InviteMemberDialog } from './InviteMemberDialog';
import { MemberList } from './MemberList';
import { InvitationsPanel } from './InvitationsPanel';
import { LeaveRequestList } from './LeaveRequestList';
import { ApprovalInbox } from './ApprovalInbox';
import { LeaveTypeManager } from './LeaveTypeManager';
import { HolidayManager } from './HolidayManager';
import { BlockedDateManager } from './BlockedDateManager';
import { DailyRuleManager } from './DailyRuleManager';
import { ApprovalChainManager } from './ApprovalChainManager';
import { AuditLog } from './AuditLog';
import { EnterpriseNotifications } from './EnterpriseNotifications';
import { ExportCenter } from './ExportCenter';
import { ReportingDashboard } from './ReportingDashboard';
import { ReportLibrary } from './reports/ReportLibrary';
import { PinnedReportsWidget } from './reports/PinnedReportsWidget';
import { RuleTemplateLibrary } from './RuleTemplateLibrary';
import { LeaveCalendar } from './LeaveCalendar';
import { OfficeManager } from './OfficeManager';
import { CompanyLeaveDayManager } from './CompanyLeaveDayManager';
import { AdminLeaveOverride } from './AdminLeaveOverride';
import { RolePermissionManager } from './RolePermissionManager';
import { MemberProfileSheet } from './MemberProfileSheet';
import { ResourcesTab } from './resources/ResourcesTab';
import { OutTodayWidget } from './OutTodayWidget';
import { QuotaBalanceCard } from './QuotaBalanceCard';
import { QuotaManager } from './QuotaManager';
import { SubstituteInbox } from './SubstituteInbox';
import { IntegrationManager } from './IntegrationManager';
import { ICalSubscription } from './ICalSubscription';
import { AllowanceManager } from './AllowanceManager';
import { WorkspaceGeneralSettings } from './WorkspaceGeneralSettings';
import { BrandingManager } from './BrandingManager';
import { CsvImportPanel } from './CsvImportPanel';
import { AnnualLeaveGrid } from './AnnualLeaveGrid';
import { BirthdayAnniversaryWidget } from './BirthdayAnniversaryWidget';
import { AnnualTrendChart } from './AnnualTrendChart';
import { OfficeCoverageRuleManager } from './OfficeCoverageRuleManager';
import { UiSectionStateManager } from './UiSectionStateManager';
import { TimelineView } from './calendar/TimelineView';
import { CalendarFilterSettings } from './calendar/CalendarFilterSettings';
import { CoveragePlannerView } from './calendar/CoveragePlannerView';
import { SkillCapacityReport } from './calendar/SkillCapacityReport';
import { useEnterprisePermissions } from '@/hooks/useEnterprisePermissions';
import { useWorkspaceSectionState } from '@/hooks/useWorkspaceSectionState';
import { useTheme, type ThemeStyle } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { HelpButton } from '@/components/help/HelpButton';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { useHelpAnchor } from '@/lib/help/registry';
import { OrganizationModule } from './organization/OrganizationModule';
import { LocalizationSettings } from './settings/LocalizationSettings';
import { NotificationBell } from './NotificationBell';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  locale: string;
  created_at: string;
  is_archived: boolean;
}

interface Props {
  workspace: Workspace;
  userRole: string;
  userId: string;
  onBack: () => void;
  onRefresh: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function WorkspaceDashboard({ workspace, userRole, userId, onBack, onRefresh, activeTab: externalTab, onTabChange }: Props) {
  const { signOut } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [myMembership, setMyMembership] = useState<any>(null);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [timelineReport, setTimelineReport] = useState<{ userIds: string[]; range: { from: Date; to: Date } } | null>(null);
  const [internalTab, setInternalTab] = useState('members');
  const activeTab = externalTab || internalTab;
  const setActiveTab = (tab: string) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };
  const isAdmin = userRole === 'owner' || userRole === 'resourceAssistant';
  const { canView, canEdit } = useEnterprisePermissions(workspace.id, userRole);

  // Map active tab → help anchor
  const helpAnchorId =
    activeTab === 'members' ? 'workspace.members' :
    activeTab === 'organization' ? 'workspace.organization' :
    activeTab === 'calendar' ? 'workspace.calendar' :
    activeTab === 'requests' ? 'workspace.approvals' :
    'workspace.members';
  useHelpAnchor({ id: helpAnchorId, crumbs: [workspace.name, activeTab] });

  // Fetch current user's membership + profile for "Profilom"
  useEffect(() => {
    const fetchMyMembership = async () => {
      const [{ data: membership }, { data: profile }, { data: members }] = await Promise.all([
        supabase.from('enterprise_memberships').select('*').eq('workspace_id', workspace.id).eq('user_id', userId).eq('status', 'active').maybeSingle(),
        supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle(),
        (supabase as any).from('enterprise_memberships').select('id, user_id, role, status, team, location, business_role, joined_at, city, office_id, base_working_hours').eq('workspace_id', workspace.id).eq('status', 'active'),
      ]);
      if (membership) {
        setMyMembership({ ...membership, display_name: profile?.display_name || 'Ismeretlen' });
      }
      // Enrich members with display names
      if (members && members.length > 0) {
        const userIds = members.map((m: any) => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name || 'Ismeretlen']));
        setAllMembers(members.map((m: any) => ({ ...m, display_name: nameMap.get(m.user_id) || 'Ismeretlen' })));
      }
    };
    fetchMyMembership();
  }, [workspace.id, userId]);

  // Check if any calendar sub-permission is available
  const hasCalendarAccess = canView('calendar');
  // Check if any requests permission is available
  const hasRequestsAccess = canView('requests_own') || canView('requests_team') || canEdit('leave_requests_submit');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div
          className="flex items-center justify-between max-w-5xl mx-auto gap-2"
          data-help-region={helpAnchorId}
        >
          <div className="flex items-center gap-2 min-w-0">
            <HelpButton />
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{workspace.name}</h1>
              {workspace.description && (
                <p className="text-xs text-muted-foreground truncate">{workspace.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell workspaceId={workspace.id} userId={userId} />
            <Button size="sm" variant="outline" onClick={() => setShowMyProfile(true)}>
              <User className="h-4 w-4 mr-1" /> Profilom
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowInvite(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Meghívás
              </Button>
            )}
            <LanguageSelector />
            <Button size="sm" variant="destructive" onClick={signOut} className="gap-1.5">
              <LogOut className="h-4 w-4" /> Kilépés
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sticky top-[57px] z-20 bg-background/95 backdrop-blur border-b px-4">
          <div className="max-w-5xl mx-auto">
            <TabsList className="flex overflow-x-auto w-full justify-start gap-1 h-auto flex-nowrap p-1 bg-transparent rounded-none border-0 shadow-none">
              {canView('members') && (
                <TabsTrigger value="members" className="gap-1">
                  <Users className="h-4 w-4" /> Tagok
                </TabsTrigger>
              )}
              {canView('members') && (
                <TabsTrigger value="organization" className="gap-1">
                  <Building2 className="h-4 w-4" /> Szervezet
                </TabsTrigger>
              )}
              {hasCalendarAccess && (
                <TabsTrigger value="calendar" className="gap-1">
                  <CalendarDays className="h-4 w-4" /> Naptár
                </TabsTrigger>
              )}
              {hasRequestsAccess && (
                <TabsTrigger value="requests" className="gap-1">
                  <FileText className="h-4 w-4" /> Kérelmek
                </TabsTrigger>
              )}
              <TabsTrigger value="resources" className="gap-1">
                <Briefcase className="h-4 w-4" /> Erőforrások
              </TabsTrigger>
              {(canView('reports') || canView('audit') || canView('export')) && (
                <TabsTrigger value="reports-audit" className="gap-1">
                  <BarChart3 className="h-4 w-4" /> Riportok és Audit
                </TabsTrigger>
              )}
              {canView('settings') && (
                <TabsTrigger value="settings" className="gap-1">
                  <Settings className="h-4 w-4" /> Beállítások
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        <main className="max-w-5xl mx-auto p-4">
          <div className="space-y-4">
            {canView('members') && (
              <TabsContent value="members" className="space-y-3">
                {canView('invitations') && (
                  <InvitationsPanel workspaceId={workspace.id} isAdmin={canEdit('invitations')} />
                )}
                <MemberList workspaceId={workspace.id} userId={userId} userRole={userRole} />
              </TabsContent>
            )}

            {canView('members') && (
              <TabsContent value="organization" className="space-y-3">
                <OrganizationModule workspaceId={workspace.id} isAdmin={isAdmin} />
              </TabsContent>
            )}

            {hasCalendarAccess && (
              <TabsContent value="calendar" className="space-y-3">
                <Tabs defaultValue="calendar-main" className="space-y-3">
                  <TabsList className="grid grid-cols-4 w-full sm:w-auto h-auto">
                    <TabsTrigger value="calendar-main">Naptár</TabsTrigger>
                    <TabsTrigger value="calendar-timeline">Idővonal</TabsTrigger>
                    <TabsTrigger value="calendar-coverage">Kapacitástervező</TabsTrigger>
                    <TabsTrigger value="calendar-annual">Éves nézet</TabsTrigger>
                  </TabsList>

                  <TabsContent value="calendar-main" className="space-y-3">
                    <LeaveCalendar
                      workspaceId={workspace.id}
                      onNavigateTab={setActiveTab}
                      showLeaveDays={canView('calendar_leave_days')}
                      showCoverage={canView('calendar_coverage')}
                      showRequests={canView('calendar_requests')}
                      showConflicts={canView('calendar_conflicts')}
                    />
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      <BirthdayAnniversaryWidget workspaceId={workspace.id} />
                      <AnnualTrendChart workspaceId={workspace.id} />
                    </div>
                  </TabsContent>

                  <TabsContent value="calendar-timeline" className="space-y-3">
                    <TimelineView
                      workspaceId={workspace.id}
                      onFilteredUsersChange={(userIds, range) =>
                        setTimelineReport({ userIds, range })
                      }
                    />
                    {timelineReport && timelineReport.userIds.length > 0 && (
                      <SkillCapacityReport
                        workspaceId={workspace.id}
                        filteredUserIds={timelineReport.userIds}
                        range={timelineReport.range}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="calendar-coverage">
                    <CoveragePlannerView
                      workspaceId={workspace.id}
                      userId={userId}
                    />
                  </TabsContent>

                  <TabsContent value="calendar-annual">
                    <AnnualLeaveGrid
                      workspaceId={workspace.id}
                      userId={userId}
                      allMembers={allMembers}
                      isAdmin={isAdmin}
                    />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            )}

            {hasRequestsAccess && (
              <TabsContent value="requests">
                <RequestsAndApprovalsTab
                  workspaceId={workspace.id}
                  userId={userId}
                  userRole={userRole}
                  isAdmin={isAdmin}
                  canApprove={canEdit('approvals')}
                  canOverride={canEdit('admin_override')}
                  canSubmit={canEdit('leave_requests_submit')}
                  canViewOwn={canView('requests_own')}
                  canViewTeam={canView('requests_team')}
                  canViewRules={canView('rules')}
                />
              </TabsContent>
            )}

            <TabsContent value="resources">
              <ResourcesTab workspaceId={workspace.id} userId={userId} isAdmin={isAdmin} />
            </TabsContent>

            {(canView('reports') || canView('audit') || canView('export')) && (
              <TabsContent value="reports-audit">
                <ReportsAndAuditTab workspaceId={workspace.id} userId={userId} />
              </TabsContent>
            )}

            {canView('settings') && (
              <TabsContent value="settings">
                <WorkspaceSettings workspace={workspace} userRole={userRole} userId={userId} onRefresh={onRefresh} canViewPermissionConfig={userRole === 'owner' || canView('permission_config')} canViewLayoutSetting={userRole === 'owner' || canView('layout_setting')} />
              </TabsContent>
            )}
          </div>
        </main>
      </Tabs>

      <InviteMemberDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        workspaceId={workspace.id}
        invitedBy={userId}
        onInvited={() => {}}
      />

      {myMembership && (
        <MemberProfileSheet
          open={showMyProfile}
          onOpenChange={setShowMyProfile}
          member={myMembership}
          workspaceId={workspace.id}
          allMembers={allMembers}
          isAdmin={true}
          showEmail={true}
        />
      )}
    </div>
  );
}

// ===== Combined Requests + Approvals Tab =====
function RequestsAndApprovalsTab({ workspaceId, userId, userRole, isAdmin, canApprove, canOverride, canSubmit, canViewOwn, canViewTeam, canViewRules }: { workspaceId: string; userId: string; userRole: string; isAdmin: boolean; canApprove?: boolean; canOverride?: boolean; canSubmit?: boolean; canViewOwn?: boolean; canViewTeam?: boolean; canViewRules?: boolean }) {
  const [showOverride, setShowOverride] = useState(false);
  // Per user request: all top-level sections start collapsed.
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // Rules sub-sections (each independently collapsible, all default closed)
  const [openApprovalChain, setOpenApprovalChain] = useState(false);
  const [openLeaveTypes, setOpenLeaveTypes] = useState(false);
  const [openHolidays, setOpenHolidays] = useState(false);
  const [openCompanyDays, setOpenCompanyDays] = useState(false);
  const [openBlockedDates, setOpenBlockedDates] = useState(false);
  const [openDailyRules, setOpenDailyRules] = useState(false);
  const [openOfficeCoverage, setOpenOfficeCoverage] = useState(false);
  const [openRuleTemplates, setOpenRuleTemplates] = useState(false);

  return (
    <div className="space-y-4">
      {/* Saját szabadság-egyenleg (kvótakártya) */}
      {(canViewOwn || canSubmit) && (
        <QuotaBalanceCard workspaceId={workspaceId} userId={userId} />
      )}

      {/* Helyettesítési felkérések (felém) */}
      <SubstituteInbox workspaceId={workspaceId} userId={userId} />

      {isAdmin && (
        <Collapsible open={approvalsOpen} onOpenChange={setApprovalsOpen}>
          <CollapsibleTrigger asChild>
            <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Jóváhagyások</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${approvalsOpen ? 'rotate-180' : ''}`} />
              </CardContent>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" onClick={() => setShowOverride(true)} className="text-xs">
                <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Kérelem más nevében
              </Button>
            </div>
            <ApprovalInbox workspaceId={workspaceId} userId={userId} />
            <AdminLeaveOverride open={showOverride} onOpenChange={setShowOverride} workspaceId={workspaceId} adminUserId={userId} onCreated={() => {}} />
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible open={requestsOpen} onOpenChange={setRequestsOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Kérelmek</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${requestsOpen ? 'rotate-180' : ''}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <LeaveRequestList workspaceId={workspaceId} userId={userId} userRole={userRole} canViewOwn={canViewOwn} canViewTeam={canViewTeam} />
        </CollapsibleContent>
      </Collapsible>

      {canViewRules && (
        <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
          <CollapsibleTrigger asChild>
            <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Szabályok</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${rulesOpen ? 'rotate-180' : ''}`} />
              </CardContent>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            <Collapsible open={openApprovalChain} onOpenChange={setOpenApprovalChain}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <span className="text-xs font-medium">Jóváhagyási láncok</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openApprovalChain ? 'rotate-180' : ''}`} />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2"><ApprovalChainManager workspaceId={workspaceId} /></CollapsibleContent>
            </Collapsible>

            <Collapsible open={openLeaveTypes} onOpenChange={setOpenLeaveTypes}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <span className="text-xs font-medium">Távollét típusok</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openLeaveTypes ? 'rotate-180' : ''}`} />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2"><LeaveTypeManager workspaceId={workspaceId} /></CollapsibleContent>
            </Collapsible>

            <Collapsible open={openHolidays} onOpenChange={setOpenHolidays}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <span className="text-xs font-medium">Ünnepnapok</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openHolidays ? 'rotate-180' : ''}`} />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2"><HolidayManager workspaceId={workspaceId} /></CollapsibleContent>
            </Collapsible>

            <Collapsible open={openCompanyDays} onOpenChange={setOpenCompanyDays}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <span className="text-xs font-medium">Cég-szintű napok</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openCompanyDays ? 'rotate-180' : ''}`} />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2"><CompanyLeaveDayManager workspaceId={workspaceId} userId={userId} /></CollapsibleContent>
            </Collapsible>

            <Collapsible open={openBlockedDates} onOpenChange={setOpenBlockedDates}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <span className="text-xs font-medium">Tiltott napok</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openBlockedDates ? 'rotate-180' : ''}`} />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2"><BlockedDateManager workspaceId={workspaceId} userId={userId} /></CollapsibleContent>
            </Collapsible>

            <Collapsible open={openDailyRules} onOpenChange={setOpenDailyRules}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <span className="text-xs font-medium">Napi szabályok</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openDailyRules ? 'rotate-180' : ''}`} />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2"><DailyRuleManager workspaceId={workspaceId} userId={userId} /></CollapsibleContent>
            </Collapsible>

            <Collapsible open={openOfficeCoverage} onOpenChange={setOpenOfficeCoverage}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <span className="text-xs font-medium">Telephelyi lefedettségi szabályok</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openOfficeCoverage ? 'rotate-180' : ''}`} />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2"><OfficeCoverageRuleManager workspaceId={workspaceId} userId={userId} /></CollapsibleContent>
            </Collapsible>

            <Collapsible open={openRuleTemplates} onOpenChange={setOpenRuleTemplates}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <span className="text-xs font-medium">Szabálysablon-könyvtár</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openRuleTemplates ? 'rotate-180' : ''}`} />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2"><RuleTemplateLibrary workspaceId={workspaceId} userId={userId} /></CollapsibleContent>
            </Collapsible>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ===== Combined Reports + Audit + Export Tab =====
function ReportsAndAuditTab({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(true);

  return (
    <div className="space-y-4">
      <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Audit napló</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${auditOpen ? 'rotate-180' : ''}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <AuditLog workspaceId={workspaceId} />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={exportOpen} onOpenChange={setExportOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Export</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <ExportCenter workspaceId={workspaceId} userId={userId} />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Riportok</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${reportsOpen ? 'rotate-180' : ''}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-3">
          <PinnedReportsWidget workspaceId={workspaceId} />
          <ReportingDashboard workspaceId={workspaceId} />
          <ReportLibrary workspaceId={workspaceId} userId={userId} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ===== Invitation List =====
function InvitationList({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_invitations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    setInvitations((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchInvitations(); }, [workspaceId]);

  const handleDelete = async (id: string) => {
    await supabase.from('enterprise_invitations').delete().eq('id', id);
    toast.success('Meghívó törölve');
    fetchInvitations();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Tulajdonos';
      case 'resourceAssistant': return 'Erőforrás asszisztens';
      default: return 'Tag';
    }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  if (invitations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          Nincs függő meghívó.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {invitations.map((inv: any) => (
        <Card key={inv.id}>
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div>
              <p className="font-medium text-sm">{inv.email}</p>
              <Badge variant="outline" className="text-xs">{getRoleLabel(inv.role)}</Badge>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => handleDelete(inv.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===== Workspace Settings =====
function WorkspaceSettings({ workspace, userRole, userId, onRefresh, canViewPermissionConfig = true, canViewLayoutSetting = false }: { workspace: Workspace; userRole?: string; userId: string; onRefresh: () => void; canViewPermissionConfig?: boolean; canViewLayoutSetting?: boolean }) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [saving, setSaving] = useState(false);
  const [customReports, setCustomReports] = useState<{ id: string; name: string; type: string }[]>([
    { id: '1', name: 'Havi csapat összesítő', type: 'team_monthly' },
    { id: '2', name: 'Pozíció lefedettségi riport', type: 'role_coverage' },
  ]);
  const [calendarWidgets, setCalendarWidgets] = useState<{ id: string; name: string; enabled: boolean }[]>([
    { id: 'team_avail', name: 'Csapat elérhetőségi összefoglaló', enabled: true },
    { id: 'upcoming_holidays', name: 'Közelgő ünnepnapok', enabled: true },
    { id: 'coverage_heatmap', name: 'Lefedettségi hőtérkép', enabled: false },
    { id: 'role_summary', name: 'Pozíció szerinti összefoglaló', enabled: false },
  ]);
  const [newReportName, setNewReportName] = useState('');
  const [newReportType, setNewReportType] = useState('custom');
  const [newWidgetName, setNewWidgetName] = useState('');

  const handleSave = async () => {
    setSaving(true);
    const settings = {
      customReports,
      calendarWidgets,
    };
    const { error } = await supabase
      .from('enterprise_workspaces')
      .update({ name: name.trim(), description: description.trim() || null, settings: settings as any })
      .eq('id', workspace.id);
    if (error) {
      toast.error('Hiba a mentéskor');
    } else {
      toast.success('Beállítások mentve');
      onRefresh();
    }
    setSaving(false);
  };

  const addCustomReport = () => {
    const trimmed = newReportName.trim();
    if (!trimmed) return;
    setCustomReports(prev => [...prev, { id: Date.now().toString(), name: trimmed, type: newReportType }]);
    setNewReportName('');
    toast.success('Riport hozzáadva');
  };

  const removeReport = (id: string) => {
    setCustomReports(prev => prev.filter(r => r.id !== id));
  };

  const addCalendarWidget = () => {
    const trimmed = newWidgetName.trim();
    if (!trimmed) return;
    setCalendarWidgets(prev => [...prev, { id: Date.now().toString(), name: trimmed, enabled: true }]);
    setNewWidgetName('');
    toast.success('Widget hozzáadva');
  };

  const toggleWidget = (id: string) => {
    setCalendarWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  const removeWidget = (id: string) => {
    setCalendarWidgets(prev => prev.filter(w => w.id !== id));
  };

  const reportTemplates = [
    { value: 'team_monthly', label: 'Havi csapat összesítő' },
    { value: 'role_coverage', label: 'Pozíció lefedettség' },
    { value: 'approval_throughput', label: 'Jóváhagyási átfutás' },
    { value: 'leave_trend', label: 'Szabadság trend' },
    { value: 'custom', label: 'Egyéni riport' },
  ];

  const isAdmin = userRole === 'owner' || userRole === 'resourceAssistant';
  const { themeStyle, setThemeStyle } = useTheme();
  const layoutOptions: { value: ThemeStyle; label: string }[] = [
    { value: 'enterprise', label: 'Enterprise Classic' },
    { value: 'nebula', label: 'Nebula Strategy (screenshot template)' },
    { value: 'aurora', label: 'Aurora Focus' },
    { value: 'graphite', label: 'Graphite Pro' },
    { value: 'sunrise', label: 'Sunrise Flow' },
    { value: 'mono', label: 'Mono Precision' },
  ];

  return (
    <div className="space-y-3">
      {canViewPermissionConfig && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.permissions" icon={<Shield className="h-4 w-4" />} title="Jogosultságok kezelése">
          <RolePermissionManager workspaceId={workspace.id} userRole={userRole || 'member'} />
        </SettingsSection>
      )}

      {/* Pozíciók és Csapatok átkerültek az Erőforrások fülbe (Single Source of Truth) */}

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.offices" icon={<Settings className="h-4 w-4" />} title="Telephelyek kezelése">
        <OfficeManager workspaceId={workspace.id} />
      </SettingsSection>

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.quota_admin" icon={<Wallet className="h-4 w-4" />} title="Szabadság-kvóták kezelése">
          <QuotaManager workspaceId={workspace.id} adminUserId={userId} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.integrations" icon={<Plug className="h-4 w-4" />} title="Integrációk (Jira / Azure DevOps)">
          <IntegrationManager workspaceId={workspace.id} userId={userId} />
        </SettingsSection>
      )}

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.ical" icon={<Rss className="h-4 w-4" />} title="iCal naptár-feliratkozás">
        <ICalSubscription workspaceId={workspace.id} userId={userId} />
      </SettingsSection>

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.localization" icon={<Settings className="h-4 w-4" />} title="Nyelvi beállítások / Localization">
        <LocalizationSettings workspaceId={workspace.id} />
      </SettingsSection>

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.allowances" icon={<Wallet className="h-4 w-4" />} title="Allowance pool kezelése">
          <AllowanceManager workspaceId={workspace.id} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.workspace_general" icon={<Settings className="h-4 w-4" />} title="Általános workspace szabályok">
          <WorkspaceGeneralSettings workspaceId={workspace.id} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.branding" icon={<Settings className="h-4 w-4" />} title="Branding és white-label">
          <BrandingManager workspaceId={workspace.id} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.csv_import" icon={<Inbox className="h-4 w-4" />} title="CSV import (tagok + szabadságok)">
          <CsvImportPanel workspaceId={workspace.id} userId={userId} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.calendar_filters" icon={<CalendarDays className="h-4 w-4" />} title="Naptár szűrők beállítása">
          <CalendarFilterSettings workspaceId={workspace.id} userId={userId} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.ui_section_states" icon={<Settings className="h-4 w-4" />} title="Menü szekciók alapállapota (cégszintű)">
          <UiSectionStateManager workspaceId={workspace.id} userId={userId} />
        </SettingsSection>
      )}

      {canViewLayoutSetting && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.layout_setting" icon={<LayoutPanelLeft className="h-4 w-4" />} title="Layout Setting">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Válassz a 6 eltérő vizuális template közül funkcionális változás nélkül.</p>
            <Select value={themeStyle} onValueChange={(v) => setThemeStyle(v as ThemeStyle)}>
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {layoutOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SettingsSection>
      )}

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.workspace_meta" icon={<Settings className="h-4 w-4" />} title="Munkaterület beállítások">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Név</label>
            <input
              className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Leírás</label>
            <textarea
              className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Időzóna: {workspace.timezone}</span>
            <span>•</span>
            <span>Locale: {workspace.locale}</span>
          </div>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.report_config" icon={<BarChart3 className="h-4 w-4" />} title="Riport konfiguráció">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Válaszd ki az előre elkészített sablonokból, vagy hozz létre saját riportot a Riportok szekcióhoz.
          </p>
          <div className="space-y-2">
            {customReports.map(report => (
              <div key={report.id} className="flex items-center justify-between rounded-md border p-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm">{report.name}</span>
                  <Badge variant="outline" className="text-[9px]">
                    {reportTemplates.find(t => t.value === report.type)?.label || 'Egyéni'}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeReport(report.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium">Új riport hozzáadása</p>
            <div className="flex gap-2">
              <Select value={newReportType} onValueChange={setNewReportType}>
                <SelectTrigger className="h-8 text-xs w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTemplates.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                placeholder="Riport neve"
                value={newReportName}
                onChange={(e) => setNewReportName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomReport()}
              />
              <Button size="sm" onClick={addCustomReport} disabled={!newReportName.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.calendar_sidebar" icon={<CalendarDays className="h-4 w-4" />} title="Naptár oldalsáv widgetek">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Konfiguráld, mely extra panelek jelenjenek meg a naptár nézetben. Az alapértelmezett panelek (Szabadságnapok, Konfliktusok, Igények) mindig láthatóak.
          </p>
          <div className="space-y-1.5">
            {['Szabadságnapok panel', 'Konfliktusok panel', 'Igények panel'].map(name => (
              <label key={name} className="flex items-center gap-2 text-sm opacity-60">
                <input type="checkbox" checked disabled className="rounded border-border" />
                <span>{name}</span>
                <Badge variant="outline" className="text-[9px] h-4">Kötelező</Badge>
              </label>
            ))}
          </div>
          <Separator />
          <div className="space-y-1.5">
            {calendarWidgets.map(widget => (
              <div key={widget.id} className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={widget.enabled}
                    onChange={() => toggleWidget(widget.id)}
                    className="rounded border-border"
                  />
                  <span>{widget.name}</span>
                </label>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeWidget(widget.id)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
              placeholder="Új widget neve (pl. Sprint kapacitás)"
              value={newWidgetName}
              onChange={(e) => setNewWidgetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCalendarWidget()}
            />
            <Button size="sm" onClick={addCalendarWidget} disabled={!newWidgetName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Hozzáadás
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({ workspaceId, sectionKey, icon, title, children, defaultOpen = false }: { workspaceId?: string; sectionKey?: string; icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  // Cégszintű (workspace-szintű) konfigurálható alapállapot felülírja a defaultOpen-t.
  const [open, setOpen] = useWorkspaceSectionState(workspaceId, sectionKey || `__local__${title}`, defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-medium">{title}</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 border-t">
            {children}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
