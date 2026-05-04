import faviconUrl from '@/assets/favico.svg';

interface Props {
  size?: number;
  variant?: 'mark' | 'full';
  className?: string;
}

/**
 * Effectime brand logo.
 *
 * A light-theme friendly rendering is used for the visible app logo, while the
 * browser favicon uses the same mark asset from `public/favicon.svg`.
 */
export function EffectimeLogo({ size = 40, variant = 'full', className = '' }: Props) {
  const wordmarkSize = Math.round(size * 0.68);

  const mark = (
    <img
      src={faviconUrl}
      alt=""
      aria-hidden="true"
      className="shrink-0 object-contain drop-shadow-sm"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );

  if (variant === 'mark') {
    return <span className={`inline-flex items-center ${className}`}>{mark}</span>;
  }

  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: Math.round(size * 0.3) }}>
      {mark}
      <span
        className="font-display font-extrabold tracking-tight leading-none text-slate-900 dark:text-white"
        style={{ fontSize: wordmarkSize }}
        aria-label="Effectime"
      >
        Effecti
        <span className="bg-gradient-to-br from-teal-400 via-teal-500 to-lime-400 bg-clip-text text-transparent">V</span>
        e
      </span>
    </span>
  );
}
