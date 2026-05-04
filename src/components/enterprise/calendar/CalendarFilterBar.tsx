import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Filter, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarFilterConfig, CalendarFilterId, FILTER_LABELS } from '@/hooks/useCalendarFilterConfig';

export interface FilterOption { value: string; label: string }

export interface FilterValues {
  office: string[];
  team: string[];
  business_role: string[];
  leave_type: string[];
  status: string[];
  skill: string[];
  location: string[];
  site_priority: string[];
  utilization: string[];
  assignment_state: string[];
  capacity_band: string[];
}

export const EMPTY_FILTERS: FilterValues = {
  office: [], team: [], business_role: [], leave_type: [], status: [], skill: [], location: [],
  site_priority: [], utilization: [], assignment_state: [], capacity_band: [],
};

interface Props {
  config: CalendarFilterConfig[];
  values: FilterValues;
  options: Record<CalendarFilterId, FilterOption[]>;
  onChange: (next: FilterValues) => void;
}

export function CalendarFilterBar({ config, values, options, onChange }: Props) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [expandedFilters, setExpandedFilters] = useState<Set<CalendarFilterId>>(new Set());
  const [searchTerms, setSearchTerms] = useState<Partial<Record<CalendarFilterId, string>>>({});

  const enabled = useMemo(
    () => config.filter(c => c.enabled).sort((a, b) => a.order - b.order),
    [config]
  );

  const activeCount = useMemo(
    () => enabled.reduce((acc, c) => acc + (values[c.id]?.length > 0 ? 1 : 0), 0),
    [enabled, values]
  );

  const toggleExpand = (id: CalendarFilterId) => {
    setExpandedFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOption = (filterId: CalendarFilterId, val: string) => {
    const cur = values[filterId] || [];
    const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
    onChange({ ...values, [filterId]: next });
  };

  const clearOne = (filterId: CalendarFilterId) => {
    onChange({ ...values, [filterId]: [] });
  };

  const clearAll = () => onChange(EMPTY_FILTERS);

  const setSearch = (id: CalendarFilterId, term: string) => {
    setSearchTerms(prev => ({ ...prev, [id]: term }));
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4 text-primary" />
          <span>Szűrők</span>
          {activeCount > 0 && (
            <Badge className="h-5 px-1.5 text-[10px] bg-purple-600 hover:bg-purple-600 text-white">
              {activeCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-muted-foreground"
              onClick={clearAll}
            >
              <X className="h-3 w-3 mr-1" />
              Törlés
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground"
            onClick={() => setPanelOpen(v => !v)}
          >
            {panelOpen ? 'Elrejt' : 'Megjelenít'}
          </Button>
        </div>
      </div>

      {/* Accordion filter rows */}
      {panelOpen && (
        <div>
          {enabled.map((c, idx) => {
            const opts = options[c.id] || [];
            const selected = values[c.id] || [];
            const isActive = selected.length > 0;
            const isExpanded = expandedFilters.has(c.id);
            const search = searchTerms[c.id] || '';
            const filtered = search
              ? opts.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
              : opts;

            return (
              <div
                key={c.id}
                className={cn(
                  'border-b last:border-b-0',
                  isActive && 'bg-purple-50/60 dark:bg-purple-950/20'
                )}
              >
                {/* Row header */}
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors',
                    isActive && 'text-purple-700 dark:text-purple-300'
                  )}
                  onClick={() => toggleExpand(c.id)}
                >
                  <span className="font-medium">{FILTER_LABELS[c.id]}</span>
                  <div className="flex items-center gap-1.5">
                    {isActive && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1.5 text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300"
                      >
                        {selected.length}
                      </Badge>
                    )}
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5 opacity-50" />
                      : <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    }
                  </div>
                </button>

                {/* Expanded options */}
                {isExpanded && (
                  <div className="pb-2 px-3">
                    {/* Search for large lists */}
                    {opts.length > 6 && (
                      <div className="relative mb-1.5">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          className="h-7 pl-7 text-xs"
                          placeholder="Keresés..."
                          value={search}
                          onChange={e => setSearch(c.id, e.target.value)}
                        />
                      </div>
                    )}
                    {opts.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">Nincs elérhető opció</p>
                    ) : (
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {filtered.map(o => (
                          <label
                            key={o.value}
                            className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer"
                          >
                            <Checkbox
                              checked={selected.includes(o.value)}
                              onCheckedChange={() => toggleOption(c.id, o.value)}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs truncate">{o.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {isActive && (
                      <button
                        type="button"
                        className="mt-1.5 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => clearOne(c.id)}
                      >
                        Szűrő törlése
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
