import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, Settings } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CreateWorkspaceDialog } from '@/components/enterprise/CreateWorkspaceDialog';
import { WorkspaceDashboard } from '@/components/enterprise/WorkspaceDashboard';

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
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(null);

  const activeTab = searchParams.get('tab') || 'members';
  const inviteToken = searchParams.get('invite') || null;

  const setSelectedWorkspaceId = (id: string | null) => {
    setSelectedWorkspaceIdState(id);
    if (id) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', 'members');
      nextParams.delete('invite');
      nextParams.delete('ws');
      setSearchParams(nextParams, { replace: true });
      return;
    }

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
  }, [workspaces, searchParams, setSearchParams, selectedWorkspaceId]);

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
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Workspace</h1>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Új munkaterület
          </Button>
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
              return (
                <Card
                  key={ws.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{ws.name}</CardTitle>
                      <Badge variant={getRoleBadgeVariant(role)}>{getRoleLabel(role)}</Badge>
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
        onCreated={async () => {
          await fetchWorkspaces();
          setShowCreate(false);
        }}
      />
    </div>
  );
}
