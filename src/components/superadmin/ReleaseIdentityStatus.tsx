import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  compareReleaseIdentities,
  getEdgeReleaseIdentity,
  getWebReleaseIdentity,
  type ReleaseAlignment,
  type ReleaseIdentity,
} from '@/config/releaseIdentity';

type CheckState = 'loading' | 'ready' | 'error';

const UNKNOWN_EDGE_IDENTITY: ReleaseIdentity = {
  sha: null,
  sourceTreeSha256: null,
  status: 'unknown',
};

function identityValue(identity: ReleaseIdentity, unknownLabel: string): string {
  return identity.status === 'identified' ? identity.sha : unknownLabel;
}

function sourceValue(identity: ReleaseIdentity, unknownLabel: string): string {
  return identity.status === 'identified' ? identity.sourceTreeSha256 : unknownLabel;
}

function AlignmentBadge({
  alignment,
  checking,
}: {
  alignment: ReleaseAlignment;
  checking: boolean;
}) {
  const { t } = useI18n();

  if (checking) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {t('superadmin.release_checking')}
      </Badge>
    );
  }

  if (alignment === 'match') {
    return (
      <Badge className="gap-1.5 border-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t('superadmin.release_match')}
      </Badge>
    );
  }

  if (alignment === 'mismatch') {
    return (
      <Badge variant="destructive" className="gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {t('superadmin.release_mismatch')}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5 border border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
      <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      {t('superadmin.release_unknown')}
    </Badge>
  );
}

/**
 * Fail-visible deployment attestation for platform administrators.
 * An unavailable or malformed Edge response remains explicitly unknown and
 * never gets presented as a successful match.
 */
export function ReleaseIdentityStatus() {
  const { t } = useI18n();
  const webIdentity = useMemo(() => getWebReleaseIdentity(), []);
  const [edgeIdentity, setEdgeIdentity] = useState<ReleaseIdentity>(UNKNOWN_EDGE_IDENTITY);
  const [checkState, setCheckState] = useState<CheckState>('loading');

  const load = useCallback(async () => {
    setCheckState('loading');
    setEdgeIdentity(UNKNOWN_EDGE_IDENTITY);

    try {
      const { data, error } = await supabase.functions.invoke('superadmin-hub', {
        body: { action: 'platform-version' },
      });
      if (error) throw error;

      setEdgeIdentity(getEdgeReleaseIdentity(data));
      setCheckState('ready');
    } catch {
      setCheckState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const alignment = compareReleaseIdentities(webIdentity, edgeIdentity);
  const unknownLabel = t('superadmin.release_unknown');

  return (
    <Card
      className={alignment === 'mismatch' ? 'border-destructive' : undefined}
      data-testid="release-identity-status"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold">
          {t('superadmin.release_title')}
        </CardTitle>
        <AlignmentBadge alignment={alignment} checking={checkState === 'loading'} />
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('superadmin.release_web')}
            </dt>
            <dd className="break-all font-mono text-xs" data-testid="web-release-sha">
              {identityValue(webIdentity, unknownLabel)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('superadmin.release_edge')}
            </dt>
            <dd className="break-all font-mono text-xs" data-testid="edge-release-sha">
              {identityValue(edgeIdentity, unknownLabel)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('superadmin.release_expected_edge_source')}
            </dt>
            <dd className="break-all font-mono text-xs" data-testid="web-edge-source-sha">
              {sourceValue(webIdentity, unknownLabel)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('superadmin.release_observed_edge_source')}
            </dt>
            <dd className="break-all font-mono text-xs" data-testid="edge-source-sha">
              {sourceValue(edgeIdentity, unknownLabel)}
            </dd>
          </div>
        </dl>

        {alignment === 'mismatch' && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {t('superadmin.release_mismatch_detail')}
          </p>
        )}

        {checkState === 'error' && (
          <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
            <p className="text-sm text-destructive">
              {t('superadmin.release_edge_error')}
            </p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('superadmin.release_retry')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
