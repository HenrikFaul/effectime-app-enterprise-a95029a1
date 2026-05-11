import { useDensity, type Density } from '@/hooks/useDensity';
import { useWorkspaceNavLayout } from '@/hooks/useWorkspaceNavLayout';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Rows3, Rows2, Rows4, SlidersHorizontal, Check, PanelLeft, BetweenHorizontalStart } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId?: string | null;
}

export function DensityToggle({ workspaceId }: Props) {
  const { t } = useI18n();
  const { density, resolved, setDensity } = useDensity();
  const { layout, setLayout } = useWorkspaceNavLayout(workspaceId);

  const OPTIONS: { value: Density; label: string; icon: any; hint: string }[] = [
    { value: 'auto', label: t('density_toggle.option_auto_label'), icon: SlidersHorizontal, hint: t('density_toggle.option_auto_hint') },
    { value: 'compact', label: t('density_toggle.option_compact_label'), icon: Rows4, hint: t('density_toggle.option_compact_hint') },
    { value: 'comfortable', label: t('density_toggle.option_comfortable_label'), icon: Rows3, hint: t('density_toggle.option_comfortable_hint') },
    { value: 'expansive', label: t('density_toggle.option_expansive_label'), icon: Rows2, hint: t('density_toggle.option_expansive_hint') },
  ];

  const current = OPTIONS.find((o) => o.value === density) ?? OPTIONS[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title={`${t('density_toggle.title_layout')}${density === 'auto' ? ` · ${current.label} (${resolved})` : ` · ${current.label}`}`}
          aria-label={t('density_toggle.aria_toggle')}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {workspaceId && (
          <>
            <DropdownMenuLabel>{t('density_toggle.title_layout')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLayout('sidebar')} className="gap-2">
              <PanelLeft className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{t('density_toggle.layout_sidebar')}</span>
              {layout === 'sidebar' && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLayout('menubar')} className="gap-2">
              <BetweenHorizontalStart className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{t('density_toggle.layout_menubar')}</span>
              {layout === 'menubar' && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>{t('density_toggle.title_density')}</DropdownMenuLabel>
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
