import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Copy, XCircle, CheckCircle2, RefreshCw, Code2, ExternalLink, Settings2, Pencil, Palette } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Props {
  workspaceId: string;
  userId: string;
}

interface EmbedToken {
  id: string;
  token: string;
  label: string;
  allowed_views: string[];
  can_write: boolean;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Office { id: string; name: string; city: string | null }

const ALL_VIEWS = ['capacity_planner', 'shift_roster', 'leave_calendar', 'office_headcount', 'member_schedule'] as const;
type EmbedView = (typeof ALL_VIEWS)[number];

function buildEmbedUrl(
  rawToken: string,
  view: string,
  params: { office?: string; from?: string; mode?: string; member?: string },
): string {
  const base = window.location.origin;
  const sp = new URLSearchParams({ token: rawToken });
  if (params.office) sp.set('office', params.office);
  if (params.from)   sp.set('from', params.from);
  if (params.mode && params.mode !== 'weekly') sp.set('mode', params.mode);
  if (params.member) sp.set('member', params.member);
  return `${base}/#/embed/${view}?${sp.toString()}`;
}

function buildIframeSnippet(url: string, height = 500): string {
  return `<iframe\n  src="${url}"\n  width="100%"\n  height="${height}"\n  style="border:none;border-radius:8px;"\n  allowfullscreen\n></iframe>`;
}

/**
 * Web-Component snippet — the recommended, smallest, most powerful format.
 * The single <effectime-embed> tag + <script> handles ALL capabilities (per-token):
 *   - any combination of allowed views (tabs auto-built)
 *   - read OR write permissions from the token (server-enforced)
 *   - native Effectime UI inside (purple wizard, smart suggest, calendar filters, etc.)
 *   - responsive container, live-data indicator, branded chrome
 */
function buildWebComponentSnippet(opts: {
  token: string;
  views: string[];
  height: number;
  office?: string;
  member?: string;
  mode?: string;
  origin: string;
}): string {
  const attrs = [
    `  token="${opts.token}"`,
    `  views="${opts.views.join(',')}"`,
    `  height="${opts.height}"`,
  ];
  if (opts.office) attrs.push(`  office="${opts.office}"`);
  if (opts.member) attrs.push(`  member="${opts.member}"`);
  if (opts.mode && opts.mode !== 'weekly') attrs.push(`  mode="${opts.mode}"`);
  return `<!-- Effectime embed (Web Component) -->
<effectime-embed
${attrs.join('\n')}
></effectime-embed>
<script src="${opts.origin}/embed.js" defer></script>`;
}

/**
 * CopyStyle: a self-contained, fully responsive Effectime-branded shell.
 */
function buildStyledSnippet(url: string, height = 500): string {
  const uid = 'et' + Math.random().toString(36).slice(2, 9);
  const h = Number(height) || 500;
  return `<!-- Effectime embed (CopyStyle) -->
<style>
  .${uid}-wrap{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 30px -12px rgba(15,23,42,.14),0 2px 6px -2px rgba(15,23,42,.06);padding:16px;max-width:100%;box-sizing:border-box;color:#0f172a;container-type:inline-size;}
  .${uid}-stripe{height:3px;width:100%;border-radius:3px;background:linear-gradient(90deg,#3b82f6 0%,#6366f1 50%,#22c55e 100%);margin-bottom:14px;}
  .${uid}-head{display:flex;align-items:center;gap:10px;margin:0 2px 12px;}
  .${uid}-logo{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#6366f1);box-shadow:0 4px 10px rgba(59,130,246,.35);color:#fff;font-weight:700;font-size:13px;letter-spacing:-.02em;}
  .${uid}-brand{font-weight:650;font-size:14px;letter-spacing:-.01em;color:#0f172a;}
  .${uid}-sub{font-size:11px;color:#64748b;font-weight:500;margin-left:2px;}
  .${uid}-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#15803d;font-weight:600;background:rgba(34,197,94,.10);padding:4px 9px;border-radius:999px;border:1px solid rgba(34,197,94,.22);}
  .${uid}-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.2);animation:${uid}-p 2s ease-in-out infinite;}
  @keyframes ${uid}-p{0%,100%{opacity:1}50%{opacity:.55}}
  .${uid}-frame{position:relative;border-radius:12px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0;}
  .${uid}-iframe{display:block;width:100%;height:${h}px;border:0;background:#f8fafc;}
  .${uid}-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding:0 2px;font-size:11px;color:#64748b;}
  .${uid}-foot a{color:#3b82f6;text-decoration:none;font-weight:600;}
  .${uid}-foot a:hover{text-decoration:underline;}
  @container (max-width: 560px){
    .${uid}-wrap{padding:10px;border-radius:12px;}
    .${uid}-sub{display:none;}
    .${uid}-iframe{height:${Math.max(420, Math.round(h * 0.85))}px;}
    .${uid}-foot span:first-child{display:none;}
  }
  @media (max-width: 560px){
    .${uid}-wrap{padding:10px;border-radius:12px;}
    .${uid}-sub{display:none;}
    .${uid}-iframe{height:70vh;min-height:420px;}
  }
</style>
<div class="${uid}-wrap">
  <div class="${uid}-stripe"></div>
  <div class="${uid}-head">
    <span class="${uid}-logo">E</span>
    <span class="${uid}-brand">Effectime</span>
    <span class="${uid}-sub">· kapacitás & beosztás</span>
    <span class="${uid}-live"><span class="${uid}-dot"></span>Live</span>
  </div>
  <div class="${uid}-frame">
    <iframe class="${uid}-iframe" src="${url}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="Effectime"></iframe>
  </div>
  <div class="${uid}-foot">
    <span>Real-time workforce data</span>
    <span>Powered by <a href="https://effectime.app" target="_blank" rel="noopener">Effectime</a></span>
  </div>
</div>`;
}

export function EmbedManager({ workspaceId, userId: _userId }: Props) {
  const { t } = useI18n();

  const [tokens, setTokens]   = useState<EmbedToken[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen]   = useState(false);
  const [labelInput, setLabelInput]   = useState('');
  const [selectedViews, setSelectedViews] = useState<EmbedView[]>(['capacity_planner']);
  const [canWrite, setCanWrite]       = useState(false);
  const [creating, setCreating]       = useState(false);

  // Reveal new token
  const [newToken, setNewToken] = useState<{ id: string; token: string } | null>(null);

  // Snippet builder (attached to newly created or existing token)
  const [builderToken, setBuilderToken] = useState<EmbedToken | null>(null);
  const [builderView, setBuilderView]   = useState<string>('capacity_planner');
  const [builderOffice, setBuilderOffice] = useState<string>('');
  const [builderMode, setBuilderMode]   = useState<string>('weekly');
  const [builderMember, setBuilderMember] = useState<string>('');
  const [builderHeight, setBuilderHeight] = useState<string>('500');
  const [builderCopyStyle, setBuilderCopyStyle] = useState<boolean>(false);
  const [builderFormat, setBuilderFormat] = useState<'web_component' | 'iframe'>('web_component');

  // Copy states
  const [copied, setCopied] = useState<string | null>(null);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<EmbedToken | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    const [tokRes, offRes] = await Promise.all([
      (supabase as any)
        .from('enterprise_embed_tokens')
        .select('id,token,label,allowed_views,can_write,is_active,last_used_at,expires_at,created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('enterprise_offices')
        .select('id,name,city')
        .eq('workspace_id', workspaceId)
        .order('name'),
    ]);
    setTokens((tokRes.data ?? []) as EmbedToken[]);
    setOffices((offRes.data ?? []) as Office[]);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const handleCreate = async () => {
    if (!labelInput.trim())        { toast.error(t('embed.validation_label_required')); return; }
    if (selectedViews.length === 0) { toast.error(t('embed.validation_views_required')); return; }
    setCreating(true);
    const { data, error } = await (supabase as any).rpc('create_embed_token', {
      _workspace_id: workspaceId,
      _label: labelInput.trim(),
      _allowed_views: selectedViews,
      _can_write: canWrite,
    });
    setCreating(false);
    if (error || !data?.[0]) { toast.error(t('embed.toast_create_error')); return; }
    setCreateOpen(false);
    setNewToken({ id: data[0].id, token: data[0].token });
    await loadTokens();
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const { error } = await (supabase as any).rpc('revoke_embed_token', { _token_id: revokeTarget.id });
    if (error) { toast.error(t('embed.toast_revoke_error')); }
    else { toast.success(t('embed.toast_revoked')); await loadTokens(); }
    setRevokeTarget(null);
  };

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleView = (v: EmbedView) =>
    setSelectedViews(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const activeTokens  = tokens.filter(t => t.is_active);
  const revokedTokens = tokens.filter(t => !t.is_active);

  // Build live snippet for builder
  const builderUrl = (() => {
    if (!builderToken?.token) return '';
    if (builderView === '__multi__') {
      const base = window.location.origin;
      const views = (builderToken.allowed_views ?? []).join(',');
      const sp = new URLSearchParams({ token: builderToken.token, views });
      if (builderOffice) sp.set('office', builderOffice);
      if (builderMember) sp.set('member', builderMember);
      return `${base}/#/embed/multi?${sp.toString()}`;
    }
    return buildEmbedUrl(builderToken.token, builderView, {
      office:  builderOffice  || undefined,
      mode:    builderMode !== 'weekly' ? builderMode : undefined,
      member:  builderView === 'member_schedule' ? builderMember || undefined : undefined,
    });
  })();
  const builderSnippet = (() => {
    if (!builderToken?.token) return '';
    if (builderFormat === 'web_component') {
      // Web Component covers any combination of allowed views via the views="" attr.
      const views = builderView === '__multi__'
        ? (builderToken.allowed_views ?? [])
        : [builderView];
      return buildWebComponentSnippet({
        token:  builderToken.token,
        views,
        height: Number(builderHeight) || 500,
        office: builderOffice || undefined,
        member: (views.includes('member_schedule') || views.length > 1) ? (builderMember || undefined) : undefined,
        mode:   views.includes('capacity_planner') ? (builderMode !== 'weekly' ? builderMode : undefined) : undefined,
        origin: window.location.origin,
      });
    }
    return builderUrl
      ? (builderCopyStyle
          ? buildStyledSnippet(builderUrl, Number(builderHeight) || 500)
          : buildIframeSnippet(builderUrl, Number(builderHeight) || 500))
      : '';
  })();

  const openBuilder = (tok: EmbedToken) => {
    setBuilderToken(tok);
    // Default to multi-view if token has more than one allowed view
    setBuilderView(tok.allowed_views.length > 1 ? '__multi__' : (tok.allowed_views[0] ?? 'capacity_planner'));
    setBuilderOffice('');
    setBuilderMode('weekly');
    setBuilderHeight('500');
    setBuilderCopyStyle(false);
    setBuilderFormat('web_component');
  };

  const viewLabel: Record<string, string> = {
    __multi__:        t('embed.view_multi'),
    capacity_planner: t('embed.view_capacity_planner'),
    shift_roster:     t('embed.view_shift_roster'),
    leave_calendar:   t('embed.view_leave_calendar'),
    office_headcount: t('embed.view_office_headcount'),
    member_schedule:  t('embed.view_member_schedule'),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t('embed.section_title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('embed.section_subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => { setLabelInput(''); setSelectedViews(['capacity_planner']); setCanWrite(false); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          {t('embed.create_token')}
        </Button>
      </div>

      {/* How it works */}
      <Card className="bg-muted/30">
        <CardContent className="p-3 flex gap-3 items-start text-xs text-muted-foreground">
          <Code2 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">{t('embed.how_it_works_title')}</p>
            <p>{t('embed.how_it_works_desc')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Active tokens table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeTokens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('embed.no_tokens')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('embed.col_label')}</TableHead>
                  <TableHead>{t('embed.col_views')}</TableHead>
                  <TableHead>{t('embed.col_write')}</TableHead>
                  <TableHead>{t('embed.col_last_used')}</TableHead>
                  <TableHead>{t('embed.col_expires')}</TableHead>
                  <TableHead className="text-right">{t('embed.col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTokens.map(tok => (
                  <TableRow key={tok.id}>
                    <TableCell className="font-medium">{tok.label}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tok.allowed_views.map(v => (
                          <Badge key={v} variant="secondary" className="text-[10px]">
                            {viewLabel[v] ?? v}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tok.can_write ? (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 gap-1">
                          <Pencil className="h-2.5 w-2.5" />
                          {t('embed.write_badge')}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{t('embed.read_only_badge')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tok.last_used_at ? format(new Date(tok.last_used_at), 'yyyy-MM-dd HH:mm') : t('embed.never')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tok.expires_at ? format(new Date(tok.expires_at), 'yyyy-MM-dd') : t('embed.no_expiry')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs"
                          onClick={() => openBuilder(tok)}>
                          <Settings2 className="h-3 w-3" />
                          {t('embed.snippet_builder')}
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setRevokeTarget(tok)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {revokedTokens.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('embed.revoked_count').replace('{{n}}', String(revokedTokens.length))}
        </p>
      )}

      {/* ── Create Token Dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              {t('embed.create_token')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="embed-label">{t('embed.label_field')}</Label>
              <Input
                id="embed-label"
                placeholder={t('embed.label_placeholder')}
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('embed.views_field')}</Label>
              {ALL_VIEWS.map(v => (
                <div key={v} className="flex items-center gap-2 rounded-md border p-2.5">
                  <Checkbox
                    id={`view-${v}`}
                    checked={selectedViews.includes(v)}
                    onCheckedChange={() => toggleView(v)}
                  />
                  <div>
                    <Label htmlFor={`view-${v}`} className="font-medium cursor-pointer text-sm">
                      {viewLabel[v]}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t(`embed.view_${v}_desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 rounded-md border p-2.5 bg-amber-50/40 dark:bg-amber-950/10">
              <Checkbox
                id="can-write"
                checked={canWrite}
                onCheckedChange={v => setCanWrite(!!v)}
              />
              <div>
                <Label htmlFor="can-write" className="font-medium cursor-pointer text-sm">
                  {t('embed.can_write_field')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('embed.can_write_desc')}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('embed.create_hint')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('embed.cancel')}</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? t('embed.creating') : t('embed.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Token Reveal Dialog ─────────────────────────────────────── */}
      <Dialog open={!!newToken} onOpenChange={() => setNewToken(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {t('embed.token_created_title')}
            </DialogTitle>
          </DialogHeader>
          {newToken && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-amber-600 font-medium">{t('embed.token_warning')}</p>
              <div className="space-y-1">
                <Label className="text-xs">{t('embed.token_label')}</Label>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-muted rounded-md p-2 font-mono break-all select-all">
                    {newToken.token}
                  </code>
                  <Button variant="outline" size="icon" className="shrink-0"
                    onClick={() => copyText(newToken.token, 'raw')}>
                    {copied === 'raw' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('embed.token_reveal_hint')}</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setNewToken(null)}>{t('embed.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Snippet Builder Dialog ──────────────────────────────────────── */}
      <Dialog open={!!builderToken} onOpenChange={open => { if (!open) setBuilderToken(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('embed.snippet_builder')} — {builderToken?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Left: config */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('embed.builder_view')}</Label>
                <Select value={builderView} onValueChange={setBuilderView}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(builderToken?.allowed_views ?? []).length > 1 && (
                      <SelectItem value="__multi__" className="text-xs font-semibold">
                        ◈ {t('embed.view_multi')}
                      </SelectItem>
                    )}
                    {(builderToken?.allowed_views ?? []).map(v => (
                      <SelectItem key={v} value={v} className="text-xs">{viewLabel[v] ?? v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t('embed.builder_office')}</Label>
                <Select value={builderOffice || '__all__'} onValueChange={v => setBuilderOffice(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">{t('embed.builder_all_offices')}</SelectItem>
                    {offices.map(o => (
                      <SelectItem key={o.id} value={o.id} className="text-xs">
                        {o.name}{o.city ? ` · ${o.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {builderView === 'capacity_planner' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('embed.builder_mode')}</Label>
                  <Select value={builderMode} onValueChange={setBuilderMode}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly" className="text-xs">{t('embed.mode_weekly')}</SelectItem>
                      <SelectItem value="monthly" className="text-xs">{t('embed.mode_monthly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(builderView === 'member_schedule' || builderView === '__multi__') && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('embed.builder_member')}</Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    value={builderMember}
                    onChange={e => setBuilderMember(e.target.value.trim())}
                    placeholder="user_id (UUID)"
                  />
                  <p className="text-[10px] text-muted-foreground">{t('embed.builder_member_hint')}</p>
                </div>
              )}

              {builderView === '__multi__' && (builderToken?.allowed_views ?? []).length > 1 && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
                  <p className="font-semibold text-foreground">{t('embed.view_multi')}</p>
                  <p>{t('embed.view_multi_desc')}</p>
                  <p className="font-medium text-foreground/70 mt-1">
                    {(builderToken?.allowed_views ?? []).map(v => viewLabel[v] ?? v).join(' · ')}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">{t('embed.builder_height')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 text-xs"
                    value={builderHeight}
                    onChange={e => setBuilderHeight(e.target.value.replace(/\D/g, ''))}
                    placeholder="500"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
              </div>

              {/* Snippet format selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Snippet formátum</Label>
                <Select value={builderFormat} onValueChange={(v: 'web_component' | 'iframe') => setBuilderFormat(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web_component" className="text-xs">◈ Web Component (ajánlott)</SelectItem>
                    <SelectItem value="iframe" className="text-xs">iframe</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {builderFormat === 'web_component'
                    ? 'Egyetlen <effectime-embed> tag + script. Minden engedélyezett nézet, írás/olvasás jog és natív Effectime UI (varázsló, intelligens beosztó, szűrők) automatikusan benne van.'
                    : 'Hagyományos iframe — minden host platformmal kompatibilis.'}
                </p>
              </div>

              {/* CopyStyle toggle — only for iframe format */}
              {builderFormat === 'iframe' && (
                <div className="flex items-start gap-3 rounded-md border bg-gradient-to-br from-primary/5 to-transparent p-2.5">
                  <Switch
                    id="copy-style"
                    checked={builderCopyStyle}
                    onCheckedChange={setBuilderCopyStyle}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="copy-style" className="flex items-center gap-1.5 font-medium cursor-pointer text-xs">
                      <Palette className="h-3 w-3 text-primary" />
                      {t('embed.copy_style_label')}
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {t('embed.copy_style_desc')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs"
                  onClick={() => window.open(builderUrl, '_blank')}>
                  <ExternalLink className="h-3 w-3" />
                  {t('embed.open_preview')}
                </Button>
              </div>
            </div>

            {/* Right: snippet */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('embed.iframe_label')}</Label>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1"
                  onClick={() => copyText(builderSnippet, 'snippet')}>
                  {copied === 'snippet'
                    ? <><CheckCircle2 className="h-3 w-3 text-green-600" /> {t('embed.copied')}</>
                    : <><Copy className="h-3 w-3" /> {t('embed.copy_snippet')}</>}
                </Button>
              </div>
              <pre className="text-[10px] bg-muted rounded-md p-2.5 font-mono whitespace-pre-wrap break-all select-all min-h-[120px] leading-relaxed">
                {builderSnippet}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setBuilderToken(null)}>{t('embed.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Confirm ──────────────────────────────────────────────── */}
      <AlertDialog open={!!revokeTarget} onOpenChange={open => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('embed.revoke_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('embed.revoke_desc').replace('{{label}}', revokeTarget?.label ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('embed.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRevoke}>
              {t('embed.revoke_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
