import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Download,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEvent {
  id: string;
  workspace_id: string;
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  affected_user_id: string | null;
  prev_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface RetentionPolicy {
  id: string;
  workspace_id: string;
  table_name: string;
  retention_days: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface GdprRequest {
  id: string;
  workspace_id: string;
  requestor_id: string;
  target_user_id: string;
  request_type: 'export' | 'deletion';
  status: 'pending' | 'completed';
  created_at: string;
}

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const RETENTION_TABLE_OPTIONS = [
  'audit_events',
  'leave_requests',
  'attendance_periods',
  'notifications',
  'wellbeing_scores',
  'api_usage_logs',
];

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Sub-component: AuditLogTab
// ---------------------------------------------------------------------------

function AuditLogTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useI18n();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  // Filters
  const [actionFilter, setActionFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actorSearch, setActorSearch] = useState('');

  // Expanded detail rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const ACTION_FILTER_OPTIONS = [
    { value: 'all', label: t('security.action_all') },
    { value: 'leave_request', label: t('security.action_leave') },
    { value: 'membership', label: t('security.action_membership') },
    { value: 'rule', label: t('security.action_rule') },
    { value: 'export', label: t('security.action_export') },
    { value: 'settings', label: t('security.action_settings') },
    { value: 'payroll', label: t('security.action_payroll') },
    { value: 'security', label: t('security.action_security') },
  ];

  const fetchEvents = useCallback(async (reset: boolean) => {
    setLoading(true);
    const offset = reset ? 0 : page * PAGE_SIZE;

    let query = (supabase as any)
      .from('enterprise_audit_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (actionFilter !== 'all') {
      query = query.like('action', `${actionFilter}%`);
    }
    if (fromDate) {
      query = query.gte('created_at', `${fromDate}T00:00:00`);
    }
    if (toDate) {
      query = query.lte('created_at', `${toDate}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) {
      toast.error(t('security.load_error'));
      setLoading(false);
      return;
    }

    const items: AuditEvent[] = data || [];

    // Resolve actor names
    const allActorIds = [...new Set(items.map((e: AuditEvent) => e.actor_id).filter(Boolean))];
    if (allActorIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', allActorIds);
      const map: Record<string, string> = { ...profiles };
      (profileData || []).forEach((p: any) => {
        map[p.user_id] = p.display_name || p.user_id;
      });
      setProfiles(map);
    }

    if (reset) {
      setEvents(items);
      setPage(1);
    } else {
      setEvents(prev => [...prev, ...items]);
      setPage(prev => prev + 1);
    }
    setHasMore(items.length === PAGE_SIZE);
    setLoading(false);
  }, [workspaceId, actionFilter, fromDate, toDate, page, profiles, t]);

  // Reload when filters change
  useEffect(() => {
    fetchEvents(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, actionFilter, fromDate, toDate]);

  // Client-side actor name filter
  const visibleEvents = actorSearch
    ? events.filter(e => {
        const name = profiles[e.actor_id] || '';
        return name.toLowerCase().includes(actorSearch.toLowerCase());
      })
    : events;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const header = [
      t('security.col_time'),
      t('security.col_actor'),
      t('security.col_action'),
      t('security.col_resource'),
      t('security.col_ip'),
    ].join(',');

    const rows = visibleEvents.map(e => [
      `"${format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss')}"`,
      `"${profiles[e.actor_id] || e.actor_id}"`,
      `"${e.action}"`,
      `"${e.target_type || ''}"`,
      `"${e.ip_address || ''}"`,
    ].join(','));

    downloadBlob(
      [header, ...rows].join('\n'),
      `audit_log_${format(new Date(), 'yyyyMMdd')}.csv`,
      'text/csv',
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t('security.audit_title')}</h2>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={visibleEvents.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {t('security.export_csv_btn')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t('security.filter_action')}</Label>
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); }}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTER_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t('security.filter_from')}</Label>
          <Input
            type="date"
            className="h-8 text-xs w-[140px]"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t('security.filter_to')}</Label>
          <Input
            type="date"
            className="h-8 text-xs w-[140px]"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t('security.filter_actor')}</Label>
          <Input
            className="h-8 text-xs w-[160px]"
            value={actorSearch}
            onChange={e => setActorSearch(e.target.value)}
            placeholder={t('security.filter_actor')}
          />
        </div>
      </div>

      {/* Table */}
      {visibleEvents.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('security.no_events')}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('security.col_time')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('security.col_actor')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('security.col_action')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('security.col_resource')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('security.col_ip')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('security.col_details')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map(e => {
                const isExpanded = expandedIds.has(e.id);
                const hasDiff = e.prev_state || e.new_state;
                return (
                  <>
                    <tr key={e.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {format(new Date(e.created_at), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        {profiles[e.actor_id] || e.actor_id}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px] h-4 font-mono">
                          {e.action}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.target_type || '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground font-mono whitespace-nowrap">
                        {e.ip_address || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {hasDiff && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={() => toggleExpand(e.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasDiff && (
                      <tr key={`${e.id}-detail`} className="border-b bg-muted/10">
                        <td colSpan={6} className="px-3 py-2">
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            {e.prev_state && (
                              <div>
                                <div className="font-semibold text-destructive mb-1">prev</div>
                                <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                                  {JSON.stringify(e.prev_state, null, 2)}
                                </pre>
                              </div>
                            )}
                            {e.new_state && (
                              <div>
                                <div className="font-semibold text-green-600 mb-1">new</div>
                                <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                                  {JSON.stringify(e.new_state, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEvents(false)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {t('security.load_more')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RetentionTab
// ---------------------------------------------------------------------------

interface RetentionForm {
  table_name: string;
  retention_days: number;
  is_active: boolean;
}

function RetentionTab({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const { t } = useI18n();

  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RetentionForm>({
    table_name: RETENTION_TABLE_OPTIONS[0],
    retention_days: 90,
    is_active: false,
  });

  const fetchPolicies = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('data_retention_policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error(t('security.load_error'));
    } else {
      setPolicies(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPolicies(); }, [workspaceId]);

  const resetForm = () => {
    setForm({ table_name: RETENTION_TABLE_OPTIONS[0], retention_days: 90, is_active: false });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.table_name || form.retention_days < 1) return;
    setSaving(true);

    if (editingId) {
      const { error } = await (supabase as any)
        .from('data_retention_policies')
        .update({
          table_name: form.table_name,
          retention_days: form.retention_days,
          is_active: form.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (error) toast.error(t('security.load_error'));
    } else {
      const { error } = await (supabase as any)
        .from('data_retention_policies')
        .insert({
          workspace_id: workspaceId,
          table_name: form.table_name,
          retention_days: form.retention_days,
          is_active: form.is_active,
          created_by: userId,
        });
      if (error) toast.error(t('security.load_error'));
    }

    await fetchPolicies();
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any)
      .from('data_retention_policies')
      .delete()
      .eq('id', id);
    if (error) toast.error(t('security.load_error'));
    else await fetchPolicies();
  };

  const handleToggleActive = async (policy: RetentionPolicy) => {
    await (supabase as any)
      .from('data_retention_policies')
      .update({ is_active: !policy.is_active, updated_at: new Date().toISOString() })
      .eq('id', policy.id);
    await fetchPolicies();
  };

  const startEdit = (policy: RetentionPolicy) => {
    setForm({
      table_name: policy.table_name,
      retention_days: policy.retention_days,
      is_active: policy.is_active,
    });
    setEditingId(policy.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t('security.retention_title')}</h2>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t('security.retention_add_btn')}
        </Button>
      </div>

      {/* Info callout */}
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-300">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{t('security.retention_info')}</span>
      </div>

      {/* Inline form */}
      {showForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('security.retention_table_label')}</Label>
                <Select
                  value={form.table_name}
                  onValueChange={v => setForm(prev => ({ ...prev, table_name: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETENTION_TABLE_OPTIONS.map(tbl => (
                      <SelectItem key={tbl} value={tbl}>{tbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('security.retention_days_label')}</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-8 text-xs"
                  value={form.retention_days}
                  onChange={e => setForm(prev => ({ ...prev, retention_days: Number(e.target.value) }))}
                />
              </div>

              <div className="flex items-end gap-2 pb-0.5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={v => setForm(prev => ({ ...prev, is_active: v }))}
                  />
                  <Label className="text-xs">{t('security.retention_active_label')}</Label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={resetForm}>
                {t('security.retention_cancel_btn')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                {t('security.retention_save_btn')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policy list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('security.retention_empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {policies.map(policy => (
            <Card key={policy.id}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono">{policy.table_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {policy.retention_days} {t('security.retention_days_label').toLowerCase()}
                  </p>
                </div>

                <Switch
                  checked={policy.is_active}
                  onCheckedChange={() => handleToggleActive(policy)}
                />

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => startEdit(policy)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(policy.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: GdprTab
// ---------------------------------------------------------------------------

function GdprTab({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const { t } = useI18n();

  // Export section
  const [exportUserId, setExportUserId] = useState('');
  const [exporting, setExporting] = useState(false);

  // Deletion section
  const [deleteUserId, setDeleteUserId] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Requests list
  const [requests, setRequests] = useState<GdprRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    const { data, error } = await (supabase as any)
      .from('gdpr_requests')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) toast.error(t('security.load_error'));
    else setRequests(data || []);
    setLoadingRequests(false);
  };

  useEffect(() => { fetchRequests(); }, [workspaceId]);

  const handleExport = async () => {
    if (!exportUserId.trim()) return;
    setExporting(true);

    try {
      const uid = exportUserId.trim();

      const [memberships, leaveRequests, attendance, wellbeing, auditEvents] = await Promise.all([
        (supabase as any)
          .from('enterprise_memberships')
          .select('*')
          .eq('user_id', uid)
          .eq('workspace_id', workspaceId),
        (supabase as any)
          .from('leave_requests')
          .select('*')
          .eq('user_id', uid)
          .eq('workspace_id', workspaceId),
        (supabase as any)
          .from('enterprise_attendance_periods')
          .select('*')
          .eq('user_id', uid)
          .eq('workspace_id', workspaceId),
        (supabase as any)
          .from('wellbeing_scores')
          .select('*')
          .eq('user_id', uid)
          .eq('workspace_id', workspaceId),
        (supabase as any)
          .from('enterprise_audit_events')
          .select('*')
          .eq('actor_id', uid)
          .eq('workspace_id', workspaceId),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: uid,
        workspace_id: workspaceId,
        memberships: memberships.data || [],
        leave_requests: leaveRequests.data || [],
        attendance_periods: attendance.data || [],
        wellbeing_scores: wellbeing.data || [],
        audit_events: auditEvents.data || [],
      };

      downloadBlob(
        JSON.stringify(exportData, null, 2),
        `gdpr_export_${uid}_${format(new Date(), 'yyyyMMdd')}.json`,
        'application/json',
      );

      toast.success(t('security.export_success'));
    } catch {
      toast.error(t('security.load_error'));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteUserId.trim() || !deleteConfirmed) return;
    setSubmitting(true);

    const { error } = await (supabase as any)
      .from('gdpr_requests')
      .insert({
        workspace_id: workspaceId,
        requestor_id: userId,
        target_user_id: deleteUserId.trim(),
        request_type: 'deletion',
        status: 'pending',
      });

    if (error) {
      toast.error(t('security.load_error'));
    } else {
      toast.success(t('security.delete_submitted'));
      setDeleteUserId('');
      setDeleteConfirmed(false);
      await fetchRequests();
    }
    setSubmitting(false);
  };

  const statusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
    if (status === 'completed') return 'default';
    if (status === 'pending') return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t('security.gdpr_export_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('security.gdpr_export_user_label')}</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs flex-1"
                value={exportUserId}
                onChange={e => setExportUserId(e.target.value)}
                placeholder="user-uuid"
              />
              <Button
                size="sm"
                onClick={handleExport}
                disabled={exporting || !exportUserId.trim()}
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                {t('security.gdpr_export_btn')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Data Deletion */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t('security.gdpr_delete_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('security.gdpr_delete_user_label')}</Label>
            <Input
              className="h-8 text-xs"
              value={deleteUserId}
              onChange={e => setDeleteUserId(e.target.value)}
              placeholder="user-uuid"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="gdpr-delete-confirm"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={deleteConfirmed}
              onChange={e => setDeleteConfirmed(e.target.checked)}
            />
            <Label htmlFor="gdpr-delete-confirm" className="text-xs cursor-pointer">
              {t('security.gdpr_delete_confirm_label')}
            </Label>
          </div>

          <Button
            size="sm"
            variant="destructive"
            onClick={handleDeleteRequest}
            disabled={submitting || !deleteUserId.trim() || !deleteConfirmed}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {t('security.gdpr_delete_btn')}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Requests list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t('security.gdpr_requests_title')}</h3>

        {loadingRequests ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('security.no_events')}</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">{t('security.gdpr_col_user')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('security.gdpr_col_type')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('security.gdpr_col_status')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('security.gdpr_col_date')}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{r.target_user_id}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] h-4">
                        {r.request_type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(r.status)} className="text-[10px] h-4">
                        {r.status === 'pending'
                          ? t('security.gdpr_status_pending')
                          : t('security.gdpr_status_completed')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.created_at), 'yyyy-MM-dd HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SecurityCenter({ workspaceId, userId, isAdmin }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t('security.title')}</h1>
      </div>

      <Tabs defaultValue="audit-log">
        <TabsList className="mb-4">
          <TabsTrigger value="audit-log">{t('security.tab_audit')}</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="retention">{t('security.tab_retention')}</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="gdpr">{t('security.tab_gdpr')}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="audit-log">
          <AuditLogTab workspaceId={workspaceId} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="retention">
            <RetentionTab workspaceId={workspaceId} userId={userId} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="gdpr">
            <GdprTab workspaceId={workspaceId} userId={userId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
