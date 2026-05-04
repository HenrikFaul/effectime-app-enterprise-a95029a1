import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';
import {
  SEMANTIC_DATASETS,
  REPORT_TEMPLATES,
  DATA_SOURCE_LABELS,
  type SemanticDataset,
  type ReportDataSource,
  type ReportTemplate,
} from './reportTemplates';

interface Props {
  selectedDataset: SemanticDataset | null;
  onSelectDataset: (key: SemanticDataset | null) => void;
  onUseTemplate: (template: ReportTemplate) => void;
  selectedDataSource?: ReportDataSource;
  onSelectDataSource?: (ds: ReportDataSource) => void;
  /** 'vertical' (default) for sidebar, 'horizontal' for top stacked layout */
  layout?: 'vertical' | 'horizontal';
}

/**
 * Browser for semantic datasets, data sources and report templates.
 * Supports vertical (sidebar) and horizontal (top section) layouts.
 */
export function DatasetBrowser({
  selectedDataset,
  onSelectDataset,
  onUseTemplate,
  selectedDataSource,
  onSelectDataSource,
  layout = 'vertical',
}: Props) {
  const [search, setSearch] = useState('');

  const filteredTemplates = useMemo(() => {
    let list = REPORT_TEMPLATES;
    if (selectedDataset) list = list.filter(t => t.dataset_label === selectedDataset);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    return list;
  }, [selectedDataset, search]);

  const dataSources = useMemo(() => {
    if (selectedDataset) {
      const ds = SEMANTIC_DATASETS.find(d => d.key === selectedDataset);
      return ds?.sources || [];
    }
    return Object.keys(DATA_SOURCE_LABELS) as ReportDataSource[];
  }, [selectedDataset]);

  const datasetsBlock = (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Üzleti adatkészlet</h4>
      <div className={layout === 'horizontal' ? 'flex flex-wrap gap-1.5' : 'space-y-1'}>
        <button
          onClick={() => onSelectDataset(null)}
          className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
            layout === 'horizontal' ? '' : 'w-full text-left'
          } ${!selectedDataset ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent/40'}`}
        >
          🌐 Összes
        </button>
        {SEMANTIC_DATASETS.map(d => (
          <button
            key={d.key}
            onClick={() => onSelectDataset(d.key)}
            className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
              layout === 'horizontal' ? '' : 'w-full text-left'
            } ${selectedDataset === d.key ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent/40'}`}
            title={d.description}
          >
            <span className="mr-1.5">{d.icon}</span>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );

  const sourcesBlock = onSelectDataSource && (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Adatforrás</h4>
      <div className={layout === 'horizontal' ? 'flex flex-wrap gap-1.5' : 'space-y-1'}>
        {dataSources.map(ds => (
          <button
            key={ds}
            onClick={() => onSelectDataSource(ds)}
            className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
              layout === 'horizontal' ? '' : 'w-full text-left'
            } ${selectedDataSource === ds ? 'border-primary bg-primary/10 font-medium' : 'border-transparent hover:bg-accent/40'}`}
          >
            {DATA_SOURCE_LABELS[ds]}
          </button>
        ))}
      </div>
    </div>
  );

  const templatesHeader = (
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3 w-3" /> Sablonok
      </h4>
      <Badge variant="outline" className="text-[10px]">{filteredTemplates.length}</Badge>
    </div>
  );

  const searchBox = (
    <div className="relative mb-2">
      <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Keresés…"
        className="h-7 text-xs pl-7"
      />
    </div>
  );

  if (layout === 'horizontal') {
    return (
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>{datasetsBlock}</div>
        <div>{sourcesBlock}</div>
        <div className="flex flex-col min-h-0">
          {templatesHeader}
          {searchBox}
          <ScrollArea className="max-h-44">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-2">
              {filteredTemplates.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic px-1 py-2 col-span-full">Nincs találat.</p>
              )}
              {filteredTemplates.map(t => (
                <Card key={t.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => onUseTemplate(t)}>
                  <CardContent className="p-2">
                    <p className="text-xs font-medium leading-tight">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{t.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {datasetsBlock}
      {sourcesBlock}
      <div className="flex-1 min-h-0 flex flex-col">
        {templatesHeader}
        {searchBox}
        <ScrollArea className="flex-1 -mr-2 pr-2">
          <div className="space-y-1.5">
            {filteredTemplates.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic px-1 py-2">Nincs találat.</p>
            )}
            {filteredTemplates.map(t => (
              <Card key={t.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => onUseTemplate(t)}>
                <CardContent className="p-2">
                  <p className="text-xs font-medium leading-tight">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{t.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
