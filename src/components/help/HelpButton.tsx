import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHelpControls } from '@/lib/help/registry';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  className?: string;
}

export function HelpButton({ className }: Props) {
  const { openHelp } = useHelpControls();
  const t = useT();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-9 w-9 rounded-full p-0 text-foreground/80 hover:bg-accent ${className ?? ''}`}
      onClick={openHelp}
      aria-label={t('header.open_help')}
      title={t('header.help')}
    >
      <CircleHelp className="h-5 w-5" />
    </Button>
  );
}
