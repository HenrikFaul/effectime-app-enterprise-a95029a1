import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ArrowLeft, Save, Play, Code, Wand2, BarChart3, LineChart as LineIcon, PieChart as PieIcon, Table2, Hash, Trophy, Grid3x3, Layers as LayersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { DATA_SOURCE_FIELDS, DATA_SOURCE_LABELS, type ReportDataSource, type ReportChartType, type ReportConfig, type ReportFilter, type SemanticDataset } from './reportTemplates';
import type { SavedReport } from './ReportLibrary';
import { SqlMode } from './SqlMode';
import { ReportRunner } from './ReportRunner';
import { DatasetBrowser } from './DatasetBrowser';
import { LivePreviewPane } from './LivePreviewPane';
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  workspaceId: string;
  userId: string;
  existing: SavedReport | null;
  onCancel: () => void;
  onSaved: () => void;
}

const CHART_OPTIONS: { value: ReportChartType; label: string; icon: typeof BarChart3 }[] = [
  { value: 'table', label: 'Táblázat', icon: Table2 },
  { value: 'bar', label: 'Oszlopdiagram', icon: BarChart3 },
  { value: 'stacked_bar', label: 'Halmozott oszlop', icon: LayersIcon },
  { value: 'line', label: 'Vonaldiagram', icon: LineIcon },
  { value: 'pie', label: 'Kördiagram', icon: PieIcon },
  { value: 'kpi', label: 'KPI szám', icon: Hash },
  { value: 'leaderboard', label: 'Toplista', icon: Trophy },
  { value: 'heatmap', label: 'Hőtérkép', icon: Grid3x3 },
];

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'like', label: 'tartalmaz' },
  { value: 'in', label: 'egyik közül' },
  { value: 'is_null', label: 'üres' },
  { value: 'not_null', label: 'nem üres' },
];

