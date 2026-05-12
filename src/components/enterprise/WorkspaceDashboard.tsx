import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Users, UserPlus, Shield, Settings, Trash2, FileText, ShieldAlert, BarChart3, Bell, Download, History, CalendarDays, ChevronDown, Plus, User, Briefcase, Wallet, Plug, Rss, Inbox, LayoutPanelLeft, LogOut, Building2, GitMerge, CircleHelp, Clock, LayoutDashboard, TrendingUp, Code2, CreditCard, ShieldCheck } from 'lucide-react';
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
import { ImportExportCenter } from './import-export/ImportExportCenter';
import { TimeAttendancePage } from './time-attendance/TimeAttendancePage';
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
import { WorkflowsModule } from './workflows/WorkflowsModule';
import { EmployeeDashboard } from './self-service/EmployeeDashboard';
import { RecoveryModeSettings } from './settings/RecoveryModeSettings';
import { CapacityDnaPanel } from './CapacityDnaPanel';
import { OrgPulseButton } from './OrgPulseButton';
import { CommandCenterButton } from './CommandCenterButton';
import { IntegrationHealthCenter } from './settings/IntegrationHealthCenter';
import { M365IntegrationPanel } from './settings/M365IntegrationPanel';
import { HelpSystemSettings } from './settings/HelpSystemSettings';
import { DecisionMemoryStaleInbox } from './DecisionMemoryStaleInbox';
import { useI18n } from '@/i18n/I18nProvider';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { WorkspaceSidebar } from '@/components/shell/WorkspaceSidebar';
import { DensityToggle } from '@/components/shell/DensityToggle';
import { SkipToContent } from '@/components/shell/AppShell';
import { useWorkspaceNavLayout } from '@/hooks/useWorkspaceNavLayout';
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard';
import { DeveloperPortal } from './developer/DeveloperPortal';
import { WellbeingScoreCard } from './wellbeing/WellbeingScoreCard';
import { SecurityCenter } from './security/SecurityCenter';

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

const WORKSPACE_TOP_NAV_ITEMS = [
  { value: 'my-portal', i18nKey: 'ws_nav.my_portal', icon: LayoutDashboard },
  { value: 'members', i18nKey: 'ws_nav.members', icon: Users },
  { value: 'organization', i18nKey: 'ws_nav.organization', icon: Building2 },
  { value: 'calendar', i18nKey: 'ws_nav.calendar', icon: CalendarDays },
  { value: 'time-attendance', i18nKey: 'ws_nav.time_attendance', icon: Clock },
  { value: 'requests', i18nKey: 'ws_nav.requests', icon: FileText },
  { value: 'workflows', i18nKey: 'ws_nav.workflows', icon: GitMerge },
  { value: 'resources', i18nKey: 'ws_nav.resources', icon: Briefcase },
  { value: 'reports-audit', i18nKey: 'ws_nav.reports', icon: BarChart3 },
  { value: 'analytics', i18nKey: 'ws_nav.analytics', icon: TrendingUp },
  { value: 'developer', i18nKey: 'ws_nav.developer', icon: Code2 },
  { value: 'security', i18nKey: 'ws_nav.security', icon: ShieldCheck },
  { value: 'settings', i18nKey: 'ws_nav.settings', icon: Settings },
] as const;

