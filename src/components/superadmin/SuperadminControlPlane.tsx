import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Users,
  TrendingUp,
  ToggleRight,
  Mail,
  AlertTriangle,
  MoreHorizontal,
  RefreshCw,
  Loader2,
  AlertCircle,
  Play,
  Layers,
} from 'lucide-react';
import { FeatureTiersTab } from './FeatureTiersTab';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformOverview {
  total_workspaces: number;
  active_workspaces: number;
  archived_workspaces: number;
  recovery_mode_workspaces: number;
  total_users: number;
  new_users_30d: number;
  feature_flags_enabled: number;
  email_queue_pending: number;
}

interface Workspace {
  id: string;
  name: string;
  locale: string;
  timezone: string;
  member_count: number;
  status: 'active' | 'archived' | 'recovery';
  created_at: string;
}

interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  category: string;
  enabled: boolean;
}

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run?: string;
  function_name?: string;
}

interface LocaleRecord {
  code: string;
  flag: string;
  native_name: string;
  english_name: string;
  workspace_count: number;
  enabled: boolean;
}

interface EmailRecord {
  id: string;
  recipient: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  sent_at?: string;
  error?: string;
}

interface EmailQueueStatus {
  pending_count: number;
  sent_count: number;
  failed_count: number;
  recent: EmailRecord[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MANUAL_TRIGGER_FUNCTIONS = [
  'sync-holidays',
  'ms365-sync',
  'send-scheduled-reports',
  'cleanup-temp-users',
  'cleanup-demo-workspace',
];

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function ErrorState({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p>{label}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass = '',
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  colorClass?: string;
}) {
  return (
    <Card className={`relative overflow-hidden ${colorClass}`}>
      <CardContent className="pt-6 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className="text-3xl font-bold">{value ?? '—'}</p>
          </div>
          <div className="rounded-lg p-2 bg-background/60">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Overview
// ---------------------------------------------------------------------------

function OverviewTab() {
  const { t } = useI18n();
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'platform-overview' },
      });
      if (err) throw err;
      setData(res as PlatformOverview);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label={t('superadmin.loading')} />;
  if (error) return <ErrorState label={t('superadmin.load_error')} onRetry={load} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Workspaces row */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {t('superadmin.tab_workspaces')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t('superadmin.stat_total_ws')} value={data.total_workspaces} icon={Building2} />
          <StatCard label={t('superadmin.stat_active_ws')} value={data.active_workspaces} icon={Building2} colorClass="bg-green-50 dark:bg-green-950/20" />
          <StatCard label={t('superadmin.stat_archived_ws')} value={data.archived_workspaces} icon={Building2} colorClass="bg-gray-50 dark:bg-gray-900/20" />
          <StatCard label={t('superadmin.stat_recovery_ws')} value={data.recovery_mode_workspaces} icon={AlertTriangle} colorClass="bg-orange-50 dark:bg-orange-950/20" />
        </div>
      </div>

      {/* Users row */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {t('superadmin.tab_workspaces').replace('Workspaces', 'Users')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t('superadmin.stat_total_users')} value={data.total_users} icon={Users} />
          <StatCard label={t('superadmin.stat_new_users')} value={data.new_users_30d} icon={TrendingUp} colorClass="bg-green-50 dark:bg-green-950/20" />
          <StatCard label={t('superadmin.stat_flags_enabled')} value={data.feature_flags_enabled} icon={ToggleRight} />
          <StatCard
            label={t('superadmin.stat_email_pending')}
            value={data.email_queue_pending}
            icon={Mail}
            colorClass={data.email_queue_pending > 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Workspaces
// ---------------------------------------------------------------------------

function WorkspacesTab() {
  const { t } = useI18n();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [recoveryTarget, setRecoveryTarget] = useState<Workspace | null>(null);
  const [recoveryReason, setRecoveryReason] = useState('');
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'list-workspaces' },
      });
      if (err) throw err;
      setWorkspaces((res as { workspaces: Workspace[] }).workspaces ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = workspaces.filter((w) => {
    if (!showArchived && w.status === 'archived') return false;
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleArchiveToggle = async (ws: Workspace) => {
    setMutating(true);
    try {
      const action_type = ws.status === 'archived' ? 'unarchive' : 'archive';
      const { error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'workspace-action', workspace_id: ws.id, action_type },
      });
      if (err) throw err;
      toast.success(t('superadmin.action_success'));
      await load();
    } catch {
      toast.error(t('superadmin.load_error'));
    } finally {
      setMutating(false);
    }
  };

  const handleRecoveryToggle = async () => {
    if (!recoveryTarget) return;
    setMutating(true);
    try {
      const enabling = recoveryTarget.status !== 'recovery';
      const { error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: {
          action: 'workspace-action',
          workspace_id: recoveryTarget.id,
          action_type: enabling ? 'enable_recovery' : 'disable_recovery',
          reason: recoveryReason,
        },
      });
      if (err) throw err;
      toast.success(t('superadmin.action_success'));
      setRecoveryTarget(null);
      setRecoveryReason('');
      await load();
    } catch {
      toast.error(t('superadmin.load_error'));
    } finally {
      setMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return;
    setMutating(true);
    try {
      const { error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'workspace-action', workspace_id: deleteTarget.id, action_type: 'delete' },
      });
      if (err) throw err;
      toast.success(t('superadmin.delete_success'));
      setDeleteTarget(null);
      setDeleteConfirmName('');
      await load();
    } catch {
      toast.error(t('superadmin.load_error'));
    } finally {
      setMutating(false);
    }
  };

