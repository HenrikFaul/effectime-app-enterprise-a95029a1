import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Loader2, Layers, Puzzle, Search, GitBranch, Network, ChevronRight, ChevronDown, Pencil,
  AlertTriangle, GripVertical, Eye, ArrowDownToLine, Link2, Copy as CopyIcon, AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useI18n } from '@/i18n/I18nProvider';
import { tierName, addonName, featureName, featureDescription } from '@/lib/tiering/labels';

interface Tier { id: string; tier_key: string; name: string; sort_order: number; }
interface Addon { id: string; addon_key: string; name: string; }
interface Feature {
  id: string; feature_key: string; name: string; module: string | null;
  description: string | null; status: string | null;
  dependencies: string[] | null;
  route_path: string | null;
  menu_path: string[] | null;
  sort_order: number;
}
interface TFRow { tier_id: string; feature_id: string; }
interface AFRow { addon_id: string; feature_id: string; }

type ViewMode = 'tiers' | 'addons' | 'routing';

export function FeatureTiersTab() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [tf, setTf] = useState<TFRow[]>([]);
  const [af, setAf] = useState<AFRow[]>([]);
  const [mode, setMode] = useState<ViewMode>('tiers');
  const [activeTier, setActiveTier] = useState<string>('');
  const [activeAddon, setActiveAddon] = useState<string>('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [pendingKey, setPendingKey] = useState<string>('');
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoQ, setAutoQ] = useState('');
  const [editingRouteFor, setEditingRouteFor] = useState<string>('');
  const [routeDraft, setRouteDraft] = useState<{ route_path: string; menu_path: string }>({ route_path: '', menu_path: '' });
  const [routingTier, setRoutingTier] = useState<string>('all');
  const [viewingFeatureId, setViewingFeatureId] = useState<string>('');
  const { user } = useAuth();
  // openPaths keys are tree-position strings of the form
  //   "page::<route_path>"  →  "page::<route_path>|menu::<seg1>"  → …
  // The "page::" / "menu::" prefixes make the key independent of label
  // collisions (e.g. a menu segment that happens to equal a route path),
  // so reordering features or adding new branches never shifts what stays
  // open. Persisted per (user, tier) so a Freemium audit and an Enterprise
  // audit have separate expansion state.
  const openStorageKey = `routingTreeOpen:v3:${user?.id || 'anon'}:${routingTier}`;
  const [openPaths, setOpenPaths] = useState<Record<string, boolean>>({});

  // Load persisted open-state when user/tier changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(openStorageKey);
      setOpenPaths(raw ? JSON.parse(raw) : {});
    } catch { setOpenPaths({}); }
  }, [openStorageKey]);

  const toggleOpenPath = useCallback((path: string, isOpen: boolean) => {
    setOpenPaths(prev => {
      const next = { ...prev, [path]: isOpen };
      try { localStorage.setItem(openStorageKey, JSON.stringify(next)); } catch { /* ignore quota */ }
      return next;
    });
  }, [openStorageKey]);

  // Stable tree-position keys built from the same prefixes RoutingTree uses.
  // Keep these in sync with renderNode() in RoutingTree.
  const buildPathKeys = useCallback((routePath: string | null, menuPath: string[]): string[] => {
    const page = routePath && routePath.trim() ? routePath.trim() : '__no_route__';
    const keys: string[] = [`page::${page}`];
    let acc = keys[0];
    for (const seg of menuPath) {
      acc = `${acc}|menu::${seg}`;
      keys.push(acc);
    }
    return keys;
  }, []);

  const expandToFeature = useCallback((routePath: string | null, menuPath: string[]) => {
    const keys = buildPathKeys(routePath, menuPath);
    setOpenPaths(prev => {
      const next = { ...prev };
      for (const k of keys) next[k] = true;
      try { localStorage.setItem(openStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [buildPathKeys, openStorageKey]);

  // Open many paths at once — used when a user clicks a node's count badge to
  // expand the whole subtree under that node. Persisted alongside toggleOpenPath.
  const expandSubtree = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setOpenPaths(prev => {
      const next = { ...prev };
      for (const p of paths) next[p] = true;
      try { localStorage.setItem(openStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [openStorageKey]);

  // Routing tree view mode — "tree" (collapsible nested) or "flat" (one line per
  // feature with the full route+menu path concatenated). Persisted per user.
  const viewModeStorageKey = `routingTreeViewMode:v1:${user?.id || 'anon'}`;
  const [routingViewMode, setRoutingViewMode] = useState<'tree' | 'flat'>('tree');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(viewModeStorageKey);
      if (raw === 'tree' || raw === 'flat') setRoutingViewMode(raw);
    } catch { /* ignore */ }
  }, [viewModeStorageKey]);
  const setRoutingViewModePersisted = useCallback((m: 'tree' | 'flat') => {
    setRoutingViewMode(m);
    try { localStorage.setItem(viewModeStorageKey, m); } catch { /* ignore */ }
  }, [viewModeStorageKey]);

  const load = async () => {
    setLoading(true);
    const [tRes, aRes, fRes, tfRes, afRes] = await Promise.all([
      supabase.from('tiers').select('id, tier_key, name, sort_order').order('sort_order'),
      supabase.from('addons').select('id, addon_key, name').order('addon_key'),
      supabase.from('features').select('id, feature_key, name, module, description, status, dependencies, route_path, menu_path, sort_order').order('sort_order').order('module').order('feature_key'),
      supabase.from('tier_features').select('tier_id, feature_id'),
      supabase.from('addon_features').select('addon_id, feature_id'),
    ]);
    setTiers((tRes.data as Tier[]) || []);
    setAddons((aRes.data as Addon[]) || []);
    setFeatures((fRes.data as Feature[]) || []);
    setTf((tfRes.data as TFRow[]) || []);
    setAf((afRes.data as AFRow[]) || []);
    if (tRes.data?.length && !activeTier) setActiveTier((tRes.data[0] as Tier).id);
    if (aRes.data?.length && !activeAddon) setActiveAddon((aRes.data[0] as Addon).id);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const featureByKey = useMemo(() => {
    const m = new Map<string, Feature>();
    features.forEach(f => m.set(f.feature_key, f));
    return m;
  }, [features]);

  const dependents = useMemo(() => {
    // feature_key -> array of feature_keys that depend on it
    const m = new Map<string, string[]>();
    features.forEach(f => {
      (f.dependencies || []).forEach(dep => {
        if (!m.has(dep)) m.set(dep, []);
        m.get(dep)!.push(f.feature_key);
      });
    });
    return m;
  }, [features]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    features.forEach(f => f.module && set.add(f.module));
    return Array.from(set).sort();
  }, [features]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return features.filter(f => {
      if (moduleFilter !== 'all' && f.module !== moduleFilter) return false;
      if (!q) return true;
      return f.feature_key.toLowerCase().includes(q)
        || f.name.toLowerCase().includes(q)
        || (f.description || '').toLowerCase().includes(q);
    });
  }, [features, search, moduleFilter]);

  const tierMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    tf.forEach(r => { if (!m.has(r.tier_id)) m.set(r.tier_id, new Set()); m.get(r.tier_id)!.add(r.feature_id); });
    return m;
  }, [tf]);

  const addonMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    af.forEach(r => { if (!m.has(r.addon_id)) m.set(r.addon_id, new Set()); m.get(r.addon_id)!.add(r.feature_id); });
    return m;
  }, [af]);

  const audit = async (action: string, payload: Record<string, unknown>) => {
    if (!user?.id) return;
    // Fire-and-forget; never block the UI on audit success. Errors are logged
    // but never surface to the operator — the platform_audit_events RLS only
    // accepts inserts from platform admins, so a failure here is a real config
    // problem worth a console warning.
    try {
      const { error } = await supabase.from('platform_audit_events').insert({
        actor_id: user.id,
        action,
        target_type: (payload.target_type as string | null | undefined) ?? null,
        target_id: (payload.target_id as string | null | undefined) ?? null,
        new_state: (payload.new_state as never) ?? null,
        metadata: (payload.metadata as never) ?? {},
      });
      if (error) console.warn('[platform_audit_events] insert failed', error);
    } catch (err) {
      console.warn('[platform_audit_events] insert threw', err);
    }
  };

  const toggleTier = async (tierId: string, featureId: string, enabled: boolean) => {
    const key = `t-${tierId}-${featureId}`;
    setPendingKey(key);
    if (enabled) {
      const { error } = await supabase.from('tier_features').insert({ tier_id: tierId, feature_id: featureId });
      if (error) toast.error(error.message); else {
        setTf(prev => [...prev, { tier_id: tierId, feature_id: featureId }]);
        void audit('tier_feature_enabled', { target_type: 'tier_feature', target_id: `${tierId}:${featureId}`, new_state: { enabled: true }, metadata: { tier_id: tierId, feature_id: featureId } });
      }
    } else {
      const { error } = await supabase.from('tier_features').delete().eq('tier_id', tierId).eq('feature_id', featureId);
      if (error) toast.error(error.message); else {
        setTf(prev => prev.filter(r => !(r.tier_id === tierId && r.feature_id === featureId)));
        void audit('tier_feature_disabled', { target_type: 'tier_feature', target_id: `${tierId}:${featureId}`, new_state: { enabled: false }, metadata: { tier_id: tierId, feature_id: featureId } });
      }
    }
    setPendingKey('');
  };

  const toggleAddon = async (addonId: string, featureId: string, enabled: boolean) => {
    const key = `a-${addonId}-${featureId}`;
    setPendingKey(key);
    if (enabled) {
      const { error } = await supabase.from('addon_features').insert({ addon_id: addonId, feature_id: featureId });
      if (error) toast.error(error.message); else {
        setAf(prev => [...prev, { addon_id: addonId, feature_id: featureId }]);
        void audit('addon_feature_enabled', { target_type: 'addon_feature', target_id: `${addonId}:${featureId}`, new_state: { enabled: true }, metadata: { addon_id: addonId, feature_id: featureId } });
      }
    } else {
      const { error } = await supabase.from('addon_features').delete().eq('addon_id', addonId).eq('feature_id', featureId);
      if (error) toast.error(error.message); else {
        setAf(prev => prev.filter(r => !(r.addon_id === addonId && r.feature_id === featureId)));
        void audit('addon_feature_disabled', { target_type: 'addon_feature', target_id: `${addonId}:${featureId}`, new_state: { enabled: false }, metadata: { addon_id: addonId, feature_id: featureId } });
      }
    }
    setPendingKey('');
  };

  const saveRoute = async (featureId: string) => {
    const menu = routeDraft.menu_path.split('>').map(x => x.trim()).filter(Boolean);
    const nextRoute = routeDraft.route_path.trim() || null;
    const { error } = await supabase.from('features').update({
      route_path: nextRoute,
      menu_path: menu,
    }).eq('id', featureId);
    if (error) { toast.error(error.message); return; }
    setFeatures(prev => prev.map(f => f.id === featureId ? { ...f, route_path: nextRoute, menu_path: menu } : f));
    void audit('feature_routing_updated', { target_type: 'feature', target_id: featureId, new_state: { route_path: nextRoute, menu_path: menu } });
    // Auto-expand the saved branch so the user sees the row land in the tree.
    expandToFeature(nextRoute, menu);
    setEditingRouteFor('');
    toast.success(t('feature_tiers.saved_toast'));
    // Defer scroll until the tree has re-rendered with the new path open.
    setTimeout(() => {
      document.getElementById(`feature-row-${featureId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  // Reorder a list of feature IDs and persist their new sort_order (gap of 10)
  const persistOrder = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, idx) => ({ id, sort_order: (idx + 1) * 10 }));
    setFeatures(prev => {
      const map = new Map(updates.map(u => [u.id, u.sort_order]));
      return prev.map(f => map.has(f.id) ? { ...f, sort_order: map.get(f.id)! } : f);
    });
    // Persist sequentially; small set per leaf node
    for (const u of updates) {
      const { error } = await supabase.from('features').update({ sort_order: u.sort_order }).eq('id', u.id);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t('feature_tiers.order_saved_toast'));
  };

  // Jump to a feature's editor (used by missing-prereq badges).
  // Expands the ancestor chain in the tree and scrolls the row into view.
  const openFeatureEditor = useCallback((featureKey: string) => {
    const f = features.find(x => x.feature_key === featureKey);
    if (!f) { toast.error(t('feature_tiers.feature_not_found', { key: featureKey })); return; }
    expandToFeature(f.route_path, f.menu_path || []);
    setEditingRouteFor(f.id);
    setRouteDraft({ route_path: f.route_path || '', menu_path: (f.menu_path || []).join(' > ') });
    setMode('routing');
    setTimeout(() => {
      document.getElementById(`feature-row-${f.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }, [features, expandToFeature, t]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  // Autocomplete suggestions
  const autoSuggest = (() => {
    const q = autoQ.trim().toLowerCase();
    if (!q) return [] as Array<{ kind: 'feature' | 'module' | 'route' | 'menu'; label: string; value: string; meta?: string }>;
    const items: Array<{ kind: 'feature' | 'module' | 'route' | 'menu'; label: string; value: string; meta?: string }> = [];
    features.forEach(f => {
      const localizedName = featureName(t, f.feature_key, f.name);
      if (f.feature_key.toLowerCase().includes(q) || localizedName.toLowerCase().includes(q)) {
        items.push({ kind: 'feature', label: localizedName, value: f.feature_key, meta: f.module || '' });
      }
      if (f.route_path && f.route_path.toLowerCase().includes(q)) {
        items.push({ kind: 'route', label: f.route_path, value: f.feature_key, meta: localizedName });
      }
      (f.menu_path || []).forEach(m => {
        if (m.toLowerCase().includes(q)) items.push({ kind: 'menu', label: m, value: f.feature_key, meta: localizedName });
      });
    });
    modules.forEach(m => { if (m.toLowerCase().includes(q)) items.push({ kind: 'module', label: m, value: m }); });
    // dedupe by kind+value+label
    const seen = new Set<string>();
    return items.filter(i => { const k = `${i.kind}|${i.label}|${i.value}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30);
  })();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t('feature_tiers.stats_tiers')}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{tiers.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t('feature_tiers.stats_addons')}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{addons.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t('feature_tiers.stats_features')}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{features.length}</CardContent></Card>
      </div>

      {/* Autocomplete free-text search (independent of filter bar) */}
      <Popover open={autoOpen} onOpenChange={setAutoOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground">
            <Search className="h-4 w-4" />
            {t('feature_tiers.search_omnibox')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={autoQ} onValueChange={setAutoQ} placeholder={t('feature_tiers.search_input_placeholder')} />
            <CommandList>
              <CommandEmpty>{t('feature_tiers.search_empty')}</CommandEmpty>
              <CommandGroup>
                {autoSuggest.map((s, idx) => (
                  <CommandItem
                    key={`${s.kind}-${s.value}-${idx}`}
                    onSelect={() => {
                      if (s.kind === 'module') { setModuleFilter(s.value); setSearch(''); }
                      else { setSearch(s.value); setModuleFilter('all'); }
                      setAutoOpen(false);
                      setAutoQ('');
                    }}
                  >
                    <Badge variant="outline" className="text-[10px] mr-2">{s.kind}</Badge>
                    <span className="font-medium text-sm">{s.label}</span>
                    {s.meta && <span className="ml-2 text-xs text-muted-foreground truncate">{s.meta}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Tabs value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="tiers" className="gap-1"><Layers className="h-4 w-4" /> {t('feature_tiers.tab_tiers')}</TabsTrigger>
          <TabsTrigger value="addons" className="gap-1"><Puzzle className="h-4 w-4" /> {t('feature_tiers.tab_addons')}</TabsTrigger>
          <TabsTrigger value="routing" className="gap-1"><Network className="h-4 w-4" /> {t('feature_tiers.tab_routing')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-3 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={activeTier} onValueChange={setActiveTier}>
              <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiers.map(ti => (<SelectItem key={ti.id} value={ti.id}>{tierName(t, ti.tier_key, ti.name)} ({ti.tier_key})</SelectItem>))}
              </SelectContent>
            </Select>
            {tiers.find(ti => ti.id === activeTier) && (
              <Badge variant="outline">
                {t('feature_tiers.feature_count_badge', { enabled: tierMap.get(activeTier)?.size || 0, total: features.length })}
              </Badge>
            )}
          </div>
          <FilterBar search={search} setSearch={setSearch} modules={modules} moduleFilter={moduleFilter} setModuleFilter={setModuleFilter} />
          <FeatureGrid
            features={filtered}
            featureByKey={featureByKey}
            dependents={dependents}
            isOn={(fid) => tierMap.get(activeTier)?.has(fid) ?? false}
            onToggle={(fid, on) => toggleTier(activeTier, fid, on)}
            pendingKeyPrefix={`t-${activeTier}-`}
            pendingKey={pendingKey}
          />
        </TabsContent>

        <TabsContent value="addons" className="space-y-3 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={activeAddon} onValueChange={setActiveAddon}>
              <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {addons.map(a => (<SelectItem key={a.id} value={a.id}>{addonName(t, a.addon_key, a.name)} ({a.addon_key})</SelectItem>))}
              </SelectContent>
            </Select>
            {addons.find(a => a.id === activeAddon) && (
              <Badge variant="outline">{t('feature_tiers.addon_feature_count_badge', { count: addonMap.get(activeAddon)?.size || 0 })}</Badge>
            )}
          </div>
          <FilterBar search={search} setSearch={setSearch} modules={modules} moduleFilter={moduleFilter} setModuleFilter={setModuleFilter} />
          <FeatureGrid
            features={filtered}
            featureByKey={featureByKey}
            dependents={dependents}
            isOn={(fid) => addonMap.get(activeAddon)?.has(fid) ?? false}
            onToggle={(fid, on) => toggleAddon(activeAddon, fid, on)}
            pendingKeyPrefix={`a-${activeAddon}-`}
            pendingKey={pendingKey}
          />
        </TabsContent>

        <TabsContent value="routing" className="space-y-3 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={routingTier} onValueChange={setRoutingTier}>
              <SelectTrigger className="w-[260px] h-9"><SelectValue placeholder={t('feature_tiers.tier_filter_placeholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('feature_tiers.tier_filter_all')}</SelectItem>
                {tiers.map(ti => (<SelectItem key={ti.id} value={ti.id}>{t('feature_tiers.tier_filter_only', { name: tierName(t, ti.tier_key, ti.name), key: ti.tier_key })}</SelectItem>))}
              </SelectContent>
            </Select>
            {routingTier !== 'all' && (
              <Badge variant="outline">{t('feature_tiers.tier_filter_badge', { count: tierMap.get(routingTier)?.size || 0 })}</Badge>
            )}
            <div className="ml-auto inline-flex rounded-md border bg-background overflow-hidden">
              <Button
                type="button"
                size="sm"
                variant={routingViewMode === 'tree' ? 'default' : 'ghost'}
                className="h-8 rounded-none"
                onClick={() => setRoutingViewModePersisted('tree')}
              >
                {t('feature_tiers.tree_view_mode_tree')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={routingViewMode === 'flat' ? 'default' : 'ghost'}
                className="h-8 rounded-none"
                onClick={() => setRoutingViewModePersisted('flat')}
              >
                {t('feature_tiers.tree_view_mode_flat')}
              </Button>
            </div>
          </div>
          <RoutingAuditBanner features={filtered} onJump={openFeatureEditor} />
          <FilterBar search={search} setSearch={setSearch} modules={modules} moduleFilter={moduleFilter} setModuleFilter={setModuleFilter} />
          {routingViewMode === 'tree' ? (
            <RoutingTree
              features={filtered}
              tierFilterIds={routingTier === 'all' ? null : (tierMap.get(routingTier) || new Set())}
              featureByKey={featureByKey}
              editingRouteFor={editingRouteFor}
              setEditingRouteFor={(id) => {
                setEditingRouteFor(id);
                const f = features.find(x => x.id === id);
                if (f) setRouteDraft({ route_path: f.route_path || '', menu_path: (f.menu_path || []).join(' > ') });
              }}
              routeDraft={routeDraft}
              setRouteDraft={setRouteDraft}
              saveRoute={saveRoute}
              persistOrder={persistOrder}
              openPaths={openPaths}
              toggleOpenPath={toggleOpenPath}
              expandSubtree={expandSubtree}
              onOpenDepEditor={openFeatureEditor}
              onViewFeature={setViewingFeatureId}
            />
          ) : (
            <RoutingFlatList
              features={filtered}
              tierFilterIds={routingTier === 'all' ? null : (tierMap.get(routingTier) || new Set())}
              onViewFeature={setViewingFeatureId}
              onEditRoute={(id) => {
                setEditingRouteFor(id);
                const f = features.find(x => x.id === id);
                if (f) setRouteDraft({ route_path: f.route_path || '', menu_path: (f.menu_path || []).join(' > ') });
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <FeatureDetailDialog
        feature={features.find(f => f.id === viewingFeatureId) || null}
        open={!!viewingFeatureId}
        onClose={() => setViewingFeatureId('')}
        featureByKey={featureByKey}
        dependents={dependents}
        onJump={(key) => { setViewingFeatureId(''); openFeatureEditor(key); }}
        onView={(id) => setViewingFeatureId(id)}
      />
    </div>
  );
}

function FilterBar({ search, setSearch, modules, moduleFilter, setModuleFilter }: {
  search: string; setSearch: (s: string) => void;
  modules: string[]; moduleFilter: string; setModuleFilter: (s: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('feature_tiers.filter_search_placeholder')} className="pl-7 h-9" />
      </div>
      <Select value={moduleFilter} onValueChange={setModuleFilter}>
        <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder={t('feature_tiers.filter_module_placeholder')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('feature_tiers.filter_module_all')}</SelectItem>
          {modules.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FeatureGrid({ features, featureByKey, dependents, isOn, onToggle, pendingKey, pendingKeyPrefix }: {
  features: Feature[];
  featureByKey: Map<string, Feature>;
  dependents: Map<string, string[]>;
  isOn: (fid: string) => boolean;
  onToggle: (fid: string, on: boolean) => void;
  pendingKey: string;
  pendingKeyPrefix: string;
}) {
  const { t } = useI18n();
  if (features.length === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('feature_tiers.grid_no_results')}</CardContent></Card>;
  return (
    <div className="rounded-lg border divide-y max-h-[60vh] overflow-y-auto">
      {features.map(f => {
        const on = isOn(f.id);
        const busy = pendingKey === `${pendingKeyPrefix}${f.id}`;
        const deps = (f.dependencies || []).filter(Boolean);
        const dependsOn = deps.map(k => {
          const fk = featureByKey.get(k);
          return fk ? featureName(t, fk.feature_key, fk.name) : k;
        });
        const dependents4 = dependents.get(f.feature_key) || [];
        return (
          <div key={f.id} className="flex items-start gap-3 p-3 hover:bg-muted/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{featureName(t, f.feature_key, f.name)}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{f.feature_key}</Badge>
                {f.module && <Badge variant="secondary" className="text-[10px]">{f.module}</Badge>}
                {f.status && f.status !== 'public' && <Badge className="text-[10px]">{f.status}</Badge>}
              </div>
              {featureDescription(t, f.feature_key, f.description) && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{featureDescription(t, f.feature_key, f.description)}</p>}
              <div className="mt-1.5 space-y-0.5">
                <div className="flex items-start gap-1 text-[11px]">
                  <GitBranch className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground shrink-0">{t('feature_tiers.grid_label_prerequisites')}</span>
                  {dependsOn.length === 0
                    ? <span className="italic text-muted-foreground">{t('feature_tiers.grid_label_none')}</span>
                    : <span className="flex flex-wrap gap-1">{dependsOn.map(d => <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>)}</span>}
                </div>
                {dependents4.length > 0 && (
                  <div className="flex items-start gap-1 text-[11px]">
                    <ChevronRight className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">{t('feature_tiers.grid_label_dependents')}</span>
                    <span className="flex flex-wrap gap-1">{dependents4.slice(0, 6).map(d => { const fk = featureByKey.get(d); return <Badge key={d} variant="secondary" className="text-[10px]">{fk ? featureName(t, fk.feature_key, fk.name) : d}</Badge>; })}{dependents4.length > 6 && <span className="text-[10px] text-muted-foreground">+{dependents4.length - 6}</span>}</span>
                  </div>
                )}
                {(f.route_path || (f.menu_path && f.menu_path.length > 0)) && (
                  <div className="flex items-start gap-1 text-[11px]">
                    <Network className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">{t('feature_tiers.grid_label_route')}</span>
                    <span className="flex flex-wrap items-center gap-1">
                      {f.route_path && <Badge variant="outline" className="text-[10px] font-mono">{f.route_path}</Badge>}
                      {(f.menu_path || []).map((m, i) => <span key={i} className="text-[10px] text-muted-foreground">{i > 0 && '› '}{m}</span>)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Switch checked={on} disabled={busy} onCheckedChange={(v) => onToggle(f.id, v)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoutingAuditBanner({ features, onJump }: { features: Feature[]; onJump: (key: string) => void }) {
  const { t } = useI18n();
  // Categorized consistency checks
  const missingRoute = features.filter(f => !f.route_path || !f.route_path.trim());
  const missingMenu = features.filter(f => !f.menu_path || f.menu_path.length === 0);
  // Invalid format: route must start with "/" and contain only safe URL chars
  const invalidRoute = features.filter(f => f.route_path && f.route_path.trim() && !/^\/[A-Za-z0-9/_\-:$.{}-]*$/.test(f.route_path.trim()));
  // Empty / whitespace menu segments
  const invalidMenu = features.filter(f => (f.menu_path || []).some(seg => !seg || !seg.trim()));
  // Empty core fields
  const emptyName = features.filter(f => !f.name || !f.name.trim());
  // Duplicate route_path + menu_path combos
  const seen = new Map<string, Feature[]>();
  features.forEach(f => {
    if (!f.route_path || !f.route_path.trim()) return;
    const key = `${f.route_path.trim()}::${(f.menu_path || []).join(' > ')}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(f);
  });
  const duplicates = Array.from(seen.entries()).filter(([, list]) => list.length > 1);

  const totalIssues = missingRoute.length + missingMenu.length + invalidRoute.length + invalidMenu.length + emptyName.length + duplicates.length;

  if (totalIssues === 0) {
    return (
      <Alert className="border-emerald-500/40 bg-emerald-500/5">
        <Network className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-sm">{t('feature_tiers.audit_consistent_title')}</AlertTitle>
        <AlertDescription className="text-xs">
          {t('feature_tiers.audit_consistent_desc')}
        </AlertDescription>
      </Alert>
    );
  }

  const Section = ({ title, icon, items, color }: { title: string; icon: React.ReactNode; items: Feature[]; color: string }) => (
    items.length === 0 ? null : (
      <div className={`rounded border p-2 ${color}`}>
        <div className="flex items-center gap-1.5 text-xs font-medium mb-1">{icon}<span>{title}</span><Badge variant="outline" className="text-[10px] ml-1">{items.length}</Badge></div>
        <div className="flex flex-wrap gap-1">
          {items.slice(0, 24).map(f => (
            <button key={f.id} type="button" onClick={() => onJump(f.feature_key)} className="text-[10px] font-mono px-1.5 py-0.5 rounded border hover:bg-background hover:underline">
              {f.feature_key}
            </button>
          ))}
          {items.length > 24 && <span className="text-[10px] text-muted-foreground">+{items.length - 24}</span>}
        </div>
      </div>
    )
  );

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm">{t('feature_tiers.audit_title', { count: totalIssues })}</AlertTitle>
      <AlertDescription className="text-xs space-y-2 mt-2">
        <Section title={t('feature_tiers.audit_section_missing_route')} icon={<Link2 className="h-3 w-3" />} items={missingRoute} color="border-destructive/40 bg-destructive/5" />
        <Section title={t('feature_tiers.audit_section_missing_menu')} icon={<Network className="h-3 w-3" />} items={missingMenu} color="border-destructive/40 bg-destructive/5" />
        <Section title={t('feature_tiers.audit_section_invalid_route')} icon={<AlertCircle className="h-3 w-3" />} items={invalidRoute} color="border-amber-500/40 bg-amber-500/5" />
        <Section title={t('feature_tiers.audit_section_invalid_menu')} icon={<AlertCircle className="h-3 w-3" />} items={invalidMenu} color="border-amber-500/40 bg-amber-500/5" />
        <Section title={t('feature_tiers.audit_section_missing_name')} icon={<AlertCircle className="h-3 w-3" />} items={emptyName} color="border-destructive/40 bg-destructive/5" />
        {duplicates.length > 0 && (
          <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-1"><CopyIcon className="h-3 w-3" /><span>{t('feature_tiers.audit_section_duplicates')}</span><Badge variant="outline" className="text-[10px] ml-1">{duplicates.length}</Badge></div>
            <div className="space-y-1">
              {duplicates.slice(0, 10).map(([key, list]) => (
                <div key={key} className="flex flex-wrap items-center gap-1">
                  <code className="text-[10px]">{key}</code>
                  <span className="text-[10px] text-muted-foreground">→</span>
                  {list.map(f => (
                    <button key={f.id} type="button" onClick={() => onJump(f.feature_key)} className="text-[10px] font-mono px-1.5 py-0.5 rounded border hover:bg-background hover:underline">
                      {f.feature_key}
                    </button>
                  ))}
                </div>
              ))}
              {duplicates.length > 10 && <div className="text-[10px] text-muted-foreground">{t('feature_tiers.audit_more', { count: duplicates.length - 10 })}</div>}
            </div>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

function RoutingTree({
  features, tierFilterIds, featureByKey, editingRouteFor, setEditingRouteFor,
  routeDraft, setRouteDraft, saveRoute, persistOrder, openPaths, toggleOpenPath,
  expandSubtree, onOpenDepEditor, onViewFeature,
}: {
  features: Feature[];
  tierFilterIds: Set<string> | null;
  featureByKey: Map<string, Feature>;
  editingRouteFor: string;
  setEditingRouteFor: (id: string) => void;
  routeDraft: { route_path: string; menu_path: string };
  setRouteDraft: (d: { route_path: string; menu_path: string }) => void;
  saveRoute: (id: string) => void;
  persistOrder: (orderedIds: string[]) => void | Promise<void>;
  openPaths: Record<string, boolean>;
  toggleOpenPath: (path: string, isOpen: boolean) => void;
  expandSubtree: (paths: string[]) => void;
  onOpenDepEditor: (featureKey: string) => void;
  onViewFeature: (id: string) => void;
}) {
  const { t } = useI18n();
  const NO_ROUTE_KEY = '__no_route__';
  // Tier-aware visibility: hide features not in tier; flag missing deps
  const visible = tierFilterIds
    ? features.filter(f => tierFilterIds.has(f.id))
    : features;

  const missingDepsFor = (f: Feature): string[] => {
    if (!tierFilterIds) return [];
    return (f.dependencies || []).filter(depKey => {
      const dep = featureByKey.get(depKey);
      return !dep || !tierFilterIds.has(dep.id);
    });
  };

  // Build tree: page (route_path) -> menu segments -> features (sorted by sort_order)
  type Node = { label: string; children: Map<string, Node>; features: Feature[] };
  const root: Node = { label: 'root', children: new Map(), features: [] };
  [...visible]
    .sort((a, b) => (a.sort_order - b.sort_order) || a.feature_key.localeCompare(b.feature_key))
    .forEach(f => {
      const page = f.route_path || NO_ROUTE_KEY;
      if (!root.children.has(page)) root.children.set(page, { label: page, children: new Map(), features: [] });
      const pageNode = root.children.get(page)!;
      const menu = f.menu_path || [];
      let cur = pageNode;
      menu.forEach(seg => {
        if (!cur.children.has(seg)) cur.children.set(seg, { label: seg, children: new Map(), features: [] });
        cur = cur.children.get(seg)!;
      });
      cur.features.push(f);
    });

  const renderEditor = (f: Feature) => (
    <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
      <div>
        <label className="text-[11px] text-muted-foreground">{t('feature_tiers.route_editor_label')} <code>/app/calendar</code></label>
        <Input value={routeDraft.route_path} onChange={e => setRouteDraft({ ...routeDraft, route_path: e.target.value })} className="h-8 text-xs" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">{t('feature_tiers.route_editor_menu_label')} <code>Beállítások &gt; Csapat &gt; Tagok</code></label>
        <Input value={routeDraft.menu_path} onChange={e => setRouteDraft({ ...routeDraft, menu_path: e.target.value })} className="h-8 text-xs" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => saveRoute(f.id)}>{t('feature_tiers.route_editor_save')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditingRouteFor('')}>{t('feature_tiers.route_editor_cancel')}</Button>
      </div>
    </div>
  );

  // Drag-and-drop state per leaf list — simple in-component with refs by id
  const onDragStart = (e: React.DragEvent, fid: string) => {
    e.dataTransfer.setData('text/feature-id', fid);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDrop = (e: React.DragEvent, list: Feature[], targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/feature-id');
    if (!draggedId || draggedId === targetId) return;
    const ids = list.map(x => x.id);
    if (!ids.includes(draggedId) || !ids.includes(targetId)) return; // only reorder within same leaf
    const without = ids.filter(id => id !== draggedId);
    const insertAt = without.indexOf(targetId);
    without.splice(insertAt, 0, draggedId);
    void persistOrder(without);
  };

  // Recursively collect every path in this node's subtree (including self),
  // mirroring the same prefix scheme renderNode uses, so that one click on the
  // count badge can mark the whole branch open in a single setOpenPaths batch.
  const collectSubtreePaths = (n: Node, p: string): string[] => {
    const out: string[] = [p];
    n.children.forEach((c) => {
      const cp = `${p}|menu::${c.label}`;
      out.push(...collectSubtreePaths(c, cp));
    });
    return out;
  };

  const renderNode = (node: Node, depth: number, path: string): React.ReactNode => {
    const total = countFeatures(node);
    const hasChildren = node.children.size > 0;
    return (
      <Collapsible
        open={openPaths[path] ?? (depth < 1)}
        onOpenChange={(o) => toggleOpenPath(path, o)}
      >
        <CollapsibleTrigger className="flex items-center gap-1.5 w-full hover:bg-muted/40 px-2 py-1 rounded text-left">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform data-[state=closed]:-rotate-90" />
          <span className={depth === 0 ? 'font-medium font-mono text-sm' : 'text-sm'}>{node.label === NO_ROUTE_KEY ? t('feature_tiers.tree_no_route_label') : node.label}</span>
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                expandSubtree(collectSubtreePaths(node, path));
              }}
              title={t('feature_tiers.tree_expand_all_under')}
              className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-input bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            >
              {total}
            </button>
          ) : (
            <Badge variant="outline" className="text-[10px] ml-auto">{total}</Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-4 border-l pl-2 mt-1 space-y-1">
          {Array.from(node.children.values()).map(c => {
            // Children of a page or menu node are always menu segments.
            // Prefix-tagged so the open-state key is invariant under
            // feature re-ordering or new branches appearing/disappearing.
            const childPath = `${path}|menu::${c.label}`;
            return <div key={childPath}>{renderNode(c, depth + 1, childPath)}</div>;
          })}
          {node.features.map(f => {
            const missing = missingDepsFor(f);
            const noRoute = !f.route_path || !f.route_path.trim();
            const noMenu = !f.menu_path || f.menu_path.length === 0;
            return (
              <div
                key={f.id}
                id={`feature-row-${f.id}`}
                draggable
                onDragStart={(e) => onDragStart(e, f.id)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, node.features, f.id)}
                className={`px-2 py-1.5 rounded hover:bg-muted/40 border ${editingRouteFor === f.id ? 'border-primary/50 bg-primary/5' : 'border-transparent hover:border-border'}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                  <span className="text-sm font-medium">{featureName(t, f.feature_key, f.name)}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{f.feature_key}</Badge>
                  {f.module && <Badge variant="secondary" className="text-[10px]">{f.module}</Badge>}
                  {noRoute && <Badge variant="destructive" className="text-[10px]">{t('feature_tiers.tree_no_route_badge')}</Badge>}
                  {noMenu && <Badge variant="destructive" className="text-[10px]">{t('feature_tiers.tree_no_menu_badge')}</Badge>}
                  <Button size="sm" variant="ghost" className="ml-auto h-6 px-2" title={t('feature_tiers.tree_view_btn')} onClick={() => onViewFeature(f.id)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2" title={t('feature_tiers.tree_edit_btn')} onClick={() => setEditingRouteFor(editingRouteFor === f.id ? '' : f.id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                {missing.length > 0 && (
                  <div className="mt-1 flex items-start gap-1 text-[11px] text-destructive">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{t('feature_tiers.tree_missing_prereq')}</span>
                    <span className="flex flex-wrap gap-1">
                      {missing.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onOpenDepEditor(m)}
                          title={t('feature_tiers.tree_jump_to', { key: m })}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 hover:underline"
                        >
                          {m}
                        </button>
                      ))}
                    </span>
                  </div>
                )}
                {editingRouteFor === f.id && renderEditor(f)}
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  if (root.children.size === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('feature_tiers.tree_empty')}</CardContent></Card>;

  return (
    <div className="rounded-lg border p-3 max-h-[65vh] overflow-y-auto space-y-1">
      {Array.from(root.children.values()).map(c => {
        const pagePath = `page::${c.label}`;
        return <div key={pagePath}>{renderNode(c, 0, pagePath)}</div>;
      })}
    </div>
  );
}

function countFeatures(node: { children: Map<string, { features: Feature[] } & object>; features: Feature[] }): number {
  let n = node.features.length;
  // @ts-expect-error recursive structural traversal
  for (const c of node.children.values()) n += countFeatures(c);
  return n;
}

// Flat-path view: one line per feature with the full hierarchy concatenated
// as `/<route>/<menu1>/<menu2>/<feature_name>`. Useful when an operator wants
// a single-glance feature inventory ordered by app location.
function RoutingFlatList({
  features, tierFilterIds, onViewFeature, onEditRoute,
}: {
  features: Feature[];
  tierFilterIds: Set<string> | null;
  onViewFeature: (id: string) => void;
  onEditRoute: (id: string) => void;
}) {
  const { t } = useI18n();
  const visible = tierFilterIds ? features.filter(f => tierFilterIds.has(f.id)) : features;
  const sorted = [...visible].sort((a, b) => {
    const ra = a.route_path || '';
    const rb = b.route_path || '';
    if (ra !== rb) return ra.localeCompare(rb);
    const ma = (a.menu_path || []).join('/');
    const mb = (b.menu_path || []).join('/');
    if (ma !== mb) return ma.localeCompare(mb);
    return (a.sort_order - b.sort_order) || a.feature_key.localeCompare(b.feature_key);
  });

  if (sorted.length === 0) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('feature_tiers.tree_empty')}</CardContent></Card>;
  }

  return (
    <div className="rounded-lg border max-h-[65vh] overflow-y-auto">
      <ul className="divide-y">
        {sorted.map((f) => {
          const route = f.route_path || t('feature_tiers.tree_no_route_label');
          const menu = (f.menu_path || []).join(' / ');
          const displayName = featureName(t, f.feature_key, f.name);
          const fullPath = menu
            ? `${route} / ${menu} / ${displayName}`
            : `${route} / ${displayName}`;
          return (
            <li key={f.id} className="px-3 py-1.5 hover:bg-muted/40 flex items-center gap-2 text-xs font-mono">
              <span className="flex-1 truncate" title={fullPath}>{fullPath}</span>
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">{f.feature_key}</Badge>
              {f.module && <Badge variant="secondary" className="text-[10px] shrink-0">{f.module}</Badge>}
              <Button size="sm" variant="ghost" className="h-6 px-2 shrink-0" title={t('feature_tiers.tree_view_btn')} onClick={() => onViewFeature(f.id)}>
                <Eye className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 shrink-0" title={t('feature_tiers.tree_edit_btn')} onClick={() => onEditRoute(f.id)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Card palette inspired by the user-provided infographic — bold gradient cards.
const CARD_PALETTE = [
  'from-emerald-500 to-teal-500',
  'from-cyan-500 to-blue-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-purple-500',
  'from-indigo-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-emerald-600',
];
function paletteFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CARD_PALETTE[h % CARD_PALETTE.length];
}

function FeatureNodeCard({ feature, onView, size = 'md' }: { feature: Feature; onView?: (id: string) => void; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useI18n();
  const grad = paletteFor(feature.feature_key);
  const dims = size === 'lg' ? 'min-w-[220px] p-3' : size === 'sm' ? 'min-w-[150px] p-2' : 'min-w-[180px] p-2.5';
  return (
    <button
      type="button"
      onClick={() => onView?.(feature.id)}
      className={`group rounded-lg shadow-md text-left text-white bg-gradient-to-br ${grad} ${dims} hover:shadow-lg hover:scale-[1.02] transition-all`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider opacity-90">{feature.module || 'feature'}</span>
        <span className="h-5 w-5 rounded-full bg-white/25 flex items-center justify-center text-[10px]">●</span>
      </div>
      <div className={`font-semibold ${size === 'sm' ? 'text-xs' : 'text-sm'} leading-tight mt-0.5`}>{featureName(t, feature.feature_key, feature.name)}</div>
      <div className="text-[10px] font-mono opacity-80 truncate">{feature.feature_key}</div>
      {feature.route_path && size !== 'sm' && (
        <div className="mt-1 text-[10px] bg-black/20 rounded px-1.5 py-0.5 font-mono truncate">{feature.route_path}</div>
      )}
    </button>
  );
}

function FeatureDetailDialog({
  feature, open, onClose, featureByKey, dependents, onJump, onView,
}: {
  feature: Feature | null;
  open: boolean;
  onClose: () => void;
  featureByKey: Map<string, Feature>;
  dependents: Map<string, string[]>;
  onJump: (key: string) => void;
  onView: (id: string) => void;
}) {
  const { t } = useI18n();
  const [showDown, setShowDown] = useState(false);
  useEffect(() => { if (!open) setShowDown(false); }, [open]);

  if (!feature) return null;

  // Upward branch: ancestors via dependencies (recursive)
  const upward: Feature[][] = [];
  let layer: Feature[] = (feature.dependencies || []).map(k => featureByKey.get(k)).filter(Boolean) as Feature[];
  const seenUp = new Set<string>();
  while (layer.length && upward.length < 5) {
    const fresh = layer.filter(f => { if (seenUp.has(f.id)) return false; seenUp.add(f.id); return true; });
    if (!fresh.length) break;
    upward.push(fresh);
    layer = fresh.flatMap(f => (f.dependencies || []).map(k => featureByKey.get(k)).filter(Boolean) as Feature[]);
  }
  // Downward branch: dependents recursive
  const downward: Feature[][] = [];
  let dlayer: Feature[] = (dependents.get(feature.feature_key) || []).map(k => featureByKey.get(k)).filter(Boolean) as Feature[];
  const seenDown = new Set<string>();
  while (dlayer.length && downward.length < 5) {
    const fresh = dlayer.filter(f => { if (seenDown.has(f.id)) return false; seenDown.add(f.id); return true; });
    if (!fresh.length) break;
    downward.push(fresh);
    dlayer = fresh.flatMap(f => (dependents.get(f.feature_key) || []).map(k => featureByKey.get(k)).filter(Boolean) as Feature[]);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {featureName(t, feature.feature_key, feature.name)}
            <Badge variant="outline" className="font-mono text-[11px]">{feature.feature_key}</Badge>
            {feature.module && <Badge variant="secondary" className="text-[11px]">{feature.module}</Badge>}
          </DialogTitle>
          {featureDescription(t, feature.feature_key, feature.description) && <DialogDescription>{featureDescription(t, feature.feature_key, feature.description)}</DialogDescription>}
        </DialogHeader>

        {/* Routing data sheet */}
        <div className="grid gap-2 md:grid-cols-2 text-xs">
          <div className="rounded border p-2">
            <div className="text-muted-foreground mb-1">{t('feature_tiers.detail_route_path')}</div>
            <code className="font-mono">{feature.route_path || <span className="italic text-muted-foreground">{t('feature_tiers.detail_not_specified')}</span>}</code>
          </div>
          <div className="rounded border p-2">
            <div className="text-muted-foreground mb-1">{t('feature_tiers.detail_menu_path')}</div>
            <span className="font-mono">{(feature.menu_path && feature.menu_path.length) ? feature.menu_path.join(' › ') : <span className="italic text-muted-foreground">{t('feature_tiers.detail_not_specified')}</span>}</span>
          </div>
          <div className="rounded border p-2">
            <div className="text-muted-foreground mb-1">{t('feature_tiers.detail_status')}</div>
            <Badge variant="outline">{feature.status || 'public'}</Badge>
          </div>
          <div className="rounded border p-2">
            <div className="text-muted-foreground mb-1">{t('feature_tiers.detail_weight')}</div>
            <span>fiscal_weight: <strong>—</strong> · sort_order: <strong>{feature.sort_order}</strong></span>
          </div>
        </div>

        {/* Visualization */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Network className="h-4 w-4" />{t('feature_tiers.detail_tree_title')}</h3>
            <Button size="sm" variant={showDown ? 'default' : 'outline'} onClick={() => setShowDown(s => !s)} className="gap-1">
              <ArrowDownToLine className="h-3.5 w-3.5" />
              {showDown ? t('feature_tiers.detail_hide_descendants') : t('feature_tiers.detail_show_descendants')}
            </Button>
          </div>

          <div className="rounded-xl bg-slate-950 dark:bg-slate-900 p-4 overflow-x-auto">
            <div className="flex items-center gap-6 min-w-max">
              {/* Upward (ancestors) — leftmost = deepest */}
              {upward.slice().reverse().map((lyr, i) => (
                <div key={`up-${i}`} className="flex flex-col gap-2 items-end">
                  <div className="text-[10px] uppercase tracking-wider text-white/50">{t('feature_tiers.detail_ancestor_layer', { depth: upward.length - i })}</div>
                  {lyr.map(f => <FeatureNodeCard key={f.id} feature={f} onView={onView} size="sm" />)}
                </div>
              ))}

              {/* Connector arrow to focus */}
              {upward.length > 0 && <ChevronRight className="h-6 w-6 text-white/40 shrink-0" />}

              {/* Focused feature — large central card */}
              <div className="flex flex-col gap-2 items-center">
                <div className="text-[10px] uppercase tracking-wider text-white/70">{t('feature_tiers.detail_focus_layer')}</div>
                <FeatureNodeCard feature={feature} size="lg" />
              </div>

              {/* Downward (dependents) — only on toggle */}
              {showDown && downward.length > 0 && (
                <>
                  <ChevronRight className="h-6 w-6 text-white/40 shrink-0" />
                  {downward.map((lyr, i) => (
                    <div key={`down-${i}`} className="flex flex-col gap-2 items-start">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">{t('feature_tiers.detail_descendant_layer', { depth: i + 1 })}</div>
                      {lyr.map(f => <FeatureNodeCard key={f.id} feature={f} onView={onView} size="sm" />)}
                    </div>
                  ))}
                </>
              )}

              {upward.length === 0 && !showDown && (
                <div className="text-xs text-white/50 ml-4">{t('feature_tiers.detail_no_prereq_hint')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Dependency lists */}
        <div className="grid gap-3 md:grid-cols-2 mt-2">
          <div>
            <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><GitBranch className="h-3.5 w-3.5" />{t('feature_tiers.detail_direct_prereqs')}</h4>
            <div className="flex flex-wrap gap-1">
              {(feature.dependencies || []).length === 0
                ? <span className="text-xs italic text-muted-foreground">{t('feature_tiers.detail_empty')}</span>
                : (feature.dependencies || []).map(k => { const fk = featureByKey.get(k); return (
                  <button key={k} type="button" onClick={() => onJump(k)} className="text-[11px] font-mono px-2 py-0.5 rounded border hover:bg-muted">
                    {fk ? featureName(t, fk.feature_key, fk.name) : k}
                  </button>
                ); })}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold mb-1 flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5" />{t('feature_tiers.detail_dependents')}</h4>
            <div className="flex flex-wrap gap-1">
              {(dependents.get(feature.feature_key) || []).length === 0
                ? <span className="text-xs italic text-muted-foreground">{t('feature_tiers.detail_empty')}</span>
                : (dependents.get(feature.feature_key) || []).map(k => { const fk = featureByKey.get(k); return (
                  <button key={k} type="button" onClick={() => onJump(k)} className="text-[11px] font-mono px-2 py-0.5 rounded border hover:bg-muted">
                    {fk ? featureName(t, fk.feature_key, fk.name) : k}
                  </button>
                ); })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FeatureTiersTab;
