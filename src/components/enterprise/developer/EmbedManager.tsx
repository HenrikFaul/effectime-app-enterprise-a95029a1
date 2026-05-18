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
import { Plus, Copy, XCircle, CheckCircle2, RefreshCw, Code2, ExternalLink, Settings2 } from 'lucide-react';

interface Props {
  workspaceId: string;
  userId: string;
}

interface EmbedToken {
  id: string;
  label: string;
  allowed_views: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Office { id: string; name: string; city: string | null }

const ALL_VIEWS = ['capacity_planner', 'shift_roster'] as const;
type EmbedView = (typeof ALL_VIEWS)[number];

function buildEmbedUrl(
  tokenId: string,
  view: string,
  params: { office?: string; from?: string; mode?: string },
): string {
  const base = window.location.origin;
  const sp = new URLSearchParams({ token: tokenId });
  if (params.office) sp.set('office', params.office);
  if (params.from)   sp.set('from', params.from);
  if (params.mode && params.mode !== 'weekly') sp.set('mode', params.mode);
  return `${base}/#/embed/${view}?${sp.toString()}`;
}

function buildIframeSnippet(url: string, height = 500): string {
  return `<iframe\n  src="${url}"\n  width="100%"\n  height="${height}"\n  style="border:none;border-radius:8px;"\n  allowfullscreen\n></iframe>`;
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
  const [creating, setCreating]       = useState(false);

  // Reveal new token
  const [newToken, setNewToken] = useState<{ id: string; token: string } | null>(null);

  // Snippet builder (attached to newly created or existing token)
  const [builderToken, setBuilderToken] = useState<EmbedToken | null>(null);
  const [builderView, setBuilderView]   = useState<string>('capacity_planner');
  const [builderOffice, setBuilderOffice] = useState<string>('');
  const [builderMode, setBuilderMode]   = useState<string>('weekly');
  const [builderHeight, setBuilderHeight] = useState<string>('500');

  // Copy states
  const [copied, setCopied] = useState<string | null>(null);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<EmbedToken | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    const [tokRes, offRes] = await Promise.all([
      (supabase as any)
        .from('enterprise_embed_tokens')
        .select('id,label,allowed_views,is_active,last_used_at,expires_at,created_at')
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
  const builderUrl = builderToken
    ? buildEmbedUrl(builderToken.id, builderView, {
        office: builderOffice || undefined,
        mode: builderMode !== 'weekly' ? builderMode : undefined,
      })
    : '';
  const builderSnippet = builderUrl ? buildIframeSnippet(builderUrl, Number(builderHeight) || 500) : '';

  const openBuilder = (tok: EmbedToken) => {
    setBuilderToken(tok);
    setBuilderView(tok.allowed_views[0] ?? 'capacity_planner');
    setBuilderOffice('');
    setBuilderMode('weekly');
    setBuilderHeight('500');
  };

  const viewLabel: Record<string, string> = {
    capacity_planner: t('embed.view_capacity_planner'),
    shift_roster:     t('embed.view_shift_roster'),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t('embed.section_title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('embed.section_subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => { setLabelInput(''); setSelectedViews(['capacity_planner']); setCreateOpen(true); }}>
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
