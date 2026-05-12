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
  const openStorageKey = `routingTreeOpen:${user?.id || 'anon'}:${routingTier}`;
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

  const toggleTier = async (tierId: string, featureId: string, enabled: boolean) => {
    const key = `t-${tierId}-${featureId}`;
    setPendingKey(key);
    if (enabled) {
      const { error } = await supabase.from('tier_features').insert({ tier_id: tierId, feature_id: featureId });
      if (error) toast.error(error.message); else { setTf(prev => [...prev, { tier_id: tierId, feature_id: featureId }]); }
    } else {
      const { error } = await supabase.from('tier_features').delete().eq('tier_id', tierId).eq('feature_id', featureId);
      if (error) toast.error(error.message); else { setTf(prev => prev.filter(r => !(r.tier_id === tierId && r.feature_id === featureId))); }
    }
    setPendingKey('');
  };

  const toggleAddon = async (addonId: string, featureId: string, enabled: boolean) => {
    const key = `a-${addonId}-${featureId}`;
    setPendingKey(key);
    if (enabled) {
      const { error } = await supabase.from('addon_features').insert({ addon_id: addonId, feature_id: featureId });
      if (error) toast.error(error.message); else { setAf(prev => [...prev, { addon_id: addonId, feature_id: featureId }]); }
    } else {
      const { error } = await supabase.from('addon_features').delete().eq('addon_id', addonId).eq('feature_id', featureId);
      if (error) toast.error(error.message); else { setAf(prev => prev.filter(r => !(r.addon_id === addonId && r.feature_id === featureId))); }
    }
    setPendingKey('');
  };

  const saveRoute = async (featureId: string) => {
    const menu = routeDraft.menu_path.split('>').map(x => x.trim()).filter(Boolean);
    const { error } = await supabase.from('features').update({
      route_path: routeDraft.route_path.trim() || null,
      menu_path: menu,
    }).eq('id', featureId);
    if (error) { toast.error(error.message); return; }
    setFeatures(prev => prev.map(f => f.id === featureId ? { ...f, route_path: routeDraft.route_path.trim() || null, menu_path: menu } : f));
    setEditingRouteFor('');
    toast.success('Mentve');
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
    toast.success('Sorrend mentve');
  };

  // Jump to a feature's editor (used by missing-prereq badges).
  // Expands the ancestor chain in the tree and scrolls the row into view.
  const openFeatureEditor = useCallback((featureKey: string) => {
    const f = features.find(x => x.feature_key === featureKey);
    if (!f) { toast.error(`A "${featureKey}" feature nem található`); return; }
    const page = f.route_path || '(nincs útvonal megadva)';
    const segs = [page, ...(f.menu_path || [])];
    let acc = '';
    const next: Record<string, boolean> = { ...openPaths };
    for (const seg of segs) { acc = acc ? `${acc}/${seg}` : seg; next[acc] = true; }
    setOpenPaths(next);
    try { localStorage.setItem(openStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
    setEditingRouteFor(f.id);
    setRouteDraft({ route_path: f.route_path || '', menu_path: (f.menu_path || []).join(' > ') });
    setMode('routing');
    setTimeout(() => {
      document.getElementById(`feature-row-${f.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }, [features, openPaths, openStorageKey]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  // Autocomplete suggestions
  const autoSuggest = (() => {
    const q = autoQ.trim().toLowerCase();
    if (!q) return [] as Array<{ kind: 'feature' | 'module' | 'route' | 'menu'; label: string; value: string; meta?: string }>;
    const items: Array<{ kind: 'feature' | 'module' | 'route' | 'menu'; label: string; value: string; meta?: string }> = [];
    features.forEach(f => {
      if (f.feature_key.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)) {
        items.push({ kind: 'feature', label: f.name, value: f.feature_key, meta: f.module || '' });
      }
      if (f.route_path && f.route_path.toLowerCase().includes(q)) {
        items.push({ kind: 'route', label: f.route_path, value: f.feature_key, meta: f.name });
      }
      (f.menu_path || []).forEach(m => {
        if (m.toLowerCase().includes(q)) items.push({ kind: 'menu', label: m, value: f.feature_key, meta: f.name });
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tiers</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{tiers.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Addons</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{addons.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Features</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{features.length}</CardContent></Card>
      </div>

      {/* Autocomplete free-text search (independent of filter bar) */}
      <Popover open={autoOpen} onOpenChange={setAutoOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground">
            <Search className="h-4 w-4" />
            Szabadszöveges keresés (oldal / menü / funkció / útvonal)…
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={autoQ} onValueChange={setAutoQ} placeholder="Kezdj el gépelni…" />
            <CommandList>
              <CommandEmpty>Nincs találat.</CommandEmpty>
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
          <TabsTrigger value="tiers" className="gap-1"><Layers className="h-4 w-4" /> Tiers</TabsTrigger>
          <TabsTrigger value="addons" className="gap-1"><Puzzle className="h-4 w-4" /> Addons</TabsTrigger>
          <TabsTrigger value="routing" className="gap-1"><Network className="h-4 w-4" /> Útvonal / Menü</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-3 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={activeTier} onValueChange={setActiveTier}>
              <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiers.map(t => (<SelectItem key={t.id} value={t.id}>{t.name} ({t.tier_key})</SelectItem>))}
              </SelectContent>
            </Select>
            {tiers.find(t => t.id === activeTier) && (
              <Badge variant="outline">
                {tierMap.get(activeTier)?.size || 0} / {features.length} feature
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
                {addons.map(a => (<SelectItem key={a.id} value={a.id}>{a.name} ({a.addon_key})</SelectItem>))}
              </SelectContent>
            </Select>
            {addons.find(a => a.id === activeAddon) && (
              <Badge variant="outline">{addonMap.get(activeAddon)?.size || 0} feature</Badge>
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
              <SelectTrigger className="w-[260px] h-9"><SelectValue placeholder="Tier szűrő" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes feature (tier-független)</SelectItem>
                {tiers.map(t => (<SelectItem key={t.id} value={t.id}>Csak: {t.name} ({t.tier_key})</SelectItem>))}
              </SelectContent>
            </Select>
            {routingTier !== 'all' && (
              <Badge variant="outline">{tierMap.get(routingTier)?.size || 0} feature ebben a tierben</Badge>
            )}
          </div>
          <RoutingAuditBanner features={filtered} onJump={openFeatureEditor} />
          <FilterBar search={search} setSearch={setSearch} modules={modules} moduleFilter={moduleFilter} setModuleFilter={setModuleFilter} />
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
            onOpenDepEditor={openFeatureEditor}
            onViewFeature={setViewingFeatureId}
          />
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szűrés feature kulcs / név / leírás…" className="pl-7 h-9" />
      </div>
      <Select value={moduleFilter} onValueChange={setModuleFilter}>
        <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Modul" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Összes modul</SelectItem>
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
  if (features.length === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nincs találat.</CardContent></Card>;
  return (
    <div className="rounded-lg border divide-y max-h-[60vh] overflow-y-auto">
      {features.map(f => {
        const on = isOn(f.id);
        const busy = pendingKey === `${pendingKeyPrefix}${f.id}`;
        const deps = (f.dependencies || []).filter(Boolean);
        const dependsOn = deps.map(k => featureByKey.get(k)?.name || k);
        const dependents4 = dependents.get(f.feature_key) || [];
        return (
          <div key={f.id} className="flex items-start gap-3 p-3 hover:bg-muted/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{f.name}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{f.feature_key}</Badge>
                {f.module && <Badge variant="secondary" className="text-[10px]">{f.module}</Badge>}
                {f.status && f.status !== 'public' && <Badge className="text-[10px]">{f.status}</Badge>}
              </div>
              {f.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.description}</p>}
              <div className="mt-1.5 space-y-0.5">
                <div className="flex items-start gap-1 text-[11px]">
                  <GitBranch className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground shrink-0">Előfeltétel:</span>
                  {dependsOn.length === 0
                    ? <span className="italic text-muted-foreground">nincs</span>
                    : <span className="flex flex-wrap gap-1">{dependsOn.map(d => <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>)}</span>}
                </div>
                {dependents4.length > 0 && (
                  <div className="flex items-start gap-1 text-[11px]">
                    <ChevronRight className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">Erre épül:</span>
                    <span className="flex flex-wrap gap-1">{dependents4.slice(0, 6).map(d => <Badge key={d} variant="secondary" className="text-[10px]">{featureByKey.get(d)?.name || d}</Badge>)}{dependents4.length > 6 && <span className="text-[10px] text-muted-foreground">+{dependents4.length - 6}</span>}</span>
                  </div>
                )}
                {(f.route_path || (f.menu_path && f.menu_path.length > 0)) && (
                  <div className="flex items-start gap-1 text-[11px]">
                    <Network className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">Útvonal:</span>
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
        <AlertTitle className="text-sm">Konzisztens routing</AlertTitle>
        <AlertDescription className="text-xs">
          Az aktuális szűrésben szereplő minden feature-höz tartozik route_path és menu_path, nincs duplikátum vagy érvénytelen elem.
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
      <AlertTitle className="text-sm">Routing audit — {totalIssues} hibakategória találat</AlertTitle>
      <AlertDescription className="text-xs space-y-2 mt-2">
        <Section title="Hiányzó route_path" icon={<Link2 className="h-3 w-3" />} items={missingRoute} color="border-destructive/40 bg-destructive/5" />
        <Section title="Hiányzó menu_path" icon={<Network className="h-3 w-3" />} items={missingMenu} color="border-destructive/40 bg-destructive/5" />
        <Section title="Érvénytelen route_path formátum" icon={<AlertCircle className="h-3 w-3" />} items={invalidRoute} color="border-amber-500/40 bg-amber-500/5" />
        <Section title="Üres / whitespace menü szegmens" icon={<AlertCircle className="h-3 w-3" />} items={invalidMenu} color="border-amber-500/40 bg-amber-500/5" />
        <Section title="Hiányzó név" icon={<AlertCircle className="h-3 w-3" />} items={emptyName} color="border-destructive/40 bg-destructive/5" />
        {duplicates.length > 0 && (
          <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-1"><CopyIcon className="h-3 w-3" /><span>Duplikált route_path + menu_path</span><Badge variant="outline" className="text-[10px] ml-1">{duplicates.length}</Badge></div>
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
              {duplicates.length > 10 && <div className="text-[10px] text-muted-foreground">+{duplicates.length - 10} további</div>}
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
  onOpenDepEditor, onViewFeature,
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
  onOpenDepEditor: (featureKey: string) => void;
  onViewFeature: (id: string) => void;
}) {
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
      const page = f.route_path || '(nincs útvonal megadva)';
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
        <label className="text-[11px] text-muted-foreground">Útvonal (route_path) — pl. <code>/app/calendar</code></label>
        <Input value={routeDraft.route_path} onChange={e => setRouteDraft({ ...routeDraft, route_path: e.target.value })} className="h-8 text-xs" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Menü útvonal (&gt; jellel) — pl. <code>Beállítások &gt; Csapat &gt; Tagok</code></label>
        <Input value={routeDraft.menu_path} onChange={e => setRouteDraft({ ...routeDraft, menu_path: e.target.value })} className="h-8 text-xs" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => saveRoute(f.id)}>Mentés</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditingRouteFor('')}>Mégse</Button>
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

  const renderNode = (node: Node, depth: number, path: string): React.ReactNode => {
    const total = countFeatures(node);
    return (
      <Collapsible
        open={openPaths[path] ?? (depth < 1)}
        onOpenChange={(o) => toggleOpenPath(path, o)}
      >
        <CollapsibleTrigger className="flex items-center gap-1.5 w-full hover:bg-muted/40 px-2 py-1 rounded text-left">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform data-[state=closed]:-rotate-90" />
          <span className={depth === 0 ? 'font-medium font-mono text-sm' : 'text-sm'}>{node.label}</span>
          <Badge variant="outline" className="text-[10px] ml-auto">{total}</Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-4 border-l pl-2 mt-1 space-y-1">
          {Array.from(node.children.values()).map(c => (
            <div key={`${path}/${c.label}`}>{renderNode(c, depth + 1, `${path}/${c.label}`)}</div>
          ))}
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
                  <span className="text-sm font-medium">{f.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{f.feature_key}</Badge>
                  {f.module && <Badge variant="secondary" className="text-[10px]">{f.module}</Badge>}
                  {noRoute && <Badge variant="destructive" className="text-[10px]">nincs route</Badge>}
                  {noMenu && <Badge variant="destructive" className="text-[10px]">nincs menü</Badge>}
                  <Button size="sm" variant="ghost" className="ml-auto h-6 px-2" title="Megnyitás" onClick={() => onViewFeature(f.id)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2" title="Szerkesztés" onClick={() => setEditingRouteFor(editingRouteFor === f.id ? '' : f.id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                {missing.length > 0 && (
                  <div className="mt-1 flex items-start gap-1 text-[11px] text-destructive">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>Hiányzó előfeltétel ebben a tierben:</span>
                    <span className="flex flex-wrap gap-1">
                      {missing.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onOpenDepEditor(m)}
                          title={`Ugrás: ${m} szerkesztése`}
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

  if (root.children.size === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nincs találat ebben a tierben.</CardContent></Card>;

  return (
    <div className="rounded-lg border p-3 max-h-[65vh] overflow-y-auto space-y-1">
      {Array.from(root.children.values()).map(c => (
        <div key={c.label}>{renderNode(c, 0, c.label)}</div>
      ))}
    </div>
  );
}

function countFeatures(node: { children: Map<string, { features: Feature[] } & object>; features: Feature[] }): number {
  let n = node.features.length;
  // @ts-expect-error recursive structural traversal
  for (const c of node.children.values()) n += countFeatures(c);
  return n;
}

export default FeatureTiersTab;