const AGG_FUNCTIONS = [
  { value: 'count', label: 'Darabszám' },
  { value: 'sum', label: 'Összeg' },
  { value: 'avg', label: 'Átlag' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

export function ReportBuilder({ workspaceId, userId, existing, onCancel, onSaved }: Props) {
  const [name, setName] = useState(existing?.name || 'Új riport');
  const [description, setDescription] = useState(existing?.description || '');
  const [dataSource, setDataSource] = useState<ReportDataSource>(existing?.data_source || 'memberships');
  const [chartType, setChartType] = useState<ReportChartType>(existing?.chart_type || 'table');
  const [isShared, setIsShared] = useState(existing?.is_shared ?? true);
  const [config, setConfig] = useState<ReportConfig>(existing?.config || {
    fields: [],
    filters: [],
    group_by: [],
    aggregations: [],
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mode, setMode] = useState<'visual' | 'sql'>('visual');
  const [sqlText, setSqlText] = useState('');
  const [selectedDataset, setSelectedDataset] = useState<SemanticDataset | null>(null);
  const isMobile = useIsMobile();

  const fields = DATA_SOURCE_FIELDS[dataSource];

  const applyTemplate = (tpl: { data_source: ReportDataSource; chart_type: ReportChartType; config: ReportConfig; name: string; description: string }) => {
    setDataSource(tpl.data_source);
    setChartType(tpl.chart_type);
    setConfig(tpl.config);
    if (!existing?.id) {
      setName(tpl.name + ' (másolat)');
      setDescription(tpl.description);
    }
    toast.success('Sablon betöltve');
  };

  const toggleField = (key: string) => {
    setConfig(c => ({
      ...c,
      fields: c.fields.includes(key) ? c.fields.filter(f => f !== key) : [...c.fields, key],
    }));
  };

  const toggleGroupBy = (key: string) => {
    setConfig(c => ({
      ...c,
      group_by: c.group_by.includes(key) ? c.group_by.filter(f => f !== key) : [...c.group_by, key],
    }));
  };

  const addFilter = () => setConfig(c => ({ ...c, filters: [...c.filters, { field: fields[0]?.key || '', operator: 'eq', value: '' }] }));
  const updateFilter = (i: number, patch: Partial<ReportFilter>) => {
    setConfig(c => ({ ...c, filters: c.filters.map((f, idx) => idx === i ? { ...f, ...patch } : f) }));
  };
  const removeFilter = (i: number) => setConfig(c => ({ ...c, filters: c.filters.filter((_, idx) => idx !== i) }));

  const addAggregation = () => setConfig(c => ({ ...c, aggregations: [...c.aggregations, { field: 'id', fn: 'count', alias: 'darab' }] }));
  const updateAggregation = (i: number, patch: Partial<ReportConfig['aggregations'][number]>) => {
    setConfig(c => ({ ...c, aggregations: c.aggregations.map((a, idx) => idx === i ? { ...a, ...patch } : a) }));
  };
  const removeAggregation = (i: number) => setConfig(c => ({ ...c, aggregations: c.aggregations.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Adj nevet a riportnak!'); return; }
    const payload = {
      workspace_id: workspaceId,
      created_by: userId,
      name: name.trim(),
      description: description.trim() || null,
      data_source: dataSource,
      config: mode === 'sql' ? { sql: sqlText } : config,
      chart_type: chartType,
      is_template: false,
      is_shared: isShared,
    };

    if (existing && existing.id) {
      const { error } = await (supabase as any).from('enterprise_reports').update(payload).eq('id', existing.id);
      if (error) { console.error(error); toast.error('Mentés sikertelen'); return; }
      toast.success('Riport frissítve');
    } else {
      const { error } = await (supabase as any).from('enterprise_reports').insert(payload);
      if (error) { console.error(error); toast.error('Mentés sikertelen'); return; }
      toast.success('Riport létrehozva');
    }
    onSaved();
  };

  if (previewOpen) {
    const previewReport: SavedReport = {
      id: existing?.id || 'preview',
      name,
      description,
      data_source: dataSource,
      config: mode === 'sql' ? ({ sql: sqlText } as any) : config,
      chart_type: chartType,
      is_template: false,
      is_shared: isShared,
      is_pinned: false,
      created_by: userId,
      workspace_id: workspaceId,
      created_at: '',
      updated_at: '',
    };
    return <ReportRunner report={previewReport} workspaceId={workspaceId} onBack={() => setPreviewOpen(false)} onEdit={() => setPreviewOpen(false)} />;
  }

  // Live preview snapshot for the right rail (desktop)
  const livePreviewReport: SavedReport = {
    id: existing?.id || 'live-preview',
    name,
    description,
    data_source: dataSource,
    config: mode === 'sql' ? ({ sql: sqlText } as any) : config,
    chart_type: chartType,
    is_template: false,
    is_shared: isShared,
    is_pinned: false,
    created_by: userId,
    workspace_id: workspaceId,
    created_at: '',
    updated_at: '',
  };

  const headerBar = (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Vissza
        </Button>
        <h3 className="text-base font-semibold">{existing && existing.id ? 'Riport szerkesztése' : 'Új riport'}</h3>
      </div>
      <div className="flex items-center gap-2">
        {isMobile && (
          <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Play className="h-3.5 w-3.5 mr-1" /> Előnézet
          </Button>
        )}
        <Button size="sm" onClick={handleSave}>
          <Save className="h-3.5 w-3.5 mr-1" /> Mentés
        </Button>
      </div>
    </div>
  );

  const configSection = (
    <div className="space-y-4">

      {/* Meta */}
      <Card>
        <CardContent className="pt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Riport neve</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Leírás (opcionális)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={isShared} onCheckedChange={setIsShared} id="shared" />
            <Label htmlFor="shared" className="text-xs cursor-pointer">Megosztva a munkaterület többi tagjával</Label>
          </div>
        </CardContent>
      </Card>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'visual' | 'sql')}>
        <TabsList>
          <TabsTrigger value="visual" className="gap-1"><Wand2 className="h-3.5 w-3.5" /> Vizuális szerkesztő</TabsTrigger>
          <TabsTrigger value="sql" className="gap-1"><Code className="h-3.5 w-3.5" /> SQL mód (haladó)</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-3 mt-3">
          {/* Data source + Chart type */}
          <Card>
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-sm">1. Adatforrás és vizualizáció</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Adatforrás</Label>
                <Select value={dataSource} onValueChange={(v) => { setDataSource(v as ReportDataSource); setConfig({ fields: [], filters: [], group_by: [], aggregations: [] }); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DATA_SOURCE_LABELS) as ReportDataSource[]).map(ds => (
                      <SelectItem key={ds} value={ds}>{DATA_SOURCE_LABELS[ds]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Vizualizáció típusa</Label>
                <Select value={chartType} onValueChange={(v) => setChartType(v as ReportChartType)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHART_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-sm">2. Megjelenítendő mezők</CardTitle>
              <CardDescription className="text-xs">Válaszd ki, milyen oszlopokat szeretnél látni.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {fields.map(f => (
                  <label key={f.key} className="flex items-center gap-1.5 text-xs cursor-pointer border rounded-md px-2 py-1 hover:bg-accent/30">
                    <Checkbox checked={config.fields.includes(f.key)} onCheckedChange={() => toggleField(f.key)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader className="py-3 pb-2 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">3. Szűrők</CardTitle>
                <CardDescription className="text-xs">Korlátozd az eredményeket adott feltételekre.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addFilter}><Plus className="h-3 w-3 mr-1" /> Szűrő</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {config.filters.length === 0 && <p className="text-xs text-muted-foreground italic">Nincs szűrő.</p>}
              {config.filters.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <Select value={f.field} onValueChange={(v) => updateFilter(i, { field: v })}>
                    <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fields.map(fld => <SelectItem key={fld.key} value={fld.key}>{fld.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={f.operator} onValueChange={(v) => updateFilter(i, { operator: v as ReportFilter['operator'] })}>
                    <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!['is_null', 'not_null'].includes(f.operator) && (
                    <Input
                      value={(f.value as string) || ''}
                      onChange={e => updateFilter(i, { value: e.target.value })}
                      placeholder="érték"
                      className="h-8 text-xs flex-1 min-w-[100px]"
                    />
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFilter(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Group by + Aggregations */}
          <Card>
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-sm">4. Csoportosítás és aggregáció</CardTitle>
              <CardDescription className="text-xs">Add meg, mely mezők szerint csoportosítsuk az adatokat és milyen összesítéseket számoljunk.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Csoportosítás</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {fields.map(f => (
                    <label key={f.key} className="flex items-center gap-1.5 text-xs cursor-pointer border rounded-md px-2 py-1 hover:bg-accent/30">
                      <Checkbox checked={config.group_by.includes(f.key)} onCheckedChange={() => toggleGroupBy(f.key)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Aggregációk</Label>
                  <Button size="sm" variant="outline" onClick={addAggregation}><Plus className="h-3 w-3 mr-1" /> Hozzáadás</Button>
                </div>
                {config.aggregations.length === 0 && <p className="text-xs text-muted-foreground italic">Nincs aggregáció.</p>}
                <div className="space-y-2">
                  {config.aggregations.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 flex-wrap">
                      <Select value={a.fn} onValueChange={(v) => updateAggregation(i, { fn: v as typeof a.fn })}>
                        <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AGG_FUNCTIONS.map(fn => <SelectItem key={fn.value} value={fn.value}>{fn.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={a.field} onValueChange={(v) => updateAggregation(i, { field: v })}>
                        <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="id">id (rekord)</SelectItem>
                          {fields.map(fld => <SelectItem key={fld.key} value={fld.key}>{fld.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        value={a.alias || ''}
                        onChange={e => updateAggregation(i, { alias: e.target.value })}
                        placeholder="megnevezés"
                        className="h-8 text-xs flex-1 min-w-[100px]"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeAggregation(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="pt-4 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{DATA_SOURCE_LABELS[dataSource]}</Badge>
                <Badge variant="outline">{config.fields.length} mező</Badge>
                <Badge variant="outline">{config.filters.length} szűrő</Badge>
                <Badge variant="outline">{config.group_by.length} csoport</Badge>
                <Badge variant="outline">{config.aggregations.length} aggregáció</Badge>
                <Badge variant="outline">{CHART_OPTIONS.find(c => c.value === chartType)?.label}</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sql" className="mt-3">
          <SqlMode value={sqlText} onChange={setSqlText} />
        </TabsContent>
      </Tabs>
    </div>
  );

  // Mobile: original single-column layout (no regression)
  if (isMobile) {
    return (
      <div className="space-y-4">
        {headerBar}
        {configSection}
      </div>
    );
  }

  // Desktop: stacked layout — top: dataset/template browser, middle: config editor, bottom: live preview
  return (
    <div className="space-y-3">
      {headerBar}

      {/* TOP: Dataset & template browser (horizontal) */}
      <section className="border rounded-lg p-3 bg-card/40">
        <DatasetBrowser
          selectedDataset={selectedDataset}
          onSelectDataset={setSelectedDataset}
          selectedDataSource={dataSource}
          onSelectDataSource={(ds) => { setDataSource(ds); setConfig({ fields: [], filters: [], group_by: [], aggregations: [] }); }}
          onUseTemplate={applyTemplate}
          layout="horizontal"
        />
      </section>

      {/* MIDDLE: Editor */}
      <section>
        {configSection}
      </section>

      {/* BOTTOM: Live preview — full width, plenty of room */}
      <section className="border rounded-lg p-3 bg-card/40 min-h-[480px]">
        <LivePreviewPane report={livePreviewReport} workspaceId={workspaceId} />
      </section>
    </div>
  );
}
