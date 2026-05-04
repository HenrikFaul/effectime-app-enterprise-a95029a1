import brandingUrl from '@/assets/branding.svg';
import faviconUrl from '@/assets/favico.svg';

interface Props {
  size?: number;
  variant?: 'mark' | 'full';
  className?: string;
}

/**
 * Effectime brand logo.
 *
 * The mark and wordmark are sourced from the official uploaded SVG assets so
 * the app header/landing branding and browser favicon stay visually aligned.
 */
export function EffectimeLogo({ size = 40, variant = 'full', className = '' }: Props) {
  const markSize = size;
  const wordmarkWidth = Math.round(size * 3.35);

  const mark = (
    <img
      src={faviconUrl}
      alt=""
      aria-hidden="true"
      className="effectime-logo-mark shrink-0 object-contain"
      style={{ width: markSize, height: markSize }}
      draggable={false}
    />
  );

  if (variant === 'mark') {
    return <span className={`inline-flex items-center ${className}`}>{mark}</span>;
  }

  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: Math.round(size * 0.28) }}>
      {mark}
      <img
        src={brandingUrl}
        alt="effectime"
        className="effectime-logo-wordmark shrink-0 object-contain"
        style={{ width: wordmarkWidth, height: size }}
        draggable={false}
      />
    </span>
  );
}
