import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, LogOut, Building2, Trash2, Loader2, SlidersHorizontal, ArrowRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreateWorkspaceDialog } from '@/components/enterprise/CreateWorkspaceDialog';
import { WorkspaceDashboard } from '@/components/enterprise/WorkspaceDashboard';
import { DemoSeedConfigDialog } from '@/components/enterprise/DemoSeedConfigDialog';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import { HelpButton } from '@/components/help/HelpButton';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { useHelpAnchor } from '@/lib/help/registry';
import { useT } from '@/i18n/I18nProvider';
import { AppShell, SkipToContent } from '@/components/shell/AppShell';
import { PageHeader } from '@/components/shell/PageHeader';
import { DensityToggle } from '@/components/shell/DensityToggle';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  locale: string;
  created_at: string;
  is_archived: boolean;
}

interface Membership {
  id: string;
  workspace_id: string;
  role: string;
  status: string;
  team: string | null;
  location: string | null;
}

const ACTIVE_WORKSPACE_KEY = 'active_workspace_id';

export default function Enterprise() {
  const { user, signOut } = useAuth();
  const t = useT();
  useHelpAnchor({ id: 'home.overview', crumbs: ['Effectime', 'Workspaces'] });
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(null);
  const [userClearedWorkspace, setUserClearedWorkspace] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showSeedConfig, setShowSeedConfig] = useState(false);
  // NOTE: must be declared above any early returns to satisfy the Rules of Hooks.
  const [filter, setFilter] = useState('');

  const activeTab = searchParams.get('tab') || 'members';
  const inviteToken = searchParams.get('invite') || null;
  const forceSelector = searchParams.get('select') === '1';

  // When navigated with ?select=1 (e.g. from Landing's "Munkaterület" button),
  // suppress the auto-select-last-workspace behavior so the user always sees
  // the picker.
  useEffect(() => {
    if (!forceSelector) return;
    setUserClearedWorkspace(true);
    setSelectedWorkspaceIdState(null);
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('select');
    setSearchParams(nextParams, { replace: true });
  }, [forceSelector, searchParams, setSearchParams]);

  const setSelectedWorkspaceId = (id: string | null) => {
    setSelectedWorkspaceIdState(id);
    if (id) {
      setUserClearedWorkspace(false);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'members');
      nextParams.delete('invite');
      nextParams.delete('ws');
      setSearchParams(nextParams, { replace: true });
      return;
    }

    setUserClearedWorkspace(true);
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('invite');
    nextParams.delete('ws');
    nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
  };

  const setActiveTab = (tab: string) => {
    if (!selectedWorkspaceId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    nextParams.delete('ws');
    // push (not replace) so the browser Back button traverses tab history
    setSearchParams(nextParams);
  };

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: membershipData } = await supabase
        .from('enterprise_memberships')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'invited']);

      setMemberships((membershipData as any[]) || []);

      if (membershipData && membershipData.length > 0) {
        const wsIds = (membershipData as any[]).map((m: any) => m.workspace_id);
        const { data: wsData } = await supabase
          .from('enterprise_workspaces')
          .select('*')
          .in('id', wsIds)
          .eq('is_archived', false);
        setWorkspaces((wsData as any[]) || []);
      } else {
        const { data: ownedData } = await supabase
          .from('enterprise_workspaces')
          .select('*')
          .eq('created_by', user.id)
          .eq('is_archived', false);
        setWorkspaces((ownedData as any[]) || []);
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (!workspaces.length) {
      setSelectedWorkspaceIdState(null);
      return;
    }

    // Don't auto-select when the user explicitly navigated back to the selector
    if (userClearedWorkspace) return;

    const wsFromUrl = searchParams.get('ws');
    const storedWorkspaceId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    const fallbackWorkspaceId = workspaces[0]?.id ?? null;
    const candidate = wsFromUrl || storedWorkspaceId || fallbackWorkspaceId;
    const resolvedWorkspace = workspaces.find((w) => w.id === candidate) || null;
    const resolvedWorkspaceId = resolvedWorkspace?.id ?? null;

    if (resolvedWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceIdState(resolvedWorkspaceId);
    }

    if (resolvedWorkspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, resolvedWorkspaceId);
    }

    if (wsFromUrl) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('ws');
      if (!nextParams.get('tab')) nextParams.set('tab', 'members');
      setSearchParams(nextParams, { replace: true });
    }
  }, [workspaces, searchParams, setSearchParams, selectedWorkspaceId, userClearedWorkspace]);

  useEffect(() => {
    if (!user || !inviteToken || acceptingInvite) return;

    let cancelled = false;

    const acceptInvite = async () => {
      setAcceptingInvite(true);

      const { data, error } = await supabase.functions.invoke('join-event', {
        body: {
          action: 'accept-enterprise-invite',
          invitation_token: inviteToken,
        },
      });

      if (cancelled) return;

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('invite');
      nextParams.delete('ws');

      if (error || data?.error) {
        toast.error(data?.error || t('enterprise_page.accept_invite_error'));
        setSearchParams(nextParams, { replace: true });
        setAcceptingInvite(false);
        return;
      }

      await fetchWorkspaces();
      if (cancelled) return;

      if (data?.workspace_id) {
        setSelectedWorkspaceIdState(data.workspace_id);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, data.workspace_id);
        nextParams.set('tab', 'members');
      }

      setSearchParams(nextParams, { replace: true });
      toast.success(data?.already_member ? t('enterprise_page.already_member') : t('enterprise_page.invite_accepted'));
      setAcceptingInvite(false);
    };

    acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [user, inviteToken, acceptingInvite, fetchWorkspaces, searchParams, setSearchParams]);

  const getRoleForWorkspace = (wsId: string) => {
    const m = memberships.find(m => m.workspace_id === wsId);
    return m?.role || 'member';
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from('enterprise_workspaces')
      .delete()
      .eq('id', workspaceToDelete.id);
    if (error) {
      toast.error(t('enterprise_page.delete_error') + ': ' + error.message);
      setDeleting(false);
      return;
    }
    // If the deleted workspace was the cached active one, drop the cache.
    if (localStorage.getItem(ACTIVE_WORKSPACE_KEY) === workspaceToDelete.id) {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
    toast.success(t('enterprise_page.delete_success', { name: workspaceToDelete.name }));
    setWorkspaceToDelete(null);
    setDeleting(false);
    await fetchWorkspaces();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'resourceAssistant': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t('enterprise_page.role_owner');
      case 'resourceAssistant': return t('enterprise_page.role_resource_assistant');
      default: return t('enterprise_page.role_member');
    }
  };

  if (selectedWorkspaceId) {
    const ws = workspaces.find(w => w.id === selectedWorkspaceId);
    const role = getRoleForWorkspace(selectedWorkspaceId);
    if (ws) {
      return (
        <WorkspaceDashboard
          workspace={ws}
          userRole={role}
          userId={user?.id || ''}
          onBack={() => setSelectedWorkspaceId(null)}
          onRefresh={fetchWorkspaces}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      );
    }
  }

  // ────────────────────── Workspace picker (redesigned shell) ──────────────────────
  // (filter useState moved above the early-return — Rules of Hooks)
  const filteredWorkspaces = workspaces.filter((w) =>
    !filter ? true : (w.name + ' ' + (w.description ?? '')).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      <SkipToContent />
      <AppShell
        topbar={
          <PageHeader
            title={
              <span className="flex items-center gap-3">
                <EffectimeLogo size={30} variant="full" />
                <span className="sr-only">Effectime</span>
              </span>
            }
            description={t('enterprise_page.picker_description')}
            crumbs={[{ label: 'Effectime' }, { label: t('enterprise_page.workspaces_crumb') }]}
            actions={
              <>
                <HelpButton />
                <DensityToggle />
                <LanguageSelector />
                <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> {t('header.new_workspace')}
                </Button>
                <Button
                  onClick={() => setShowSeedConfig(true)}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  title={t('enterprise_page.demo_config_title')}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden md:inline">{t('enterprise_page.demo_config_label')}</span>
                </Button>
                <Button onClick={signOut} size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden md:inline">{t('header.sign_out')}</span>
                </Button>
              </>
            }
          />
        }
      >
        <div className="shell-page shell-section" data-help-region="home.overview">
          {loading || acceptingInvite ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : workspaces.length === 0 ? (
            <Card className="text-center py-16 border-dashed">
              <CardContent className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div className="max-w-md">
                  <h2 className="text-xl font-semibold mb-2">{t('enterprise_page.no_workspaces_title')}</h2>
                  <p className="text-muted-foreground mb-6">
                    {t('enterprise_page.no_workspaces_description')}
                  </p>
                </div>
                <Button onClick={() => setShowCreate(true)} size="lg" className="gap-2">
                  <Plus className="h-4 w-4" /> {t('enterprise_page.create_workspace_button')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {workspaces.length > 4 && (
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('enterprise_page.search_placeholder')}
                    className="pl-9"
                  />
                </div>
              )}
              <div className="shell-grid-bento">
                {filteredWorkspaces.map((ws) => {
                  const role = getRoleForWorkspace(ws.id);
                  const canDelete = role === 'owner';
                  return (
                    <Card
                      key={ws.id}
                      className="group relative cursor-pointer transition-all hover:border-primary/60 hover:shadow-elevated focus-within:ring-2 focus-within:ring-ring"
                      onClick={() => setSelectedWorkspaceId(ws.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={t('enterprise_page.enter_workspace_aria', { name: ws.name })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedWorkspaceId(ws.id);
                        }
                      }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-base truncate">{ws.name}</CardTitle>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant={getRoleBadgeVariant(role)} className="text-[10px]">
                              {getRoleLabel(role)}
                            </Badge>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                aria-label={t('enterprise_page.delete_workspace_aria', { name: ws.name })}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWorkspaceToDelete(ws);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {ws.description && (
                          <CardDescription className="line-clamp-2 mt-1">{ws.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
                          <span className="flex items-center gap-1 truncate">
                            <Settings className="h-3 w-3 shrink-0" />
                            <span className="truncate">{ws.timezone}</span>
                          </span>
                          <span className="shrink-0">{new Date(ws.created_at).toLocaleDateString('hu-HU')}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground translate-x-0 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </AppShell>

      <CreateWorkspaceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        userId={user?.id || ''}
        onCreated={async () => {
          await fetchWorkspaces();
          setShowCreate(false);
        }}
      />

      <DemoSeedConfigDialog
        open={showSeedConfig}
        onOpenChange={setShowSeedConfig}
        userId={user?.id || ''}
      />

      <AlertDialog
        open={!!workspaceToDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setWorkspaceToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('enterprise_page.delete_dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {t('enterprise_page.delete_dialog_confirm', { name: workspaceToDelete?.name ?? '' })}
              </span>
              <span className="block text-destructive">
                {t('enterprise_page.delete_dialog_warning')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('enterprise_page.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteWorkspace();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('enterprise_page.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> {t('enterprise_page.delete_confirm_button')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
