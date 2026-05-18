import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Copy, XCircle, CheckCircle2, RefreshCw, Code2, ExternalLink } from 'lucide-react';

interface Props {
  workspaceId: string;
  userId: string;
}

interface EmbedToken {
  id: string;
  label: string;
  token: string | null;
  allowed_views: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

function buildEmbedUrl(token: string, view = 'capacity_planner'): string {
  const base = window.location.origin;
  return `${base}/#/embed/${view}?token=${token}`;
}

function buildIframeSnippet(url: string): string {
  return `<iframe\n  src="${url}"\n  width="100%"\n  height="500"\n  style="border:none;border-radius:8px;"\n  allowfullscreen\n></iframe>`;
}

export function EmbedManager({ workspaceId, userId }: Props) {
  const { t } = useI18n();

  const [tokens, setTokens] = useState<EmbedToken[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Reveal new token
  const [newToken, setNewToken] = useState<{ id: string; token: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<EmbedToken | null>(null);

  // Copy snippet state per token
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_embed_tokens')
      .select('id,label,allowed_views,is_active,last_used_at,expires_at,created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    setTokens((data ?? []) as EmbedToken[]);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const handleCreate = async () => {
    if (!labelInput.trim()) { toast.error(t('embed.validation_label_required')); return; }
    setCreating(true);
    const { data, error } = await (supabase as any).rpc('create_embed_token', {
      _workspace_id: workspaceId,
      _label: labelInput.trim(),
      _allowed_views: ['capacity_planner'],
    });
    setCreating(false);
    if (error || !data?.[0]) {
      toast.error(t('embed.toast_create_error'));
      return;
    }
    setCreateOpen(false);
    setNewToken({ id: data[0].id, token: data[0].token });
    setCopiedToken(false);
    setCopiedIframe(false);
    await loadTokens();
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const { error } = await (supabase as any).rpc('revoke_embed_token', {
      _token_id: revokeTarget.id,
    });
    if (error) {
      toast.error(t('embed.toast_revoke_error'));
    } else {
      toast.success(t('embed.toast_revoked'));
      await loadTokens();
    }
    setRevokeTarget(null);
  };

  const copyToClipboard = async (text: string, kind: 'token' | 'iframe' | string) => {
    await navigator.clipboard.writeText(text);
    if (kind === 'token') { setCopiedToken(true); setTimeout(() => setCopiedToken(false), 2000); }
    else if (kind === 'iframe') { setCopiedIframe(true); setTimeout(() => setCopiedIframe(false), 2000); }
    else { setCopiedSnippet(kind); setTimeout(() => setCopiedSnippet(null), 2000); }
  };

  const activeTokens  = tokens.filter(t => t.is_active);
  const revokedTokens = tokens.filter(t => !t.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t('embed.section_title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('embed.section_subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => { setLabelInput(''); setCreateOpen(true); }}>
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
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('embed.no_tokens')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('embed.col_label')}</TableHead>
                  <TableHead>{t('embed.col_views')}</TableHead>
                  <TableHead>{t('embed.col_last_used')}</TableHead>
                  <TableHead>{t('embed.col_expires')}</TableHead>
                  <TableHead>{t('embed.col_snippet')}</TableHead>
                  <TableHead className="text-right">{t('embed.col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTokens.map(tok => {
                  const url = buildEmbedUrl(tok.id, tok.allowed_views[0] ?? 'capacity_planner');
                  const snippet = buildIframeSnippet(url);
                  return (
                    <TableRow key={tok.id}>
                      <TableCell className="font-medium">{tok.label}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tok.allowed_views.map(v => (
                            <Badge key={v} variant="secondary" className="text-[10px]">{v}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tok.last_used_at ? format(new Date(tok.last_used_at), 'yyyy-MM-dd HH:mm') : t('embed.never')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tok.expires_at ? format(new Date(tok.expires_at), 'yyyy-MM-dd') : t('embed.no_expiry')}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs"
                          onClick={() => copyToClipboard(snippet, tok.id)}>
                          {copiedSnippet === tok.id
                            ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                            : <Copy className="h-3 w-3" />}
                          {t('embed.copy_snippet')}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            title={t('embed.open_preview')}
                            onClick={() => window.open(url, '_blank')}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setRevokeTarget(tok)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
          <div className="space-y-3 py-2">
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
          {newToken && (() => {
            const embedUrl = buildEmbedUrl(newToken.token, 'capacity_planner');
            const snippet  = buildIframeSnippet(embedUrl);
            return (
              <div className="space-y-4 py-2">
                <p className="text-xs text-amber-600 font-medium">{t('embed.token_warning')}</p>

                {/* Raw token */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('embed.token_label')}</Label>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-muted rounded-md p-2 font-mono break-all select-all">
                      {newToken.token}
                    </code>
                    <Button variant="outline" size="icon" className="shrink-0"
                      onClick={() => copyToClipboard(newToken.token, 'token')}>
                      {copiedToken
                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                        : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* iframe snippet */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('embed.iframe_label')}</Label>
                  <div className="flex gap-2 items-start">
                    <pre className="flex-1 text-xs bg-muted rounded-md p-2 font-mono whitespace-pre-wrap break-all select-all">
                      {snippet}
                    </pre>
                    <Button variant="outline" size="icon" className="shrink-0"
                      onClick={() => copyToClipboard(snippet, 'iframe')}>
                      {copiedIframe
                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                        : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline"
              onClick={() => window.open(buildEmbedUrl(newToken?.token ?? '', 'capacity_planner'), '_blank')}>
              <ExternalLink className="h-4 w-4 mr-1" />
              {t('embed.open_preview')}
            </Button>
            <Button onClick={() => setNewToken(null)}>{t('embed.done')}</Button>
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
