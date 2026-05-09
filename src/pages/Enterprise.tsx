import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, LogOut, Building2, Trash2, Loader2, SlidersHorizontal } from 'lucide-react';
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
    setSearchParams(nextParams, { replace: true });
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
        toast.error(data?.error || 'Nem sikerült elfogadni a meghívót.');
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
      toast.success(data?.already_member ? 'Már tagja vagy ennek a munkaterületnek.' : 'A meghívót elfogadtuk, beléptél a munkaterületbe.');
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
      toast.error('A munkaterület törlése nem sikerült: ' + error.message);
      setDeleting(false);
      return;
    }
    // If the deleted workspace was the cached active one, drop the cache.
    if (localStorage.getItem(ACTIVE_WORKSPACE_KEY) === workspaceToDelete.id) {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
    toast.success(`„${workspaceToDelete.name}" munkaterület és minden hozzá tartozó adat törölve.`);
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
      case 'owner': return 'Tulajdonos';
      case 'resourceAssistant': return 'Erőforrás asszisztens';
      default: return 'Tag';
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div
          className="flex items-center justify-between max-w-5xl mx-auto gap-2"
          data-help-region="home.overview"
        >
          <div className="flex items-center gap-2">
            <HelpButton />
            <EffectimeLogo size={34} variant="full" />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> {t('header.new_workspace')}
            </Button>
            <Button
              onClick={() => setShowSeedConfig(true)}
              size="sm"
              variant="outline"
              className="gap-1.5"
              title="Demo workspace alapértelmezett entitások konfigurálása"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Demo konfig</span>
            </Button>
            <LanguageSelector />
            <Button onClick={signOut} size="sm" variant="destructive" className="gap-1.5">
              <LogOut className="h-4 w-4" /> {t('header.sign_out')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {loading || acceptingInvite ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : workspaces.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Még nincs munkaterületed</h2>
              <p className="text-muted-foreground mb-4">
                Hozz létre egy munkaterületet a csapatod távolléteinek kezeléséhez.
              </p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Munkaterület létrehozása
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {workspaces.map((ws) => {
              const role = getRoleForWorkspace(ws.id);
              const canDelete = role === 'owner';
              return (
                <Card
                  key={ws.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors group relative"
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{ws.name}</CardTitle>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={getRoleBadgeVariant(role)}>{getRoleLabel(role)}</Badge>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            aria-label={`„${ws.name}" törlése`}
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
                      <CardDescription className="line-clamp-2">{ws.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Settings className="h-3 w-3" />
                        {ws.timezone}
                      </span>
                      <span>{new Date(ws.created_at).toLocaleDateString('hu-HU')}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

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
            <AlertDialogTitle>Munkaterület végleges törlése</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Biztosan törölni szeretnéd a(z) <strong>„{workspaceToDelete?.name}"</strong>{' '}
                munkaterületet?
              </span>
              <span className="block text-destructive">
                Ez a művelet visszavonhatatlan. A munkaterülethez tartozó <strong>összes adat</strong>{' '}
                — tagok, meghívások, szabályok, projektek, szabadságkérelmek, integrációk,
                jelentések, audit napló — véglegesen törlődik.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Mégse</AlertDialogCancel>
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Törlés…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Igen, töröljük
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
