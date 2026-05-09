import { useDensity, type Density } from '@/hooks/useDensity';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Rows3, Rows2, Rows4, SlidersHorizontal, Check } from 'lucide-react';

const OPTIONS: { value: Density; label: string; icon: any; hint: string }[] = [
  { value: 'auto', label: 'Auto', icon: SlidersHorizontal, hint: 'Viewport alapján' },
  { value: 'compact', label: 'Tömör', icon: Rows4, hint: 'Több info egy képernyőn' },
  { value: 'comfortable', label: 'Kényelmes', icon: Rows3, hint: 'Alapértelmezett' },
  { value: 'expansive', label: 'Tágas', icon: Rows2, hint: 'Nagy képernyőkre' },
];

interface Props {
  workspaceId?: string | null;
}

/**
 * Density preference toggle. Stored per-workspace if a workspaceId is
 * provided (matches user expectation that each workspace can be tuned),
 * otherwise globally. Auto resolves from viewport.
 */
export function DensityToggle({ workspaceId }: Props) {
  const { density, resolved, setDensity } = useDensity();
  const current = OPTIONS.find((o) => o.value === density) ?? OPTIONS[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title={`Sűrűség: ${current.label}${density === 'auto' ? ` (${resolved})` : ''}`}
          aria-label="Sűrűség beállítása"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Felület sűrűsége</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => {
          const O = o.icon;
          const active = o.value === density;
          return (
            <DropdownMenuItem
              key={o.value}
              onClick={() => setDensity(o.value, { workspaceId })}
              className="gap-2"
            >
              <O className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-sm">{o.label}</span>
                <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
              </span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
