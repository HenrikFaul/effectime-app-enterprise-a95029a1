import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Layers, Puzzle, Search } from 'lucide-react';

interface Tier { id: string; tier_key: string; name: string; description: string | null; price_per_seat: number | null; currency: string | null; sort_order: number; }
interface Addon { id: string; addon_key: string; name: string; description: string | null; price_per_seat: number | null; monthly_flat: number | null; currency: string | null; }
interface Feature { id: string; feature_key: string; name: string; module: string | null; description: string | null; status: string | null; }
interface TFRow { tier_id: string; feature_id: string; }
interface AFRow { addon_id: string; feature_id: string; }

export function FeatureTiersTab() {
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [tf, setTf] = useState<TFRow[]>([]);
  const [af, setAf] = useState<AFRow[]>([]);
  const [mode, setMode] = useState<'tiers' | 'addons'>('tiers');
  const [activeTier, setActiveTier] = useState<string>('');
  const [activeAddon, setActiveAddon] = useState<string>('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [pendingKey, setPendingKey] = useState<string>('');

  const load = async () => {
    setLoading(true);
    const [tRes, aRes, fRes, tfRes, afRes] = await Promise.all([
      supabase.from('tiers').select('*').order('sort_order'),
      supabase.from('addons').select('*').order('addon_key'),
      supabase.from('features').select('*').order('module').order('feature_key'),
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
      return f.feature_key.toLowerCase().includes(q) || f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q);
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
      if (error) toast.error(error.message); else { setTf(prev => [...prev, { tier_id: tierId, feature_id: featureId }]); toast.success('Hozzárendelve'); }
    } else {
      const { error } = await supabase.from('tier_features').delete().eq('tier_id', tierId).eq('feature_id', featureId);
      if (error) toast.error(error.message); else { setTf(prev => prev.filter(r => !(r.tier_id === tierId && r.feature_id === featureId))); toast.success('Eltávolítva'); }
    }
    setPendingKey('');
  };

  const toggleAddon = async (addonId: string, featureId: string, enabled: boolean) => {
    const key = `a-${addonId}-${featureId}`;
    setPendingKey(key);
    if (enabled) {
      const { error } = await supabase.from('addon_features').insert({ addon_id: addonId, feature_id: featureId });
      if (error) toast.error(error.message); else { setAf(prev => [...prev, { addon_id: addonId, feature_id: featureId }]); toast.success('Hozzárendelve'); }
    } else {
      const { error } = await supabase.from('addon_features').delete().eq('addon_id', addonId).eq('feature_id', featureId);
      if (error) toast.error(error.message); else { setAf(prev => prev.filter(r => !(r.addon_id === addonId && r.feature_id === featureId))); toast.success('Eltávolítva'); }
    }
    setPendingKey('');
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tiers</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{tiers.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Addons</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{addons.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Features</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{features.length}</CardContent></Card>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'tiers' | 'addons')}>
        <TabsList>
          <TabsTrigger value="tiers" className="gap-1"><Layers className="h-4 w-4" /> Tiers</TabsTrigger>
          <TabsTrigger value="addons" className="gap-1"><Puzzle className="h-4 w-4" /> Addons</TabsTrigger>
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
              <Badge variant="outline">
                {addonMap.get(activeAddon)?.size || 0} feature
              </Badge>
            )}
          </div>
          <FilterBar search={search} setSearch={setSearch} modules={modules} moduleFilter={moduleFilter} setModuleFilter={setModuleFilter} />
          <FeatureGrid
            features={filtered}
            isOn={(fid) => addonMap.get(activeAddon)?.has(fid) ?? false}
            onToggle={(fid, on) => toggleAddon(activeAddon, fid, on)}
            pendingKeyPrefix={`a-${activeAddon}-`}
            pendingKey={pendingKey}
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
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Keresés feature kulcs / név / leírás…" className="pl-7 h-9" />
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

function FeatureGrid({ features, isOn, onToggle, pendingKey, pendingKeyPrefix }: {
  features: Feature[];
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

export default FeatureTiersTab;
