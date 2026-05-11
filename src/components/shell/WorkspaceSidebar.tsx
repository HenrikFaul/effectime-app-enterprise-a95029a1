import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Users,
  Building2,
  CalendarDays,
  FileText,
  GitMerge,
  Briefcase,
  BarChart3,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import { useT } from '@/i18n/I18nProvider';

export interface WorkspaceNavItem {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
}

interface Props {
  workspaceName: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBack: () => void;
  canViewMembers: boolean;
  hasCalendarAccess: boolean;
  hasRequestsAccess: boolean;
  canViewReports: boolean;
  canViewSettings: boolean;
}

/**
 * WorkspaceSidebar — collapsible primary navigation for the in-workspace
 * experience. Replaces the old horizontal tab strip but keeps the same
 * `activeTab` contract so the existing Tabs-based content area renders
 * unchanged (zero functional regression).
 */
export function WorkspaceSidebar({
  workspaceName,
  activeTab,
  onTabChange,
  onBack,
  canViewMembers,
  hasCalendarAccess,
  hasRequestsAccess,
  canViewReports,
  canViewSettings,
}: Props) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const t = useT();

  const items: WorkspaceNavItem[] = [
    { value: 'members', label: t('ws_nav.members'), icon: Users, visible: canViewMembers },
    { value: 'organization', label: t('ws_nav.organization'), icon: Building2, visible: canViewMembers },
    { value: 'calendar', label: t('ws_nav.calendar'), icon: CalendarDays, visible: hasCalendarAccess },
    { value: 'requests', label: t('ws_nav.requests'), icon: FileText, visible: hasRequestsAccess },
    { value: 'workflows', label: t('ws_nav.workflows'), icon: GitMerge, visible: canViewMembers },
    { value: 'resources', label: t('ws_nav.resources'), icon: Briefcase, visible: true },
    { value: 'reports-audit', label: t('ws_nav.reports_audit'), icon: BarChart3, visible: canViewReports },
    { value: 'settings', label: t('ws_nav.settings'), icon: Settings, visible: canViewSettings },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1.5 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 shrink-0"
            aria-label={t('ws_nav.back_to_workspaces')}
            title={t('ws_nav.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <EffectimeLogo size={18} variant="mark" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('ws_nav.workspace_label')}
                </span>
              </div>
              <div className="text-sm font-semibold truncate" title={workspaceName}>
                {workspaceName}
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t('ws_nav.navigation_label')}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((i) => i.visible)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.value;
                  return (
                    <SidebarMenuItem key={item.value}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => onTabChange(item.value)}
                        tooltip={item.label}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