export function WorkspaceDashboard({ workspace, userRole, userId, onBack, onRefresh, activeTab: externalTab, onTabChange }: Props) {
  const { signOut } = useAuth();
  const { loadWorkspaceOverrides, t } = useI18n();
  const [showInvite, setShowInvite] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [myMembership, setMyMembership] = useState<any>(null);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [timelineReport, setTimelineReport] = useState<{ userIds: string[]; range: { from: Date; to: Date } } | null>(null);
  // Stable callback reference — prevents infinite re-render loop in TimelineView
  const handleFilteredUsersChange = useCallback(
    (userIds: string[], range: { from: Date; to: Date }) => setTimelineReport({ userIds, range }),
    []
  );
  const [internalTab, setInternalTab] = useState('members');
  const [recoveryMode, setRecoveryMode] = useState<boolean>(false);
  const activeTab = externalTab || internalTab;
  const setActiveTab = (tab: string) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };
  const isAdmin = userRole === 'owner' || userRole === 'resourceAssistant';
  const { canView, canEdit } = useEnterprisePermissions(workspace.id, userRole);
  const { layout } = useWorkspaceNavLayout(workspace.id);

  // Map active tab → help anchor
  const helpAnchorId =
    activeTab === 'my-portal' ? 'workspace.my_portal' :
    activeTab === 'members' ? 'workspace.members' :
    activeTab === 'organization' ? 'workspace.organization' :
    activeTab === 'calendar' ? 'workspace.calendar' :
    activeTab === 'requests' ? 'workspace.approvals' :
    activeTab === 'workflows' ? 'workspace.workflows' :
    activeTab === 'resources' ? 'workspace.resources' :
    activeTab === 'reports-audit' ? 'workspace.reports' :
    activeTab === 'settings' ? 'workspace.settings' :
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
        setMyMembership({ ...membership, display_name: profile?.display_name || t('ws_nav.unknown_user') });
      }
      // Enrich members with display names
      if (members && members.length > 0) {
        const userIds = members.map((m: any) => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name || t('ws_nav.unknown_user')]));
        setAllMembers(members.map((m: any) => ({ ...m, display_name: nameMap.get(m.user_id) || t('ws_nav.unknown_user') })));
      }
    };
    fetchMyMembership();
  }, [workspace.id, userId]);

  // Load workspace-scoped translation overrides (Phase 8 — admin-managed CSV).
  useEffect(() => {
    loadWorkspaceOverrides(workspace.id);
    return () => {
      loadWorkspaceOverrides(null);
    };
  }, [workspace.id, loadWorkspaceOverrides]);

  // Track workspace recovery mode flag (additive column added by v3.0.0 Phase 6).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('enterprise_workspaces')
        .select('recovery_mode')
        .eq('id', workspace.id)
        .maybeSingle();
      if (!cancelled) setRecoveryMode(!!data?.recovery_mode);
    })();
    const id = window.setInterval(async () => {
      const { data } = await (supabase as any)
        .from('enterprise_workspaces')
        .select('recovery_mode')
        .eq('id', workspace.id)
        .maybeSingle();
      if (!cancelled) setRecoveryMode(!!data?.recovery_mode);
    }, 90_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [workspace.id]);

  // Check if any calendar sub-permission is available
  const hasCalendarAccess = canView('calendar');
  // Check if any requests permission is available
  const hasRequestsAccess = canView('requests_own') || canView('requests_team') || canEdit('leave_requests_submit');

  return (
    <SidebarProvider>
      <SkipToContent />
      <div
        className="min-h-screen flex w-full bg-background"
        style={{
          '--ws-header-h': '53px',
          '--ws-main-tabs-h': layout === 'sidebar' ? '0px' : '65px',
        } as any}
      >
        {layout === 'sidebar' && (
          <WorkspaceSidebar
            workspaceName={workspace.name}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onBack={onBack}
            canViewMembers={canView('members')}
            hasCalendarAccess={hasCalendarAccess}
            hasRequestsAccess={hasRequestsAccess}
            canViewReports={canView('reports') || canView('audit') || canView('export')}
            canViewSettings={canView('settings')}
          />
        )}
        <SidebarInset className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-[var(--shell-pad-x,1rem)] py-2">
            <div
              className="flex items-center justify-between gap-2 w-full"
              data-help-region={helpAnchorId}
            >
              <div className="flex items-center gap-2 min-w-0">
                {layout === 'sidebar' ? (
                  <SidebarTrigger />
                ) : (
                  <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('ws_nav.back_to_workspaces')}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <HelpButton />
                <div className="min-w-0">
                  <h1 className="text-base font-semibold truncate">{workspace.name}</h1>
                  {workspace.description && (
                    <p className="text-xs text-muted-foreground truncate">{workspace.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {isAdmin && <CommandCenterButton workspaceId={workspace.id} onOpenTab={setActiveTab} recoveryMode={recoveryMode} />}
                {isAdmin && <OrgPulseButton workspaceId={workspace.id} />}
                <NotificationBell workspaceId={workspace.id} userId={userId} />
                <DensityToggle workspaceId={workspace.id} />
                <Button size="sm" variant="outline" onClick={() => setShowMyProfile(true)}>
                  <User className="h-4 w-4 mr-1" /> {t('ws_nav.profile_btn')}
                </Button>
                {isAdmin && (
                  <Button size="sm" onClick={() => setShowInvite(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> {t('ws_nav.invite_btn')}
                  </Button>
                )}
                <LanguageSelector />
                <Button size="sm" variant="destructive" onClick={signOut} className="gap-1.5">
                  <LogOut className="h-4 w-4" /> {t('ws_nav.sign_out_btn')}
                </Button>
              </div>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={layout === 'sidebar' ? 'sr-only' : 'sticky top-[var(--ws-header-h)] z-20 flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-b !bg-background shadow-sm px-[var(--shell-pad-x,1rem)] py-2.5'}>
              {WORKSPACE_TOP_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const visible =
                  item.value === 'my-portal' ? true :
                  item.value === 'members' ? canView('members') :
                  item.value === 'organization' ? canView('members') :
                  item.value === 'calendar' ? hasCalendarAccess :
                  item.value === 'time-attendance' ? true :
                  item.value === 'requests' ? hasRequestsAccess :
                  item.value === 'workflows' ? canView('members') :
                  item.value === 'resources' ? true :
                  item.value === 'reports-audit' ? (canView('reports') || canView('audit') || canView('export')) :
                  item.value === 'analytics' ? isAdmin :
                  item.value === 'developer' ? isAdmin :
                  item.value === 'security' ? isAdmin :
                  item.value === 'settings' ? canView('settings') :
                  true;

                if (!visible) return null;

                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="group h-11 shrink-0 gap-2 rounded-xl border border-transparent bg-transparent px-3.5 text-sm font-medium text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(item.i18nKey as any)}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div id="main-content" className="w-full px-[var(--shell-pad-x,1rem)] py-[var(--shell-pad-y,1rem)]">
              <div className="space-y-4 w-full">
            {null}
            <TabsContent value="my-portal" className="space-y-3">
              <EmployeeDashboard
                workspaceId={workspace.id}
                userId={userId}
                isAdmin={isAdmin}
                onNavigateTab={setActiveTab}
              />
              <WellbeingScoreCard workspaceId={workspace.id} userId={userId} />
            </TabsContent>

            {canView('members') && (
              <TabsContent value="members" className="space-y-3">
                {canView('invitations') && (
                  <InvitationsPanel workspaceId={workspace.id} isAdmin={canEdit('invitations')} />
                )}
                <MemberList workspaceId={workspace.id} userId={userId} userRole={userRole} onNavigateTab={setActiveTab} />
              </TabsContent>
            )}

            {canView('members') && (
              <TabsContent value="organization" className="space-y-3">
                <OrganizationModule
                  workspaceId={workspace.id}
                  isAdmin={isAdmin}
                  onNavigateTab={setActiveTab}
                  userId={userId}
                />
              </TabsContent>
            )}

            {canView('members') && (
              <TabsContent value="workflows" className="space-y-3">
                <WorkflowsModule workspaceId={workspace.id} isAdmin={isAdmin} userId={userId} />
              </TabsContent>
            )}

            {hasCalendarAccess && (
              <TabsContent value="calendar" className="space-y-3">
                <Tabs defaultValue="calendar-main" className="space-y-3">
                  <TabsList className="sticky top-[calc(var(--ws-header-h)_+_var(--ws-main-tabs-h))] z-10 grid grid-cols-4 w-full h-auto !bg-background border-b rounded-none shadow-sm">
                    <TabsTrigger value="calendar-main">{t('ws_nav.cal_main')}</TabsTrigger>
                    <TabsTrigger value="calendar-timeline">{t('ws_nav.cal_timeline')}</TabsTrigger>
                    <TabsTrigger value="calendar-coverage">{t('ws_nav.cal_coverage')}</TabsTrigger>
                    <TabsTrigger value="calendar-annual">{t('ws_nav.cal_annual')}</TabsTrigger>
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
                      onFilteredUsersChange={handleFilteredUsersChange}
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

            <TabsContent value="time-attendance" className="space-y-3" data-help-region="workspace.time_attendance">
              <TimeAttendancePage workspaceId={workspace.id} isAdmin={isAdmin} />
            </TabsContent>

            {hasRequestsAccess && (
              <TabsContent value="requests" data-help-region="workspace.approvals">
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

            <TabsContent value="resources" className="space-y-4" data-help-region="workspace.resources">
              <ResourcesTab workspaceId={workspace.id} userId={userId} isAdmin={isAdmin} />
              <CapacityDnaPanel workspaceId={workspace.id} isAdmin={isAdmin} />
            </TabsContent>

            {(canView('reports') || canView('audit') || canView('export')) && (
              <TabsContent value="reports-audit" data-help-region="workspace.reports">
                <ReportsAndAuditTab workspaceId={workspace.id} userId={userId} />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="analytics" className="space-y-4">
                <AnalyticsDashboard workspaceId={workspace.id} isAdmin={isAdmin} />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="developer" className="space-y-4">
                <DeveloperPortal workspaceId={workspace.id} userId={userId} />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="security" className="space-y-4">
                <SecurityCenter workspaceId={workspace.id} userId={userId} isAdmin={isAdmin} />
              </TabsContent>
            )}

            {canView('settings') && (
              <TabsContent value="settings" data-help-region="workspace.settings">
                <WorkspaceSettings workspace={workspace} userRole={userRole} userId={userId} onRefresh={onRefresh} canViewPermissionConfig={userRole === 'owner' || canView('permission_config')} canViewLayoutSetting={userRole === 'owner' || canView('layout_setting')} />
              </TabsContent>
            )}
              </div>
            </div>
          </Tabs>
        </SidebarInset>
      </div>

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
    </SidebarProvider>
  );
}

// ===== Combined Requests + Approvals Tab =====
function RequestsAndApprovalsTab({ workspaceId, userId, userRole, isAdmin, canApprove, canOverride, canSubmit, canViewOwn, canViewTeam, canViewRules }: { workspaceId: string; userId: string; userRole: string; isAdmin: boolean; canApprove?: boolean; canOverride?: boolean; canSubmit?: boolean; canViewOwn?: boolean; canViewTeam?: boolean; canViewRules?: boolean }) {
  const { t } = useI18n();
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
                  <span className="font-medium text-sm">{t('ws_nav.section_approvals')}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${approvalsOpen ? 'rotate-180' : ''}`} />
              </CardContent>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="flex justify-end mb-2">
              <Button size="sm" variant="outline" onClick={() => setShowOverride(true)} className="text-xs">
                <ShieldAlert className="h-3.5 w-3.5 mr-1" /> {t('ws_nav.override_btn')}
              </Button>
            </div>
            <ApprovalInbox workspaceId={workspaceId} userId={userId} />
            <AdminLeaveOverride open={showOverride} onOpenChange={setShowOverride} workspaceId={workspaceId} adminUserId={userId} onCreated={() => {}} />
            <DecisionMemoryStaleInbox workspaceId={workspaceId} isAdmin={isAdmin} authoredBy={userId} />
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible open={requestsOpen} onOpenChange={setRequestsOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{t('ws_nav.section_requests')}</span>
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
                  <span className="font-medium text-sm">{t('ws_nav.section_rules')}</span>
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
                    <span className="text-xs font-medium">{t('ws_nav.section_approval_chains')}</span>
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
                    <span className="text-xs font-medium">{t('ws_nav.section_leave_types')}</span>
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
                    <span className="text-xs font-medium">{t('ws_nav.section_holidays')}</span>
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
                    <span className="text-xs font-medium">{t('ws_nav.section_company_days')}</span>
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
                    <span className="text-xs font-medium">{t('ws_nav.section_blocked_dates')}</span>
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
                    <span className="text-xs font-medium">{t('ws_nav.section_daily_rules')}</span>
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
                    <span className="text-xs font-medium">{t('ws_nav.section_coverage_rules')}</span>
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
                    <span className="text-xs font-medium">{t('ws_nav.section_rule_templates')}</span>
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
  const { t } = useI18n();
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
                <span className="font-medium text-sm">{t('ws_nav.section_audit')}</span>
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
                <span className="font-medium text-sm">{t('ws_nav.section_export')}</span>
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
                <span className="font-medium text-sm">{t('ws_nav.section_reports')}</span>
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
  const { t } = useI18n();
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
    toast.success(t('members.invitation_deleted'));
    fetchInvitations();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t('members.roles.owner');
      case 'resourceAssistant': return t('members.roles.resource_assistant');
      default: return t('members.roles.member');
    }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  if (invitations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          {t('members.no_pending_invitations')}
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
  const { t } = useI18n();
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [saving, setSaving] = useState(false);
  const [customReports, setCustomReports] = useState<{ id: string; name: string; type: string }[]>([
    { id: '1', name: t('workspace_settings.tmpl_team_monthly'), type: 'team_monthly' },
    { id: '2', name: t('workspace_settings.tmpl_role_coverage'), type: 'role_coverage' },
  ]);
  const [calendarWidgets, setCalendarWidgets] = useState<{ id: string; name: string; enabled: boolean }[]>([
    { id: 'team_avail', name: t('workspace_settings.widget_team_avail'), enabled: true },
    { id: 'upcoming_holidays', name: t('workspace_settings.widget_upcoming_holidays'), enabled: true },
    { id: 'coverage_heatmap', name: t('workspace_settings.widget_coverage_heatmap'), enabled: false },
    { id: 'role_summary', name: t('workspace_settings.widget_role_summary'), enabled: false },
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
      toast.error(t('workspace_settings.toast_save_failed'));
    } else {
      toast.success(t('workspace_settings.toast_saved'));
      onRefresh();
    }
    setSaving(false);
  };

  const addCustomReport = () => {
    const trimmed = newReportName.trim();
    if (!trimmed) return;
    setCustomReports(prev => [...prev, { id: Date.now().toString(), name: trimmed, type: newReportType }]);
    setNewReportName('');
    toast.success(t('workspace_settings.toast_report_added'));
  };

  const removeReport = (id: string) => {
    setCustomReports(prev => prev.filter(r => r.id !== id));
  };

  const addCalendarWidget = () => {
    const trimmed = newWidgetName.trim();
    if (!trimmed) return;
    setCalendarWidgets(prev => [...prev, { id: Date.now().toString(), name: trimmed, enabled: true }]);
    setNewWidgetName('');
    toast.success(t('workspace_settings.toast_widget_added'));
  };

  const toggleWidget = (id: string) => {
    setCalendarWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  const removeWidget = (id: string) => {
    setCalendarWidgets(prev => prev.filter(w => w.id !== id));
  };

  const reportTemplates = [
    { value: 'team_monthly', label: t('workspace_settings.tmpl_team_monthly') },
    { value: 'role_coverage', label: t('workspace_settings.tmpl_role_coverage_short') },
    { value: 'approval_throughput', label: t('workspace_settings.tmpl_approval_throughput') },
    { value: 'leave_trend', label: t('workspace_settings.tmpl_leave_trend') },
    { value: 'custom', label: t('workspace_settings.tmpl_custom') },
  ];

  const isAdmin = userRole === 'owner' || userRole === 'resourceAssistant';
  const { themeStyle, setThemeStyle } = useTheme();
  const layoutOptions: { value: ThemeStyle; label: string }[] = [
    { value: 'enterprise', label: 'Enterprise Classic' },
    { value: 'nebula', label: 'Nebula Strategy (screenshot template)' },
    { value: 'nebula-obsidian', label: 'Nebula Obsidian' },
    { value: 'aurora', label: 'Aurora Focus' },
    { value: 'graphite', label: 'Graphite Pro' },
    { value: 'sunrise', label: 'Sunrise Flow' },
    { value: 'mono', label: 'Mono Precision' },
  ];

  return (
    <div className="space-y-3">
      {canViewPermissionConfig && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.permissions" icon={<Shield className="h-4 w-4" />} title={t('settings_sections.permissions')}>
          <RolePermissionManager workspaceId={workspace.id} userRole={userRole || 'member'} />
        </SettingsSection>
      )}

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.offices" icon={<Settings className="h-4 w-4" />} title={t('settings_sections.offices')}>
        <OfficeManager workspaceId={workspace.id} />
      </SettingsSection>

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.quota_admin" icon={<Wallet className="h-4 w-4" />} title={t('settings_sections.quota_admin')}>
          <QuotaManager workspaceId={workspace.id} adminUserId={userId} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.integrations" icon={<Plug className="h-4 w-4" />} title={t('settings_sections.integrations')}>
          <IntegrationManager workspaceId={workspace.id} userId={userId} />
        </SettingsSection>
      )}

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.ical" icon={<Rss className="h-4 w-4" />} title={t('settings_sections.ical')}>
        <ICalSubscription workspaceId={workspace.id} userId={userId} />
      </SettingsSection>

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.localization" icon={<Settings className="h-4 w-4" />} title={t('settings_sections.localization')}>
        <LocalizationSettings workspaceId={workspace.id} isAdmin={isAdmin} userId={userId} />
      </SettingsSection>

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.recovery_mode" icon={<ShieldAlert className="h-4 w-4" />} title={t('settings_sections.recovery_mode')}>
          <RecoveryModeSettings workspaceId={workspace.id} userId={userId} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.integration_health" icon={<Plug className="h-4 w-4" />} title={t('settings_sections.integration_health')}>
          <IntegrationHealthCenter workspaceId={workspace.id} />
        </SettingsSection>
      )}

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.m365_calendar" icon={<Plug className="h-4 w-4" />} title={t('m365.title')}>
        <M365IntegrationPanel workspaceId={workspace.id} />
      </SettingsSection>

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.help_system" icon={<CircleHelp className="h-4 w-4" />} title={t('settings_sections.help_system')}>
          <HelpSystemSettings workspaceId={workspace.id} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.allowances" icon={<Wallet className="h-4 w-4" />} title={t('settings_sections.allowances')}>
          <AllowanceManager workspaceId={workspace.id} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.workspace_general" icon={<Settings className="h-4 w-4" />} title={t('settings_sections.workspace_general')}>
          <WorkspaceGeneralSettings workspaceId={workspace.id} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.branding" icon={<Settings className="h-4 w-4" />} title={t('settings_sections.branding')}>
          <BrandingManager workspaceId={workspace.id} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.import_export" icon={<Inbox className="h-4 w-4" />} title={t('settings_sections.import_export')}>
          <ImportExportCenter workspaceId={workspace.id} userId={userId} isAdmin={isAdmin} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.calendar_filters" icon={<CalendarDays className="h-4 w-4" />} title={t('settings_sections.calendar_filters')}>
          <CalendarFilterSettings workspaceId={workspace.id} userId={userId} />
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.ui_section_states" icon={<Settings className="h-4 w-4" />} title={t('settings_sections.ui_section_states')}>
          <UiSectionStateManager workspaceId={workspace.id} userId={userId} />
        </SettingsSection>
      )}

      {canViewLayoutSetting && (
        <SettingsSection workspaceId={workspace.id} sectionKey="settings.layout_setting" icon={<LayoutPanelLeft className="h-4 w-4" />} title={t('settings_sections.layout_setting')}>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('workspace_settings.section_layout_desc')}</p>
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

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.workspace_meta" icon={<Settings className="h-4 w-4" />} title={t('workspace_settings.section_meta_title')}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t('common.name')}</label>
            <input
              className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('common.description')}</label>
            <textarea
              className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t('workspace_settings.section_meta_timezone')} {workspace.timezone}</span>
            <span>•</span>
            <span>{t('workspace_settings.section_meta_locale')} {workspace.locale}</span>
          </div>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.report_config" icon={<BarChart3 className="h-4 w-4" />} title={t('workspace_settings.section_report_title')}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t('workspace_settings.section_report_desc')}
          </p>
          <div className="space-y-2">
            {customReports.map(report => (
              <div key={report.id} className="flex items-center justify-between rounded-md border p-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm">{report.name}</span>
                  <Badge variant="outline" className="text-[9px]">
                    {reportTemplates.find(tmpl => tmpl.value === report.type)?.label || t('workspace_settings.section_report_custom_badge')}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeReport(report.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          <div className="border rounded-md p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium">{t('workspace_settings.section_report_add_label')}</p>
            <div className="flex gap-2">
              <Select value={newReportType} onValueChange={setNewReportType}>
                <SelectTrigger className="h-8 text-xs w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTemplates.map(tmpl => (
                    <SelectItem key={tmpl.value} value={tmpl.value}>{tmpl.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                placeholder={t('workspace_settings.section_report_name_placeholder')}
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

      <SettingsSection workspaceId={workspace.id} sectionKey="settings.calendar_sidebar" icon={<CalendarDays className="h-4 w-4" />} title={t('workspace_settings.section_calendar_title')}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t('workspace_settings.section_calendar_desc')}
          </p>
          <div className="space-y-1.5">
            {[
              t('workspace_settings.section_calendar_panel_leave'),
              t('workspace_settings.section_calendar_panel_conflicts'),
              t('workspace_settings.section_calendar_panel_requests'),
            ].map(panelName => (
              <label key={panelName} className="flex items-center gap-2 text-sm opacity-60">
                <input type="checkbox" checked disabled className="rounded border-border" />
                <span>{panelName}</span>
                <Badge variant="outline" className="text-[9px] h-4">{t('common.required')}</Badge>
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
              placeholder={t('workspace_settings.section_calendar_widget_placeholder')}
              value={newWidgetName}
              onChange={(e) => setNewWidgetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCalendarWidget()}
            />
            <Button size="sm" onClick={addCalendarWidget} disabled={!newWidgetName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t('common.add')}
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
