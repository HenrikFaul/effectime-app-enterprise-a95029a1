/**
 * PlatformAuditLogTab — Superadmin viewer for the immutable
 * platform_audit_events table introduced in v3.15.0.
 *
 * Lists tier/addon/routing change events with action + date filtering and
 * a detail dialog that renders prev/new state JSON side-by-side.
 *
 * RLS: only platform admins (`has_role(uid, 'admin')`) can SELECT this table,
 * so we surface RLS-denied errors as a clear "not authorized" state instead
 * of crashing.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  prev_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string | null;
}

const PAGE_SIZE = 50;

const ACTION_OPTIONS = [
  'tier_feature_enabled',
  'tier_feature_disabled',
  'addon_feature_enabled',
  'addon_feature_disabled',
  'feature_routing_updated',
] as const;

export function PlatformAuditLogTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [sinceFilter, setSinceFilter] = useState<string>('');  // YYYY-MM-DD
  const [actorSearch, setActorSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First page count for pagination footer
      let baseQuery = supabase
        .from('platform_audit_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (actionFilter !== 'all') {
        baseQuery = baseQuery.eq('action', actionFilter);
      }
      if (sinceFilter) {
        baseQuery = baseQuery.gte('created_at', `${sinceFilter}T00:00:00Z`);
      }

      const { data, error: err, count } = await baseQuery;
      if (err) throw err;

      const auditRows = (data ?? []) as AuditRow[];

      // Resolve actor display names from profiles in a single batched query.
      const actorIds = [...new Set(auditRows.map((r) => r.actor_id).filter((x): x is string => !!x))];
      let actorNameMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', actorIds);
        actorNameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name || '—']));
      }

      const enriched = auditRows.map((r) => ({
        ...r,
        actor_name: r.actor_id ? actorNameMap.get(r.actor_id) ?? '—' : '(system)',
      }));

      setRows(enriched);
      setTotalCount(count ?? 0);
    } catch (e: unknown) {
      // PostgrestError is a plain object, not an Error instance — String(e)
      // would produce "[object Object]". Extract message/code/details explicitly.
      let msg = '';
      if (e instanceof Error) {
        msg = e.message;
      } else if (e && typeof e === 'object') {
        const obj = e as { message?: string; details?: string; hint?: string; code?: string };
        msg = obj.message || obj.details || obj.hint || obj.code || JSON.stringify(e);
      } else {
        msg = String(e);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, sinceFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 0 when filters change.
  useEffect(() => {
    setPage(0);
  }, [actionFilter, sinceFilter]);

  // Client-side actor search filter (server is already filtered by action+date)
  const visibleRows = useMemo(() => {
    const q = actorSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.actor_name || '').toLowerCase().includes(q) ||
      (r.target_id || '').toLowerCase().includes(q) ||
      (r.action || '').toLowerCase().includes(q),
    );
  }, [rows, actorSearch]);

  const actionBadge = (action: string) => {
    const isEnable = action.endsWith('_enabled');
    const isDisable = action.endsWith('_disabled');
    const isRouting = action === 'feature_routing_updated';
    const cls = isEnable
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
      : isDisable
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-0'
        : isRouting
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0'
          : '';
    return <Badge className={cls}>{action}</Badge>;
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">{t('platform_audit.title')}</h2>
        <Badge variant="outline">{t('platform_audit.total_count', { count: totalCount })}</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">{t('platform_audit.filter_action')}</label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[240px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('platform_audit.filter_action_all')}</SelectItem>
              {ACTION_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1">{t('platform_audit.filter_since')}</label>
          <Input type="date" value={sinceFilter} onChange={(e) => setSinceFilter(e.target.value)} className="w-[180px] h-9" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] text-muted-foreground block mb-1">{t('platform_audit.filter_search')}</label>
          <Input value={actorSearch} onChange={(e) => setActorSearch(e.target.value)} placeholder={t('platform_audit.search_placeholder')} className="h-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setPage(0); void load(); }} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">{t('platform_audit.refresh_btn')}</span>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">
            {t('platform_audit.error_loading')}: {error}
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('platform_audit.col_when')}</TableHead>
              <TableHead>{t('platform_audit.col_actor')}</TableHead>
              <TableHead>{t('platform_audit.col_action')}</TableHead>
              <TableHead>{t('platform_audit.col_target')}</TableHead>
              <TableHead className="w-[80px]">{t('platform_audit.col_detail')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t('platform_audit.empty')}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{r.actor_name}</TableCell>
                  <TableCell>{actionBadge(r.action)}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-xs" title={r.target_id ?? ''}>
                    {r.target_type ? <Badge variant="outline" className="text-[10px] mr-1">{r.target_type}</Badge> : null}
                    {r.target_id}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                      {t('platform_audit.view_btn')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('platform_audit.page_label', { page: page + 1, total: totalPages })}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" /> {t('platform_audit.prev_btn')}
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(page + 1)}>
            {t('platform_audit.next_btn')} <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail && actionBadge(detail.action)}
              <span className="text-xs font-mono text-muted-foreground">{detail?.id}</span>
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border p-2">
                  <div className="text-[11px] text-muted-foreground">{t('platform_audit.col_when')}</div>
                  <div className="font-mono">{new Date(detail.created_at).toLocaleString()}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-[11px] text-muted-foreground">{t('platform_audit.col_actor')}</div>
                  <div>{detail.actor_name}</div>
                </div>
                <div className="rounded border p-2 col-span-2">
                  <div className="text-[11px] text-muted-foreground">{t('platform_audit.col_target')}</div>
                  <div className="font-mono text-xs">{detail.target_type} → {detail.target_id}</div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="rounded border p-2">
                  <div className="text-[11px] text-muted-foreground mb-1">{t('platform_audit.prev_state')}</div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{detail.prev_state ? JSON.stringify(detail.prev_state, null, 2) : '—'}</pre>
                </div>
                <div className="rounded border p-2">
                  <div className="text-[11px] text-muted-foreground mb-1">{t('platform_audit.new_state')}</div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{detail.new_state ? JSON.stringify(detail.new_state, null, 2) : '—'}</pre>
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-[11px] text-muted-foreground mb-1">{t('platform_audit.metadata')}</div>
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{detail.metadata ? JSON.stringify(detail.metadata, null, 2) : '—'}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PlatformAuditLogTab;
