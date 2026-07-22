import { useRef, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ICalTokenRevocationList } from './ICalTokenRevocationList';

interface Props {
  workspaceId: string;
  userId: string;
  isRetrying: boolean;
  onRetry: () => Promise<void>;
}

export function EntitlementRecoveryPanel({ workspaceId, userId, isRetrying, onRetry }: Props) {
  const { t } = useI18n();
  const retryInFlightRef = useRef<Promise<void> | null>(null);
  const [locallyRetrying, setLocallyRetrying] = useState(false);
  const busy = isRetrying || locallyRetrying;

  const handleRetry = async () => {
    if (retryInFlightRef.current) return retryInFlightRef.current;
    setLocallyRetrying(true);
    const retry = Promise.resolve().then(onRetry);
    retryInFlightRef.current = retry;
    try {
      await retry;
    } catch {
      // The UI deliberately stays generic; backend diagnostics can contain
      // tenant or authorization details that must not reach the browser log.
      console.warn('[EntitlementRecoveryPanel] feature access retry failed');
    } finally {
      if (retryInFlightRef.current === retry) {
        retryInFlightRef.current = null;
        setLocallyRetrying(false);
      }
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4" aria-label={t('feature_gate.entitlement_unavailable_title')}>
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>{t('feature_gate.entitlement_unavailable_title')}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{t('feature_gate.entitlement_unavailable_description')}</p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void handleRetry()}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            {t(busy ? 'feature_gate.retrying_entitlements' : 'feature_gate.retry_entitlements')}
          </Button>
        </AlertDescription>
      </Alert>

      <ICalTokenRevocationList workspaceId={workspaceId} userId={userId} />
    </section>
  );
}
