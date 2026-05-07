import { CircleHelp } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useHelpControls, useHelpRegistry } from '@/lib/help/registry';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  className?: string;
}

const HIGHLIGHT_CLASS = 'help-target-hover';

function findAnchorAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const target = (el as Element).closest('[data-help-region]') as HTMLElement | null;
  return target?.dataset.helpRegion ?? null;
}

export function HelpButton({ className }: Props) {
  const { openHelp } = useHelpControls();
  const { setSelectedAnchorId, setDrawerOpen, setDragging } = useHelpRegistry();
  const t = useT();
  const lastHovered = useRef<HTMLElement | null>(null);
  const dragActive = useRef(false);

  const clearHover = useCallback(() => {
    if (lastHovered.current) {
      lastHovered.current.classList.remove(HIGHLIGHT_CLASS);
      lastHovered.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Start a potential drag-target session; only mouse/pen
      if (e.pointerType === 'touch') return;
      dragActive.current = false;
      const startX = e.clientX;
      const startY = e.clientY;

      const onMove = (ev: PointerEvent) => {
        if (!dragActive.current) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (Math.hypot(dx, dy) < 6) return;
          dragActive.current = true;
          setDragging(true);
          document.body.style.cursor = 'help';
        }
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const target = el?.closest('[data-help-region]') as HTMLElement | null;
        if (target !== lastHovered.current) {
          clearHover();
          if (target) {
            target.classList.add(HIGHLIGHT_CLASS);
            lastHovered.current = target;
          }
        }
      };
      const onUp = (ev: PointerEvent) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.style.cursor = '';
        setDragging(false);
        if (dragActive.current) {
          const id = findAnchorAt(ev.clientX, ev.clientY);
          clearHover();
          if (id) {
            setSelectedAnchorId(id);
            setDrawerOpen(true);
          }
        }
        dragActive.current = false;
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [clearHover, setDragging, setDrawerOpen, setSelectedAnchorId],
  );

  const onClick = useCallback(() => {
    if (dragActive.current) return; // drag handled it
    openHelp();
  }, [openHelp]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-9 w-9 rounded-full p-0 text-foreground/80 hover:bg-accent ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      aria-label={t('header.open_help')}
      title={t('header.help')}
    >
      <CircleHelp className="h-5 w-5" />
    </Button>
  );
}
