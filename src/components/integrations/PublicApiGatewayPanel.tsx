import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Webhook, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { SUPABASE_URL, buildSupabaseFunctionUrl } from '@/config/publicRuntime';

interface Props {
  /** Supabase project URL (without trailing slash). Read from import.meta.env or constant. */
  projectUrl?: string;
}

/**
 * PublicApiGatewayPanel — Top-20 Rank 9, v3.24.0.
 *
 * Informational panel for the DeveloperPortal: documents the public-api
 * REST endpoints + the webhook-dispatcher contract + copy-to-clipboard
 * helpers for example curl commands.
 *
 * No data fetches; pure docs surface.
 */
export function PublicApiGatewayPanel({ projectUrl = SUPABASE_URL }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  const base = buildSupabaseFunctionUrl('public-api', projectUrl);
  const examples = [
    { route: 'GET /v1/health', desc: t('integrations.api_endpoint_health'), curl: `curl -H "Authorization: Bearer YOUR_API_KEY" ${base}/v1/health` },
    { route: 'GET /v1/employees', desc: t('integrations.api_endpoint_employees'), curl: `curl -H "Authorization: Bearer YOUR_API_KEY" ${base}/v1/employees` },
    { route: 'GET /v1/schedules', desc: t('integrations.api_endpoint_schedules'), curl: `curl -H "Authorization: Bearer YOUR_API_KEY" ${base}/v1/schedules` },
    { route: 'GET /v1/leave-requests', desc: t('integrations.api_endpoint_leave_requests'), curl: `curl -H "Authorization: Bearer YOUR_API_KEY" ${base}/v1/leave-requests` },
  ];

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(t('common.copied'));
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(t('common.copy_failed'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Endpoints list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            {t('integrations.api_gateway_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('integrations.api_base_url')}
            </p>
            <div className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5 font-mono text-xs">
              <span className="flex-1 truncate">{base}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(base, 'base')}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('integrations.api_endpoints')}
            </p>
            {examples.map((ex) => (
              <div key={ex.route} className="rounded-lg border p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{ex.route}</Badge>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(ex.curl, ex.route)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{ex.desc}</p>
                <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                  {ex.curl}
                </pre>
                {copied === ex.route && (
                  <p className="text-[10px] text-emerald-600">{t('common.copied_to_clipboard')}</p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded border border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 text-xs space-y-1">
            <p className="font-medium">{t('integrations.api_rate_limit_title')}</p>
            <p className="text-muted-foreground">{t('integrations.api_rate_limit_desc')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook contract */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Webhook className="h-4 w-4 text-primary" />
            {t('integrations.webhook_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-muted-foreground">{t('integrations.webhook_desc')}</p>
          <div className="space-y-1">
            <p className="font-medium">{t('integrations.webhook_signature_title')}</p>
            <pre className="rounded border bg-muted/40 px-2 py-1.5 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
{`X-Effectime-Signature: sha256=<HMAC-SHA256(secret, body)>
X-Effectime-Event: <event_type>
X-Effectime-Delivery-Id: <uuid>`}
            </pre>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('integrations.webhook_retry_hint')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
