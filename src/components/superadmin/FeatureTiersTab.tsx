import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Loader2, Layers, Puzzle, Search, GitBranch, Network, ChevronRight, ChevronDown, Pencil,
  AlertTriangle, GripVertical,
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

  const load = async () => {
    setLoading(true);
    const [tRes, aRes, fRes, tfRes, afRes] = await Promise.all([
      supabase.from('tiers').select('id, tier_key, name, sort_order').order('sort_order'),
      supabase.from('addons').select('id, addon_key, name').order('addon_key'),
      supabase.from('features').select('id, feature_key, name, module, description, status, dependencies, route_path, menu_path').order('module').order('feature_key'),
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
          <FilterBar search={search} setSearch={setSearch} modules={modules} moduleFilter={moduleFilter} setModuleFilter={setModuleFilter} />
          <RoutingTree
            features={filtered}
            editingRouteFor={editingRouteFor}
            setEditingRouteFor={(id) => {
              setEditingRouteFor(id);
              const f = features.find(x => x.id === id);
              if (f) setRouteDraft({ route_path: f.route_path || '', menu_path: (f.menu_path || []).join(' > ') });
            }}
            routeDraft={routeDraft}
            setRouteDraft={setRouteDraft}
            saveRoute={saveRoute}
          />
        </TabsContent>
      </Tabs>
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

function RoutingTree({ features, editingRouteFor, setEditingRouteFor, routeDraft, setRouteDraft, saveRoute }: {
  features: Feature[];
  editingRouteFor: string;
  setEditingRouteFor: (id: string) => void;
  routeDraft: { route_path: string; menu_path: string };
  setRouteDraft: (d: { route_path: string; menu_path: string }) => void;
  saveRoute: (id: string) => void;
}) {
  // Build tree: page (route_path or '(nincs útvonal)') -> menu levels -> features
  type Node = { label: string; children: Map<string, Node>; features: Feature[] };
  const root: Node = { label: 'root', children: new Map(), features: [] };
  features.forEach(f => {
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

  const renderNode = (node: Node, depth: number, path: string): React.ReactNode => {
    const total = countFeatures(node);
    return (
      <Collapsible defaultOpen={depth < 1}>
        <CollapsibleTrigger className="flex items-center gap-1.5 w-full hover:bg-muted/40 px-2 py-1 rounded text-left">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform data-[state=closed]:-rotate-90" />
          <span className={depth === 0 ? 'font-medium font-mono text-sm' : 'text-sm'}>{node.label}</span>
          <Badge variant="outline" className="text-[10px] ml-auto">{total}</Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-4 border-l pl-2 mt-1 space-y-1">
          {Array.from(node.children.values()).map(c => (
            <div key={`${path}/${c.label}`}>{renderNode(c, depth + 1, `${path}/${c.label}`)}</div>
          ))}
          {node.features.map(f => (
            <div key={f.id} className="px-2 py-1.5 rounded hover:bg-muted/40">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{f.name}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{f.feature_key}</Badge>
                {f.module && <Badge variant="secondary" className="text-[10px]">{f.module}</Badge>}
                <Button size="sm" variant="ghost" className="ml-auto h-6 px-2" onClick={() => setEditingRouteFor(editingRouteFor === f.id ? '' : f.id)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
              {editingRouteFor === f.id && renderEditor(f)}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  if (root.children.size === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nincs találat.</CardContent></Card>;

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