  const statusBadge = (status: Workspace['status']) => {
    if (status === 'active') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">{t('superadmin.ws_status_active')}</Badge>;
    if (status === 'archived') return <Badge variant="secondary">{t('superadmin.ws_status_archived')}</Badge>;
    return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0">{t('superadmin.ws_status_recovery')}</Badge>;
  };

  if (loading) return <LoadingState label={t('superadmin.loading')} />;
  if (error) return <ErrorState label={t('superadmin.load_error')} onRetry={load} />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input
          placeholder={t('superadmin.ws_search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(v) => setShowArchived(Boolean(v))}
          />
          <Label htmlFor="show-archived" className="cursor-pointer text-sm">
            {t('superadmin.ws_show_archived')}
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('superadmin.ws_col_name')}</TableHead>
              <TableHead>{t('superadmin.ws_col_locale')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('superadmin.ws_col_timezone')}</TableHead>
              <TableHead className="text-right">{t('superadmin.ws_col_members')}</TableHead>
              <TableHead>{t('superadmin.ws_col_status')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('superadmin.ws_col_created')}</TableHead>
              <TableHead className="w-10">{t('superadmin.ws_col_actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t('common.empty')}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ws) => (
                <TableRow key={ws.id}>
                  <TableCell className="font-medium">{ws.name}</TableCell>
                  <TableCell>{ws.locale}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{ws.timezone}</TableCell>
                  <TableCell className="text-right">{ws.member_count}</TableCell>
                  <TableCell>{statusBadge(ws.status)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(ws.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={mutating}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleArchiveToggle(ws)}>
                          {ws.status === 'archived' ? t('superadmin.ws_action_unarchive') : t('superadmin.ws_action_archive')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRecoveryTarget(ws)}>
                          {ws.status === 'recovery' ? t('superadmin.ws_action_recovery_off') : t('superadmin.ws_action_recovery_on')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { setDeleteTarget(ws); setDeleteConfirmName(''); }}
                        >
                          {t('superadmin.ws_action_delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Recovery mode dialog */}
      <Dialog open={!!recoveryTarget} onOpenChange={(o) => { if (!o) { setRecoveryTarget(null); setRecoveryReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {recoveryTarget?.status === 'recovery'
                ? t('superadmin.ws_action_recovery_off')
                : t('superadmin.ws_action_recovery_on')}
              {recoveryTarget ? ` — ${recoveryTarget.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          {recoveryTarget?.status !== 'recovery' && (
            <div className="space-y-2">
              <Label htmlFor="recovery-reason">{t('superadmin.ws_recovery_reason_label')}</Label>
              <Input
                id="recovery-reason"
                value={recoveryReason}
                onChange={(e) => setRecoveryReason(e.target.value)}
                placeholder={t('common.optional')}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRecoveryTarget(null); setRecoveryReason(''); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRecoveryToggle} disabled={mutating}>
              {t('superadmin.ws_recovery_confirm_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirmName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('superadmin.ws_delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('superadmin.ws_delete_confirm_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>{t('superadmin.ws_delete_type_name')}</Label>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={deleteTarget?.name ?? ''}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteConfirmName !== deleteTarget?.name || mutating}
            >
              {t('superadmin.ws_delete_btn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Feature Flags
// ---------------------------------------------------------------------------

function FeatureFlagsTab() {
  const { t } = useI18n();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'list-feature-flags' },
      });
      if (err) throw err;
      setFlags((res as { flags: FeatureFlag[] }).flags ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (flag: FeatureFlag, enabled: boolean) => {
    setToggling(flag.id);
    try {
      const { error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'toggle-feature-flag', flag_id: flag.id, enabled },
      });
      if (err) throw err;
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled } : f)));
      toast.success(t('superadmin.action_success'));
    } catch {
      toast.error(t('superadmin.load_error'));
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <LoadingState label={t('superadmin.loading')} />;
  if (error) return <ErrorState label={t('superadmin.load_error')} onRetry={load} />;

  const grouped = flags.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    const cat = f.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Info callout */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4 text-sm text-blue-800 dark:text-blue-300">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t('superadmin.flags_info')}</span>
      </div>

      {flags.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t('superadmin.flags_empty')}</p>
      ) : (
        Object.entries(grouped).map(([category, categoryFlags]) => (
          <Card key={category}>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-semibold capitalize">{category}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('superadmin.flags_col_key')}</TableHead>
                    <TableHead>{t('superadmin.flags_col_desc')}</TableHead>
                    <TableHead className="w-28 text-right">{t('superadmin.flags_col_status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryFlags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{flag.key}</code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{flag.description}</TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={flag.enabled}
                          disabled={toggling === flag.id}
                          onCheckedChange={(val) => handleToggle(flag, val)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Scheduled Jobs
// ---------------------------------------------------------------------------

function ScheduledJobsTab() {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [triggerTarget, setTriggerTarget] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'list-cron-jobs' },
      });
      if (err) throw err;
      setJobs((res as { jobs: CronJob[] }).jobs ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTrigger = async (fnName: string) => {
    setTriggering(true);
    try {
      const { error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'trigger-edge-function', function_name: fnName },
      });
      if (err) throw err;
      toast.success(t('superadmin.trigger_success'));
    } catch {
      toast.error(t('superadmin.trigger_error'));
    } finally {
      setTriggering(false);
      setTriggerTarget(null);
    }
  };

  if (loading) return <LoadingState label={t('superadmin.loading')} />;
  if (error) return <ErrorState label={t('superadmin.load_error')} onRetry={load} />;

  return (
    <div className="space-y-6">
      {/* pg_cron jobs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('superadmin.tab_jobs')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('superadmin.jobs_col_name')}</TableHead>
                <TableHead>{t('superadmin.jobs_col_schedule')}</TableHead>
                <TableHead>{t('superadmin.jobs_col_active')}</TableHead>
                <TableHead className="w-32">{t('superadmin.jobs_trigger_btn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {t('common.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.jobid}>
                    <TableCell className="font-medium">{job.jobname}</TableCell>
                    <TableCell>
                      <code className="text-xs font-mono bg-muted rounded px-1.5 py-0.5">{job.schedule}</code>
                    </TableCell>
                    <TableCell>
                      {job.active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.function_name && MANUAL_TRIGGER_FUNCTIONS.includes(job.function_name) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTriggerTarget(job.function_name ?? null)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {t('superadmin.jobs_trigger_btn')}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual triggers section */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {t('superadmin.jobs_manual_section')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MANUAL_TRIGGER_FUNCTIONS.map((fn) => (
            <Card key={fn} className="flex items-center justify-between p-4">
              <code className="text-sm font-mono">{fn}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTriggerTarget(fn)}
              >
                <Play className="h-3 w-3 mr-1" />
                {t('superadmin.jobs_trigger_btn')}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Trigger confirm dialog */}
      <AlertDialog open={!!triggerTarget} onOpenChange={(o) => { if (!o) setTriggerTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('superadmin.jobs_trigger_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              <code className="font-mono">{triggerTarget}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => triggerTarget && handleTrigger(triggerTarget)}
              disabled={triggering}
            >
              {triggering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('superadmin.jobs_trigger_btn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5: Locales
// ---------------------------------------------------------------------------

function LocalesTab() {
  const { t } = useI18n();
  const [locales, setLocales] = useState<LocaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'locale-registry' },
      });
      if (err) throw err;
      setLocales((res as { locales: LocaleRecord[] }).locales ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label={t('superadmin.loading')} />;
  if (error) return <ErrorState label={t('superadmin.load_error')} onRetry={load} />;

  return (
    <div className="space-y-4">
      {/* Add info callout */}
      <div className="flex items-start gap-3 rounded-lg border border-muted bg-muted/40 p-4 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t('superadmin.locales_add_info')}</span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">{t('superadmin.locales_col_flag')}</TableHead>
              <TableHead>{t('superadmin.locales_col_code')}</TableHead>
              <TableHead>{t('superadmin.locales_col_native')}</TableHead>
              <TableHead>{t('superadmin.locales_col_english')}</TableHead>
              <TableHead className="text-right">{t('superadmin.locales_col_workspaces')}</TableHead>
              <TableHead>{t('superadmin.locales_col_status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t('common.empty')}
                </TableCell>
              </TableRow>
            ) : (
              locales.map((loc) => (
                <TableRow key={loc.code}>
                  <TableCell className="text-xl">{loc.flag}</TableCell>
                  <TableCell>
                    <code className="text-xs font-mono bg-muted rounded px-1.5 py-0.5">{loc.code}</code>
                  </TableCell>
                  <TableCell className="font-medium">{loc.native_name}</TableCell>
                  <TableCell className="text-muted-foreground">{loc.english_name}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{loc.workspace_count}</Badge>
                  </TableCell>
                  <TableCell>
                    {loc.enabled ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                        {t('superadmin.ws_status_active')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t('superadmin.ws_status_archived')}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 6: Email Queue
// ---------------------------------------------------------------------------

function EmailQueueTab() {
  const { t } = useI18n();
  const [data, setData] = useState<EmailQueueStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'email-queue-status' },
      });
      if (err) throw err;
      setData(res as EmailQueueStatus);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusBadge = (status: EmailRecord['status']) => {
    if (status === 'sent') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">{t('superadmin.email_sent')}</Badge>;
    if (status === 'failed') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">{t('superadmin.email_failed')}</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">{t('superadmin.email_pending')}</Badge>;
  };

  if (loading) return <LoadingState label={t('superadmin.loading')} />;
  if (error) return <ErrorState label={t('superadmin.load_error')} onRetry={load} />;

  return (
    <div className="space-y-6">
      {/* Count cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6 pb-4 px-5 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('superadmin.email_pending')}</p>
            <p className="text-3xl font-bold">{data?.pending_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6 pb-4 px-5 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('superadmin.email_sent')}</p>
            <p className="text-3xl font-bold">{data?.sent_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6 pb-4 px-5 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('superadmin.email_failed')}</p>
            <p className="text-3xl font-bold">{data?.failed_count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent emails table */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent</h3>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('superadmin.refresh_btn')}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('superadmin.email_col_recipient')}</TableHead>
              <TableHead>{t('superadmin.email_col_subject')}</TableHead>
              <TableHead>{t('superadmin.email_col_status')}</TableHead>
              <TableHead>{t('superadmin.email_col_created')}</TableHead>
              <TableHead>{t('superadmin.email_col_sent')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.recent ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t('common.empty')}
                </TableCell>
              </TableRow>
            ) : (
              (data?.recent ?? []).map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="font-mono text-sm">{email.recipient}</TableCell>
                  <TableCell className="max-w-xs truncate">{email.subject}</TableCell>
                  <TableCell>{statusBadge(email.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(email.created_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {email.status === 'failed' ? (
                      <span className="text-destructive text-xs" title={email.error}>Error</span>
                    ) : (
                      formatDate(email.sent_at)
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'workspaces' | 'flags' | 'jobs' | 'locales' | 'email' | 'tiers';

interface TabState {
  loaded: boolean;
}

export function SuperadminControlPlane({ userId: _userId }: { userId: string }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loadedTabs, setLoadedTabs] = useState<Partial<Record<TabKey, TabState>>>({
    overview: { loaded: true },
  });

  const handleTabChange = (tab: string) => {
    const key = tab as TabKey;
    setActiveTab(key);
    setLoadedTabs((prev) => ({ ...prev, [key]: { loaded: true } }));
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('superadmin.title')}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">{t('superadmin.tab_overview')}</TabsTrigger>
          <TabsTrigger value="workspaces">{t('superadmin.tab_workspaces')}</TabsTrigger>
          <TabsTrigger value="flags">{t('superadmin.tab_flags')}</TabsTrigger>
          <TabsTrigger value="jobs">{t('superadmin.tab_jobs')}</TabsTrigger>
          <TabsTrigger value="locales">{t('superadmin.tab_locales')}</TabsTrigger>
          <TabsTrigger value="email">{t('superadmin.tab_email')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {loadedTabs.overview && <OverviewTab />}
        </TabsContent>

        <TabsContent value="workspaces" className="mt-6">
          {loadedTabs.workspaces && <WorkspacesTab />}
        </TabsContent>

        <TabsContent value="flags" className="mt-6">
          {loadedTabs.flags && <FeatureFlagsTab />}
        </TabsContent>

        <TabsContent value="jobs" className="mt-6">
          {loadedTabs.jobs && <ScheduledJobsTab />}
        </TabsContent>

        <TabsContent value="locales" className="mt-6">
          {loadedTabs.locales && <LocalesTab />}
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          {loadedTabs.email && <EmailQueueTab />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SuperadminControlPlane;
