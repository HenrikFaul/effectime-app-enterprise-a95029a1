import { Link } from "react-router-dom";
import { ReactNode } from "react";

export interface PillarFaq {
  q: string;
  a: string;
}

export interface PillarPageProps {
  eyebrow: string;
  h1: string;
  lede: string;
  primaryCta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  sections: { h2: string; body: ReactNode }[];
  faqs: PillarFaq[];
  related: { label: string; to: string }[];
}

/**
 * Shared layout for SEO pillar pages (kategóriaoldalak).
 * Renders semantic H1/H2/H3, breadcrumb nav, FAQ + related links.
 * Visual: tokens-only (no hardcoded colors). Kept simple to ship fast.
 */
export function PillarPageLayout({
  eyebrow,
  h1,
  lede,
  primaryCta,
  secondaryCta,
  sections,
  faqs,
  related,
}: PillarPageProps) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Breadcrumb (visual; schema is in <SeoHead />) */}
      <nav
        aria-label="Morzsamenü"
        className="mx-auto max-w-5xl px-6 pt-8 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link to="/" className="hover:text-foreground">Főoldal</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium">{eyebrow}</li>
        </ol>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-bold leading-tight text-foreground md:text-5xl">
          {h1}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          {lede}
        </p>
        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {primaryCta && (
              <Link
                to={primaryCta.to}
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {primaryCta.label}
              </Link>
            )}
            {secondaryCta && (
              <Link
                to={secondaryCta.to}
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-6 py-3 text-base font-semibold text-foreground transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Content sections */}
      <section className="mx-auto max-w-5xl space-y-12 px-6 pb-16">
        {sections.map((s, i) => (
          <article key={i}>
            <h2 className="mb-4 text-2xl font-bold text-foreground md:text-3xl">{s.h2}</h2>
            <div className="prose-pillar max-w-none text-base leading-relaxed text-foreground/90">
              {s.body}
            </div>
          </article>
        ))}
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="mb-6 text-2xl font-bold text-foreground md:text-3xl">
          Gyakori kérdések
        </h2>
        <dl className="space-y-6">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5">
              <dt className="text-lg font-semibold text-foreground">{f.q}</dt>
              <dd className="mt-2 text-base leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Related pillar links (internal linking) */}
      {related.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <h2 className="mb-4 text-xl font-bold text-foreground">Kapcsolódó megoldások</h2>
          <ul className="flex flex-wrap gap-3">
            {related.map((r, i) => (
              <li key={i}>
                <Link
                  to={r.to}
                  className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default PillarPageLayout;
