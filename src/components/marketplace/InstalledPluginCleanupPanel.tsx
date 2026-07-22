import { useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { ChevronDown, Loader2, Puzzle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import {
  PluginMarketplaceMutationError,
  uninstallPlugin,
  useInstalledPlugins,
  type WorkspaceInstalledPlugin,
} from '@/hooks/usePluginMarketplace';

interface Props {
  workspaceId: string;
}

interface RemovalOperationScope {
  workspaceId: string;
  workspaceGeneration: number;
  token: number;
}

function formatInstalledAt(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat(locale === 'at' ? 'de-AT' : locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return value;
  }
}

/**
 * Owner-only installed-plugin inventory and recovery surface, including
 * installations no longer reachable through the entitled/published catalog.
 *
 * This component intentionally reads only the redacted workspace installation
 * inventory. The existing owner-authorized uninstall RPC remains the
 * authoritative tenant boundary.
 */
export function InstalledPluginCleanupPanel({ workspaceId }: Props) {
  const { locale, t } = useI18n();
  const {
    data: installed,
    isLoading,
    isError,
    isFetching,
    refetch: refetchInstalled,
  } = useInstalledPlugins(workspaceId);
  const [open, setOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<WorkspaceInstalledPlugin | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [retryableId, setRetryableId] = useState<string | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const latestWorkspaceIdRef = useRef(workspaceId);
  const workspaceGenerationRef = useRef(0);
  const operationCounterRef = useRef(0);
  const activeOperationRef = useRef<RemovalOperationScope | null>(null);
  const mountedRef = useRef(false);
  const panelToggleRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeOperationRef.current = null;
      pendingIdRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    latestWorkspaceIdRef.current = workspaceId;
    workspaceGenerationRef.current += 1;
    activeOperationRef.current = null;
    pendingIdRef.current = null;
    setPendingId(null);
    setRetryableId(null);
    setConfirmTarget(null);
    setOpen(false);
    lastTriggerRef.current = null;
  }, [workspaceId]);

  const isCurrentOperation = (scope: RemovalOperationScope) => {
    const active = activeOperationRef.current;
    return mountedRef.current
      && latestWorkspaceIdRef.current === scope.workspaceId
      && workspaceGenerationRef.current === scope.workspaceGeneration
      && active?.token === scope.token;
  };

  const requestRemoval = (installation: WorkspaceInstalledPlugin, trigger: HTMLButtonElement) => {
    if (pendingIdRef.current !== null) return;
    lastTriggerRef.current = trigger;
    setConfirmTarget(installation);
  };

  const handleConfirmRemoval = async (installation: WorkspaceInstalledPlugin) => {
    if (pendingIdRef.current !== null) return;

    const operationScope: RemovalOperationScope = {
      workspaceId,
      workspaceGeneration: workspaceGenerationRef.current,
      token: operationCounterRef.current + 1,
    };
    operationCounterRef.current = operationScope.token;
    activeOperationRef.current = operationScope;
    pendingIdRef.current = installation.id;
    setPendingId(installation.id);
    setRetryableId((current) => current === installation.id ? null : current);

    let receipt: { ok: boolean };
    try {
      receipt = await uninstallPlugin(installation.id);
      if (!receipt || receipt.ok !== true) {
        throw new PluginMarketplaceMutationError('request-failed');
      }
    } catch (error: unknown) {
      if (!isCurrentOperation(operationScope)) return;
      if (error instanceof PluginMarketplaceMutationError && error.code === 'retryable-conflict') {
        setRetryableId(installation.id);
        toast.error(t('marketplace.cleanup_retryable'));
      } else {
        toast.error(t('marketplace.cleanup_error'));
      }
      activeOperationRef.current = null;
      pendingIdRef.current = null;
      setPendingId(null);
      return;
    }

    if (!isCurrentOperation(operationScope)) return;

    try {
      const refreshed = await refetchInstalled();
      if (!isCurrentOperation(operationScope)) return;
      if (refreshed.isError) {
        toast.error(t('marketplace.cleanup_refresh_error'));
      } else {
        setRetryableId(null);
        toast.success(t('marketplace.cleanup_success'));
      }
    } catch {
      if (isCurrentOperation(operationScope)) {
        toast.error(t('marketplace.cleanup_refresh_error'));
      }
    } finally {
      if (isCurrentOperation(operationScope)) {
        activeOperationRef.current = null;
        pendingIdRef.current = null;
        setPendingId(null);
      }
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setConfirmTarget(null);
  };

  const installedCount = installed?.length ?? 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="mt-4">
        <CardHeader className="p-0">
          <CollapsibleTrigger asChild>
            <Button
              ref={panelToggleRef}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-2 whitespace-normal rounded-xl px-5 py-4 text-left"
              aria-label={isLoading || isError
                ? t('marketplace.cleanup_title')
                : t('marketplace.cleanup_toggle', { count: installedCount })}
            >
              <Puzzle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t('marketplace.cleanup_title')}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {t('marketplace.cleanup_summary')}
                </span>
              </span>
              {!isLoading && !isError && installedCount > 0 && (
                <Badge variant="secondary">{installedCount}</Badge>
              )}
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 border-t pt-4" aria-busy={isLoading || isFetching}>
            {isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('marketplace.cleanup_loading')}
              </p>
            ) : isError ? (
              <div className="space-y-2" role="alert">
                <p className="text-sm text-destructive">{t('marketplace.cleanup_load_error')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  onClick={() => { void refetchInstalled(); }}
                >
                  {isFetching && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {t('marketplace.cleanup_retry_load')}
                </Button>
              </div>
            ) : installedCount === 0 ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t('marketplace.cleanup_empty')}
              </p>
            ) : (
              <ul className="space-y-2" aria-label={t('marketplace.cleanup_list_label')}>
                {(installed ?? []).map((installation) => {
                  const isPending = pendingId === installation.id;
                  const isRetryable = retryableId === installation.id;
                  return (
                    <li
                      key={installation.id}
                      className="flex flex-col gap-3 rounded-lg border bg-background/60 p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{t('marketplace.cleanup_plugin_label')}</span>
                          <Badge variant={installation.enabled ? 'default' : 'outline'}>
                            {t(installation.enabled
                              ? 'marketplace.cleanup_enabled'
                              : 'marketplace.cleanup_disabled')}
                          </Badge>
                        </div>
                        <code className="block break-all text-xs text-muted-foreground">
                          {installation.plugin_id}
                        </code>
                        <p className="text-xs text-muted-foreground">
                          {t('marketplace.cleanup_installed_at')}{' '}
                          <time dateTime={installation.installed_at}>
                            {formatInstalledAt(installation.installed_at, locale)}
                          </time>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingId !== null}
                        onClick={(event) => requestRemoval(installation, event.currentTarget)}
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {t(isRetryable ? 'marketplace.cleanup_retry_remove' : 'marketplace.cleanup_remove')}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      <AlertDialog open={confirmTarget !== null} onOpenChange={handleDialogOpenChange}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            const trigger = lastTriggerRef.current;
            const focusTarget = trigger?.isConnected && !trigger.disabled
              ? trigger
              : panelToggleRef.current;
            if (focusTarget?.isConnected && !focusTarget.disabled) {
              event.preventDefault();
              focusTarget.focus();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('marketplace.cleanup_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('marketplace.cleanup_confirm_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmTarget && (
            <code className="break-all rounded bg-muted p-2 text-xs">{confirmTarget.plugin_id}</code>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = confirmTarget;
                if (target) void handleConfirmRemoval(target);
              }}
            >
              {t('marketplace.cleanup_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
