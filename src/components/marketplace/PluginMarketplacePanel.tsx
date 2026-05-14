import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Puzzle, Download, Trash2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import {
  useMarketplacePlugins,
  useInstalledPlugins,
  installPlugin,
  uninstallPlugin,
  type MarketplacePlugin,
} from '@/hooks/usePluginMarketplace';

interface Props {
  workspaceId: string;
}

/**
 * PluginMarketplacePanel — Top-20 Rank 19, v3.30.0.
 *
 * Browse published plugins + manage installed ones for the current
 * workspace. Workspace owner only (RPCs enforce; UI gates redundantly).
 */
export function PluginMarketplacePanel({ workspaceId }: Props) {
  const { t } = useI18n();
  const { data: plugins, isLoading: loadingPlugins } = useMarketplacePlugins();
  const { data: installed, refetch: refetchInstalled } = useInstalledPlugins(workspaceId);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<MarketplacePlugin['category'] | 'all'>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const installedByPluginId = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of installed ?? []) m.set(i.plugin_id, i.id);
    return m;
  }, [installed]);

  const filtered = useMemo(() => {
    return (plugins ?? []).filter((p) => {
      if (p.status !== 'published') return false;
      if (category !== 'all' && p.category !== category) return false;
      if (filter && !`${p.name} ${p.description ?? ''}`.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [plugins, category, filter]);

  const handleInstall = async (plugin: MarketplacePlugin) => {
    setPendingId(plugin.id);
    try {
      await installPlugin(workspaceId, plugin.id);
      toast.success(t('marketplace.install_success', { name: plugin.name }));
      await refetchInstalled();
    } catch (e: unknown) {
      toast.error(t('marketplace.install_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPendingId(null);
    }
  };

  const handleUninstall = async (plugin: MarketplacePlugin, installedId: string) => {
    setPendingId(installedId);
    try {
      await uninstallPlugin(installedId);
      toast.success(t('marketplace.uninstall_success', { name: plugin.name }));
      await refetchInstalled();
    } catch (e: unknown) {
      toast.error(t('marketplace.uninstall_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPendingId(null);
    }
  };

  const categoryClass = (c: MarketplacePlugin['category']) =>
    c === 'integration' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300'
      : c === 'analytics' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300'
      : c === 'compliance' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-amber-400'
      : c === 'vertical' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300'
      : 'bg-muted text-muted-foreground';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-primary" />
          {t('marketplace.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('marketplace.search_placeholder')}
              className="pl-7 h-8 text-xs"
            />
          </div>
          <div className="inline-flex rounded-md border bg-background overflow-hidden text-xs">
            {(['all', 'integration', 'analytics', 'compliance', 'vertical', 'automation'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1 ${category === c ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {t(`marketplace.category_${c}` as 'marketplace.category_all')}
              </button>
            ))}
          </div>
        </div>

        {loadingPlugins ? (
          <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">{t('marketplace.empty')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtered.map((p) => {
              const installedId = installedByPluginId.get(p.id);
              const isInstalled = !!installedId;
              return (
                <div key={p.id} className="rounded-lg border bg-background/60 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${categoryClass(p.category)}`}>
                          {t(`marketplace.category_${p.category}` as 'marketplace.category_integration')}
                        </Badge>
                        {p.pricing_model !== 'free' && (
                          <Badge variant="outline" className="text-[10px]">
                            {t(`marketplace.pricing_${p.pricing_model}` as 'marketplace.pricing_free')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">v{p.version} · {p.author_name ?? '—'}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {p.install_count} {t('marketplace.installs')}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex justify-end">
                    {isInstalled ? (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => handleUninstall(p, installedId!)}
                        disabled={pendingId === installedId}
                      >
                        {pendingId === installedId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><Trash2 className="h-3.5 w-3.5 mr-1" /> {t('marketplace.uninstall')}</>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleInstall(p)}
                        disabled={pendingId === p.id}
                      >
                        {pendingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><Download className="h-3.5 w-3.5 mr-1" /> {t('marketplace.install')}</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
