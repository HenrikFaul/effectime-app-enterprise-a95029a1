import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ENTITY_REGISTRY, type EntityConfig } from './config/entity-registry';
import { cn } from '@/lib/utils';

interface Props {
  mode: 'export' | 'import';
  selected: string | null;
  onSelect: (key: string) => void;
}

export function EntitySelector({ mode, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {ENTITY_REGISTRY.map((entity) => {
        const Icon = entity.icon;
        const enabled = mode === 'export' ? entity.exportEnabled : entity.importEnabled;
        const isSelected = selected === entity.key;
        return (
          <button
            key={entity.key}
            type="button"
            disabled={!enabled}
            onClick={() => enabled && onSelect(entity.key)}
            className={cn(
              'text-left transition-all rounded-lg border p-3',
              enabled ? 'cursor-pointer hover:bg-accent/30 hover:border-primary/50' : 'opacity-50 cursor-not-allowed',
              isSelected && 'border-primary bg-primary/5 ring-2 ring-primary/30',
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('rounded-md p-2 shrink-0', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{entity.label}</span>
                  {entity.exportEnabled && (
                    <Badge variant="outline" className="h-4 text-[9px] gap-0.5 px-1"><ArrowDown className="h-2.5 w-2.5" />Export</Badge>
                  )}
                  {entity.importEnabled && (
                    <Badge variant="outline" className="h-4 text-[9px] gap-0.5 px-1"><ArrowUp className="h-2.5 w-2.5" />Import</Badge>
                  )}
                  {!enabled && (
                    <Badge variant="secondary" className="h-4 text-[9px] px-1">Hamarosan</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{entity.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
