interface Props {
  size?: number;
  variant?: 'mark' | 'full';
  className?: string;
}

/**
 * effectime logo mark.
 *
 * The "M" in the wordmark contains an inner V‑stroke that simultaneously
 * encodes both readings: "effectiMe" (full M) and "effectiVe" (inner V).
 * The V is rendered in the brighter accent teal; the outer M legs in the
 * deeper primary teal — so the dual meaning is always visible.
 */
export function EffectimeLogo({ size = 40, variant = 'full', className = '' }: Props) {
  const iconSize = size;
  // Primary brand teal (dark)
  const P = 'hsl(172,66%,38%)';
  // Accent / glow teal (light)
  const A = 'hsl(172,80%,54%)';
  const WHITE = '#ffffff';

  const mark = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="et-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor={P} />
          <stop offset="1" stopColor={A} />
        </linearGradient>
        <linearGradient id="et-v" x1="14" y1="10" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor={WHITE} stopOpacity="0.6" />
          <stop offset="1" stopColor={WHITE} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Background tile */}
      <rect width="48" height="48" rx="11" fill="url(#et-bg)" />

      {/* ── Custom M glyph ─────────────────────────────────────────────
          The M is built from three strokes:
            1. Left leg   (outer) — pure white
            2. Inner V    (highlighted) — accent gradient → dual reading
            3. Right leg  (outer) — pure white
          All strokes share the same weight so the M reads naturally;
          the V's gradient glow guides the eye toward "effectiVe".
      ──────────────────────────────────────────────────────────────── */}

      {/* Left outer leg */}
      <path d="M10 38 L10 11" stroke={WHITE} strokeWidth="5" strokeLinecap="round" />

      {/* Inner V — highlighted with gradient so the V reading pops */}
      <path d="M10 11 L24 30 L38 11" stroke="url(#et-v)" strokeWidth="5.5"
            strokeLinejoin="round" strokeLinecap="round" />

      {/* Right outer leg */}
      <path d="M38 11 L38 38" stroke={WHITE} strokeWidth="5" strokeLinecap="round" />

      {/* Subtle V‑apex dot — anchors the "V" reading */}
      <circle cx="24" cy="31" r="2.5" fill={A} />
    </svg>
  );

  if (variant === 'mark') return <span className={className}>{mark}</span>;

  // Full wordmark — "effect" · custom M · "e"
  const textSize = Math.round(iconSize * 0.56);
  const gap = Math.round(iconSize * 0.3);

  return (
    <span className={`inline-flex items-center gap-[${gap}px] ${className}`} style={{ gap }}>
      {mark}
      <svg
        height={iconSize}
        viewBox={`0 0 ${Math.round(iconSize * 3.6)} ${iconSize}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="effectime"
      >
        <defs>
          <linearGradient id="et-text" x1="0" y1="0" x2="100%" y2="0">
            <stop stopColor={P} />
            <stop offset="1" stopColor={A} />
          </linearGradient>
        </defs>
        <text
          y={iconSize * 0.73}
          fontFamily="'Inter', 'SF Pro Display', system-ui, sans-serif"
          fontSize={textSize}
          fontWeight="700"
          letterSpacing="-0.04em"
          fill="url(#et-text)"
        >
          effectime
        </text>
      </svg>
    </span>
  );
}
