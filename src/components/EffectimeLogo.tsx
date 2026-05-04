import { useId } from 'react';

interface Props {
  size?: number;
  variant?: 'mark' | 'full';
  className?: string;
}

/**
 * Effectime brand mark and wordmark.
 *
 * The symbol is a rounded time tile containing a custom M glyph. The middle
 * downstroke is intentionally drawn as a highlighted V, so the mark reads as
 * both effectiMe and effectiVe while staying compact in app navigation.
 */
export function EffectimeLogo({ size = 40, variant = 'full', className = '' }: Props) {
  const uid = useId().replace(/:/g, '');
  const iconSize = size;
  const textWidth = Math.round(iconSize * 3.7);
  const textSize = Math.round(iconSize * 0.54);
  const markGradientId = `et-mark-${uid}`;
  const vGradientId = `et-v-${uid}`;
  const textGradientId = `et-text-${uid}`;

  const mark = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="effectime-logo-mark shrink-0"
    >
      <defs>
        <linearGradient id={markGradientId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--brand-logo-start, var(--primary)))" />
          <stop offset="0.48" stopColor="hsl(var(--brand-logo-mid, var(--primary-glow)))" />
          <stop offset="1" stopColor="hsl(var(--brand-logo-end, var(--accent)))" />
        </linearGradient>
        <linearGradient id={vGradientId} x1="12" y1="9" x2="36" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.68" />
          <stop offset="0.55" stopColor="white" />
          <stop offset="1" stopColor="hsl(var(--brand-logo-end, var(--primary-glow)))" />
        </linearGradient>
        <filter id={`et-soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="hsl(var(--brand-logo-start, var(--primary)))" floodOpacity="0.22" />
        </filter>
      </defs>

      <rect width="48" height="48" rx="13" fill={`url(#${markGradientId})`} filter={`url(#et-soft-${uid})`} />
      <path d="M11 37 L11 12" stroke="white" strokeWidth="5.2" strokeLinecap="round" />
      <path d="M11 12 L24 30.5 L37 12" stroke={`url(#${vGradientId})`} strokeWidth="5.8" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M37 12 L37 37" stroke="white" strokeWidth="5.2" strokeLinecap="round" />
      <path d="M16 37 H32" stroke="white" strokeOpacity="0.42" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="24" cy="31" r="2.6" fill="hsl(var(--brand-logo-end, var(--primary-glow)))" />
    </svg>
  );

  if (variant === 'mark') {
    return <span className={className}>{mark}</span>;
  }

  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: Math.round(iconSize * 0.28) }}>
      {mark}
      <svg
        height={iconSize}
        width={textWidth}
        viewBox={`0 0 ${textWidth} ${iconSize}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Effectime"
        className="effectime-logo-wordmark shrink-0"
      >
        <defs>
          <linearGradient id={textGradientId} x1="0" y1="0" x2={textWidth} y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(var(--foreground))" />
            <stop offset="0.7" stopColor="hsl(var(--brand-logo-start, var(--primary)))" />
            <stop offset="1" stopColor="hsl(var(--brand-logo-end, var(--primary-glow)))" />
          </linearGradient>
        </defs>
        <text
          x="0"
          y={iconSize * 0.72}
          fontFamily="var(--font-display), 'Inter', 'SF Pro Display', system-ui, sans-serif"
          fontSize={textSize}
          fontWeight="800"
          letterSpacing="-0.055em"
          fill={`url(#${textGradientId})`}
        >
          effectime
        </text>
        <path
          d={`M${textWidth * 0.72} ${iconSize * 0.28} L${textWidth * 0.765} ${iconSize * 0.58} L${textWidth * 0.81} ${iconSize * 0.28}`}
          stroke="hsl(var(--brand-logo-end, var(--primary-glow)))"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>
    </span>
  );
}
