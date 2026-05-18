import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PublicApiGatewayPanel } from '@/components/integrations/PublicApiGatewayPanel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format, subDays, startOfDay } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Code2,
  Globe,
  MonitorPlay,
} from 'lucide-react';
import { EmbedManager } from './EmbedManager';

interface Props {
  workspaceId: string;
  userId: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_fired_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface UsageDay {
  date: string;
  count: number;
}

const ALL_SCOPES = ['read', 'write', 'admin'] as const;
type Scope = (typeof ALL_SCOPES)[number];

const ALL_EVENTS = [
  'leave.approved',
  'leave.rejected',
  'schedule.changed',
  'member.added',
  'member.removed',
] as const;
type WebhookEvent = (typeof ALL_EVENTS)[number];

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateApiKey(workspaceId: string): string {
  return `eff_${workspaceId.slice(0, 8)}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function generateSecret(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function DeveloperPortal({ workspaceId, userId }: Props) {
  const { t } = useI18n();

  // ── API Keys state ──────────────────────────────────────────────────────────
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [showRevoked, setShowRevoked] = useState(false);

  // Create key dialog
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);

  // Show new key dialog
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  // ── Usage chart state ───────────────────────────────────────────────────────
  const [usageData, setUsageData] = useState<UsageDay[]>([]);

  // ── Webhooks state ──────────────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);

  // Create webhook dialog
  const [createWebhookOpen, setCreateWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  // Delete webhook confirm
  const [deleteWebhookTarget, setDeleteWebhookTarget] = useState<WebhookSubscription | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadKeys = useCallback(async () => {
    setKeysLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_api_keys')
      .select('id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    setKeys((data as ApiKey[]) ?? []);
    setKeysLoading(false);
  }, [workspaceId]);

  const loadUsage = useCallback(async () => {
    const since = startOfDay(subDays(new Date(), 6)).toISOString();
    const { data } = await (supabase as any)
      .from('enterprise_api_usage_logs')
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since);

    const counts: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      counts[format(subDays(new Date(), i), 'MM/dd')] = 0;
    }
    for (const row of (data as { created_at: string }[]) ?? []) {
      const day = format(new Date(row.created_at), 'MM/dd');
      if (day in counts) counts[day]++;
    }
    setUsageData(Object.entries(counts).map(([date, count]) => ({ date, count })));
  }, [workspaceId]);

  const loadWebhooks = useCallback(async () => {
    setWebhooksLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_webhook_subscriptions')
      .select('id,url,events,is_active,last_fired_at,last_error,created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    setWebhooks((data as WebhookSubscription[]) ?? []);
    setWebhooksLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    loadKeys();
    loadUsage();
    loadWebhooks();
  }, [loadKeys, loadUsage, loadWebhooks]);

  // ── Create API Key ──────────────────────────────────────────────────────────
  const openCreateKey = () => {
    setKeyName('');
    setSelectedScopes([]);
    setCreatingKey(false);
    setCreateKeyOpen(true);
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) { toast.error(t('developer.validation_name_required')); return; }
    if (selectedScopes.length === 0) { toast.error(t('developer.validation_scopes_required')); return; }
    setCreatingKey(true);
    const rawKey = generateApiKey(workspaceId);
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = await sha256hex(rawKey);

    const { error } = await (supabase as any).from('enterprise_api_keys').insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: keyName.trim(),
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: selectedScopes,
    });

    setCreatingKey(false);
    if (error) {
      toast.error(t('developer.toast_key_error'));
      return;
    }
    toast.success(t('developer.toast_key_created'));
    setCreateKeyOpen(false);
    setNewKeyValue(rawKey);
    setCopied(false);
    await loadKeys();
  };

  const handleCopyKey = async () => {
    if (!newKeyValue) return;
    await navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Revoke key ──────────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const { error } = await (supabase as any)
      .from('enterprise_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', revokeTarget.id);
    if (error) {
      toast.error(t('developer.toast_revoke_error'));
    } else {
      toast.success(t('developer.toast_key_revoked'));
      await loadKeys();
    }
    setRevokeTarget(null);
  };

  // ── Scope toggle helpers ────────────────────────────────────────────────────
  const toggleScope = (scope: Scope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const toggleEvent = (event: WebhookEvent) => {
    setWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  // ── Create Webhook ──────────────────────────────────────────────────────────
  const openCreateWebhook = () => {
    setWebhookUrl('');
    setWebhookEvents([]);
    setWebhookSecret(generateSecret());
    setCreatingWebhook(false);
    setCreateWebhookOpen(true);
  };

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim() || !webhookUrl.startsWith('https://')) {
      toast.error(t('developer.validation_url_required'));
      return;
    }
    if (webhookEvents.length === 0) {
      toast.error(t('developer.validation_events_required'));
      return;
    }
    setCreatingWebhook(true);
    const { error } = await (supabase as any).from('enterprise_webhook_subscriptions').insert({
      workspace_id: workspaceId,
      created_by: userId,
      url: webhookUrl.trim(),
      secret: webhookSecret,
      events: webhookEvents,
      is_active: true,
    });
    setCreatingWebhook(false);
    if (error) {
      toast.error(t('developer.toast_webhook_error'));
      return;
    }
    toast.success(t('developer.toast_webhook_created'));
    setCreateWebhookOpen(false);
    await loadWebhooks();
  };

  // ── Toggle webhook active ───────────────────────────────────────────────────
  const handleToggleWebhook = async (webhook: WebhookSubscription, active: boolean) => {
    const { error } = await (supabase as any)
      .from('enterprise_webhook_subscriptions')
      .update({ is_active: active })
      .eq('id', webhook.id);
    if (error) {
      toast.error(t('developer.toast_webhook_error'));
    } else {
      toast.success(t('developer.toast_webhook_updated'));
      setWebhooks((prev) => prev.map((w) => (w.id === webhook.id ? { ...w, is_active: active } : w)));
    }
  };

  // ── Delete webhook ──────────────────────────────────────────────────────────
  const handleDeleteWebhook = async () => {
    if (!deleteWebhookTarget) return;
    const { error } = await (supabase as any)
      .from('enterprise_webhook_subscriptions')
      .delete()
      .eq('id', deleteWebhookTarget.id);
    if (error) {
      toast.error(t('developer.toast_webhook_delete_error'));
    } else {
      toast.success(t('developer.toast_webhook_deleted'));
      setWebhooks((prev) => prev.filter((w) => w.id !== deleteWebhookTarget.id));
    }
    setDeleteWebhookTarget(null);
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);
  const hasUsage = usageData.some((d) => d.count > 0);

  const scopeLabel: Record<string, string> = {
    read: t('developer.scope_read'),
    write: t('developer.scope_write'),
    admin: t('developer.scope_admin'),
  };

  const scopeDescriptions: Record<string, string> = {
    read: t('developer.scope_read_desc'),
    write: t('developer.scope_write_desc'),
    admin: t('developer.scope_admin_desc'),
  };

  const API_ENDPOINTS = [
    t('developer.endpoint_employees'),
    t('developer.endpoint_leave_get'),
    t('developer.endpoint_leave_post'),
    t('developer.endpoint_schedules_get'),
    t('developer.endpoint_schedules_post'),
    t('developer.endpoint_teams'),
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Code2 className="h-5 w-5 text-primary" />
          {t('developer.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t('developer.subtitle')}</p>
      </div>

      <Tabs defaultValue="api_keys">
        <TabsList>
          <TabsTrigger value="api_keys" className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" />
            {t('developer.tab_api_keys')}
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-1.5">
            <Webhook className="h-3.5 w-3.5" />
            {t('developer.tab_webhooks')}
          </TabsTrigger>
          <TabsTrigger value="gateway" className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" />
            {t('integrations.api_gateway_title')}
          </TabsTrigger>
          <TabsTrigger value="embed" className="flex items-center gap-1.5">
            <MonitorPlay className="h-3.5 w-3.5" />
            {t('embed.tab_title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gateway" className="space-y-4 mt-4">
          <PublicApiGatewayPanel />
        </TabsContent>

        <TabsContent value="embed" className="mt-4">
          <EmbedManager workspaceId={workspaceId} userId={userId} />
        </TabsContent>

        {/* ── API Keys Tab ────────────────────────────────────────────────── */}
        <TabsContent value="api_keys" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreateKey}>
              <Plus className="h-4 w-4 mr-1" />
              {t('developer.create_api_key')}
            </Button>
          </div>

          {/* Active keys table */}
          <Card>
            <CardContent className="p-0">
              {keysLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activeKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('developer.no_keys')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('developer.col_name')}</TableHead>
                      <TableHead>{t('developer.col_prefix')}</TableHead>
                      <TableHead>{t('developer.col_scopes')}</TableHead>
                      <TableHead>{t('developer.col_last_used')}</TableHead>
                      <TableHead>{t('developer.col_expires')}</TableHead>
                      <TableHead className="text-right">{t('developer.col_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeKeys.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted rounded px-1.5 py-0.5">{k.key_prefix}…</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(k.scopes ?? []).map((s) => (
                              <Badge key={s} variant="secondary" className="text-[10px]">
                                {scopeLabel[s] ?? s}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {k.last_used_at
                            ? format(new Date(k.last_used_at), 'yyyy-MM-dd')
                            : t('developer.never')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {k.expires_at
                            ? format(new Date(k.expires_at), 'yyyy-MM-dd')
                            : t('developer.no_expiry')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRevokeTarget(k)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {t('developer.revoke')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Revoked keys (collapsed) */}
          {revokedKeys.length > 0 && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setShowRevoked((v) => !v)}
              >
                {showRevoked ? t('developer.hide_revoked') : t('developer.show_revoked')} ({revokedKeys.length})
              </Button>
              {showRevoked && (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {revokedKeys.map((k) => (
                          <TableRow key={k.id} className="opacity-50">
                            <TableCell className="font-medium line-through">{k.name}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted rounded px-1.5 py-0.5">{k.key_prefix}…</code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-[10px]">
                                {t('developer.revoked_badge')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {k.revoked_at ? format(new Date(k.revoked_at), 'yyyy-MM-dd') : ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Usage chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('developer.usage_chart_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {!hasUsage ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('developer.usage_chart_empty')}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={usageData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => [value, t('developer.usage_chart_requests')]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="count" name={t('developer.usage_chart_requests')} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Webhooks Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="webhooks" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreateWebhook}>
              <Plus className="h-4 w-4 mr-1" />
              {t('developer.create_webhook')}
            </Button>
          </div>

          {/* Webhooks table */}
          <Card>
            <CardContent className="p-0">
              {webhooksLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : webhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('developer.no_webhooks')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('developer.col_url')}</TableHead>
                      <TableHead>{t('developer.col_events')}</TableHead>
                      <TableHead>{t('developer.col_status')}</TableHead>
                      <TableHead>{t('developer.col_last_fired')}</TableHead>
                      <TableHead>{t('developer.col_last_error')}</TableHead>
                      <TableHead className="text-right">{t('developer.col_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((wh) => (
                      <TableRow key={wh.id}>
                        <TableCell className="max-w-[180px]">
                          <span className="flex items-center gap-1 text-sm truncate" title={wh.url}>
                            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {wh.url.length > 40 ? `${wh.url.slice(0, 40)}…` : wh.url}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(wh.events ?? []).map((ev) => (
                              <Badge key={ev} variant="outline" className="text-[10px]">
                                {ev}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={wh.is_active}
                              onCheckedChange={(val) => handleToggleWebhook(wh, val)}
                            />
                            {wh.is_active ? (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('developer.status_active')}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <XCircle className="h-3 w-3" />
                                {t('developer.status_inactive')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {wh.last_fired_at
                            ? format(new Date(wh.last_fired_at), 'yyyy-MM-dd HH:mm')
                            : t('developer.never')}
                        </TableCell>
                        <TableCell className="max-w-[140px]">
                          {wh.last_error ? (
                            <span
                              className="text-xs text-destructive truncate block"
                              title={wh.last_error}
                            >
                              {wh.last_error.length > 40 ? `${wh.last_error.slice(0, 40)}…` : wh.last_error}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteWebhookTarget(wh)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* API Reference card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                {t('developer.api_reference_title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('developer.api_reference_subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {API_ENDPOINTS.map((ep) => (
                  <li key={ep} className="flex items-start gap-2">
                    <code className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono leading-relaxed">
                      {ep}
                    </code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create API Key Dialog ─────────────────────────────────────────── */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              {t('developer.create_api_key')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">{t('developer.key_name')}</Label>
              <Input
                id="key-name"
                placeholder={t('developer.key_name_placeholder')}
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('developer.scopes')}</Label>
              {ALL_SCOPES.map((scope) => (
                <div key={scope} className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    id={`scope-${scope}`}
                    checked={selectedScopes.includes(scope)}
                    onCheckedChange={() => toggleScope(scope)}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor={`scope-${scope}`} className="font-medium cursor-pointer">
                      {scopeLabel[scope]}
                    </Label>
                    <p className="text-xs text-muted-foreground">{scopeDescriptions[scope]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKeyOpen(false)}>
              {t('developer.close')}
            </Button>
            <Button onClick={handleCreateKey} disabled={creatingKey}>
              {creatingKey ? t('developer.generating') : t('developer.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Show New Key Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!newKeyValue} onOpenChange={() => setNewKeyValue(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {t('developer.key_created_title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-amber-600 font-medium">{t('developer.key_created_warning')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted rounded-md p-3 font-mono break-all select-all">
                {newKeyValue}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleCopyKey}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-green-600">{t('developer.copied')}</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyValue(null)}>{t('developer.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Key Alert Dialog ───────────────────────────────────────── */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('developer.revoke_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('developer.revoke_confirm_desc').replace('{{name}}', revokeTarget?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRevokeTarget(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('developer.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create Webhook Dialog ─────────────────────────────────────────── */}
      <Dialog open={createWebhookOpen} onOpenChange={setCreateWebhookOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              {t('developer.create_webhook')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">{t('developer.webhook_url')}</Label>
              <Input
                id="wh-url"
                placeholder={t('developer.webhook_url_placeholder')}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('developer.webhook_events')}</Label>
              {ALL_EVENTS.map((ev) => (
                <div key={ev} className="flex items-center gap-2">
                  <Checkbox
                    id={`event-${ev}`}
                    checked={webhookEvents.includes(ev)}
                    onCheckedChange={() => toggleEvent(ev)}
                  />
                  <Label htmlFor={`event-${ev}`} className="cursor-pointer font-mono text-xs">
                    {ev}
                  </Label>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-secret">{t('developer.webhook_secret_label')}</Label>
              <div className="flex gap-2">
                <Input
                  id="wh-secret"
                  readOnly
                  value={webhookSecret}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWebhookSecret(generateSecret())}
                  title={t('developer.generate')}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { navigator.clipboard.writeText(webhookSecret); toast.success(t('developer.copied')); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('developer.webhook_secret_hint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWebhookOpen(false)}>
              {t('developer.close')}
            </Button>
            <Button onClick={handleCreateWebhook} disabled={creatingWebhook}>
              {creatingWebhook ? t('developer.generating') : t('developer.create_webhook')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Webhook Alert Dialog ───────────────────────────────────── */}
      <AlertDialog
        open={!!deleteWebhookTarget}
        onOpenChange={(open) => { if (!open) setDeleteWebhookTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('developer.delete_webhook_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('developer.delete_webhook_desc').replace('{{url}}', deleteWebhookTarget?.url ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteWebhookTarget(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWebhook}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('developer.delete_webhook')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
