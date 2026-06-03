import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  CalendarDays, Users, BarChart3, Shield, ArrowRight, CheckCircle2,
  ClipboardCheck, LayoutDashboard, Sparkles, LogOut, AlertTriangle,
  Clock, Globe2, Lock, Award, Zap, Mail, ChevronDown, Star, Building2,
  Plus, X, Check, MapPin,
} from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import { useT } from '@/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { cn } from '@/lib/utils';

export default function Landing() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const t = useT();

  const goToWorkspaceSelector = () => navigate('/app?select=1');
  const primaryCta = () => (user ? goToWorkspaceSelector() : navigate('/auth'));

  useEffect(() => {
    if (!user) return;
    if (searchParams.get('oauth') !== 'google') return;
    const redirectTo = searchParams.get('redirect') || '/app';
    navigate(redirectTo, { replace: true });
  }, [user, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div
          className="h-16 flex items-center justify-between gap-3"
          style={{ paddingInline: 'var(--density-page-pad-x)' }}
        >
          <EffectimeLogo size={32} variant="full" />
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t('landing.nav_features')}</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">{t('landing.nav_workflow')}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t('landing.nav_pricing')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSelector size="sm" align="end" />
            {user ? (
              <>
                <Button variant="outline" size="sm" onClick={goToWorkspaceSelector} className="rounded-xl">
                  {t('landing.nav_workspace')}
                </Button>
                <Button variant="destructive" size="sm" onClick={signOut} className="rounded-xl gap-1.5">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('landing.nav_signout')}</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/auth')} className="rounded-xl hidden sm:inline-flex">
                  {t('landing.nav_signin')}
                </Button>
                <Button size="sm" onClick={() => navigate('/auth')} className="rounded-xl gradient-primary text-primary-foreground shadow-glow">
                  {t('landing.btn_start_free')}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ========= HERO ========= */}
        <section
          className="relative overflow-hidden"
          style={{ paddingInline: 'var(--density-page-pad-x)', paddingBlock: 'clamp(3rem, 7vw, 6rem)' }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-40 right-1/4 h-[32rem] w-[32rem] rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_60%,hsl(var(--background)))]" />
          </div>

          <div className="mx-auto w-full max-w-[min(1280px,92vw)] grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs sm:text-sm text-primary-foreground font-semibold mb-6 shadow-lg shadow-primary/25">
                <Shield className="h-3.5 w-3.5" />
                {t('landing.badge_platform')}
              </div>
              <h1 className="font-display font-bold leading-[1.05] mb-6 text-foreground tracking-tight"
                  style={{ fontSize: 'clamp(2.25rem, 5vw, 4.5rem)' }}>
                {t('landing.hero_title_prefix')}{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {t('landing.hero_title_accent')}
                </span>
              </h1>
              <p className="text-muted-foreground leading-relaxed mb-8 mx-auto lg:mx-0"
                 style={{ fontSize: 'clamp(1rem, 1.25vw, 1.2rem)', maxWidth: '36rem' }}>
                {t('landing.hero_subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                <Button
                  size="lg"
                  className="rounded-xl gradient-primary text-primary-foreground px-8 gap-2 shadow-glow h-12"
                  onClick={primaryCta}
                >
                  {user ? t('landing.btn_goto_workspace') : t('landing.btn_start_free')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                {!user && (
                  <Button size="lg" variant="outline" className="rounded-xl px-8 h-12" onClick={() => navigate('/auth')}>
                    {t('landing.btn_signin')}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground/80">{t('landing.trusted_by')}</p>
            </div>

            {/* Hero product mockup */}
            <HeroMockup t={t} />
          </div>

          {/* Stat band */}
          <div className="mx-auto w-full max-w-[min(1280px,92vw)] mt-16 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl border border-border/60 bg-border/60 overflow-hidden shadow-subtle">
            {([
              [t('landing.stat_1_value'), t('landing.stat_1_label')],
              [t('landing.stat_2_value'), t('landing.stat_2_label')],
              [t('landing.stat_3_value'), t('landing.stat_3_label')],
              [t('landing.stat_4_value'), t('landing.stat_4_label')],
            ] as const).map(([v, l]) => (
              <div key={l} className="bg-card p-6 text-center">
                <div className="font-display text-2xl sm:text-3xl font-bold text-primary">{v}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ========= PROBLEM ========= */}
        <section className="bg-muted/30 border-y border-border" style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}>
          <div className="mx-auto w-full max-w-[min(1100px,92vw)] text-center mb-12">
            <Eyebrow>{t('landing.problem_eyebrow')}</Eyebrow>
            <h2 className="font-display font-bold text-3xl sm:text-4xl mt-3">{t('landing.problem_title')}</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">{t('landing.problem_desc')}</p>
          </div>
          <div className="mx-auto w-full max-w-[min(1280px,92vw)] grid md:grid-cols-3 gap-5">
            {[
              { icon: Mail, t: t('landing.problem_1_title'), d: t('landing.problem_1_desc') },
              { icon: AlertTriangle, t: t('landing.problem_2_title'), d: t('landing.problem_2_desc') },
              { icon: Building2, t: t('landing.problem_3_title'), d: t('landing.problem_3_desc') },
            ].map(({ icon: Icon, t: title, d }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-subtle">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ========= SHOWCASE INTRO ========= */}
        <section id="features" style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}>
          <div className="mx-auto w-full max-w-[min(1100px,92vw)] text-center">
            <Eyebrow>{t('landing.showcase_eyebrow')}</Eyebrow>
            <h2 className="font-display font-bold text-3xl sm:text-4xl mt-3">{t('landing.showcase_title')}</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">{t('landing.showcase_desc')}</p>
          </div>
        </section>

        {/* ========= SHOWCASE 1 — Leave management ========= */}
        <ShowcaseRow
          eyebrow={t('landing.s1_eyebrow')}
          title={t('landing.s1_title')}
          desc={t('landing.s1_desc')}
          bullets={[t('landing.s1_bullet_1'), t('landing.s1_bullet_2'), t('landing.s1_bullet_3')]}
          icon={ClipboardCheck}
          reverse={false}
          mock={<LeaveRequestMock t={t} />}
        />

        {/* ========= SHOWCASE 2 — Team calendar ========= */}
        <ShowcaseRow
          eyebrow={t('landing.s2_eyebrow')}
          title={t('landing.s2_title')}
          desc={t('landing.s2_desc')}
          bullets={[t('landing.s2_bullet_1'), t('landing.s2_bullet_2'), t('landing.s2_bullet_3')]}
          icon={CalendarDays}
          reverse
          tinted
          mock={<TeamCalendarMock t={t} />}
        />

        {/* ========= SHOWCASE 3 — Coverage & capacity ========= */}
        <ShowcaseRow
          eyebrow={t('landing.s3_eyebrow')}
          title={t('landing.s3_title')}
          desc={t('landing.s3_desc')}
          bullets={[t('landing.s3_bullet_1'), t('landing.s3_bullet_2'), t('landing.s3_bullet_3')]}
          icon={BarChart3}
          reverse={false}
          mock={<CapacityHeatmapMock t={t} />}
        />

        {/* ========= SHOWCASE 4 — Approvals ========= */}
        <ShowcaseRow
          eyebrow={t('landing.s4_eyebrow')}
          title={t('landing.s4_title')}
          desc={t('landing.s4_desc')}
          bullets={[t('landing.s4_bullet_1'), t('landing.s4_bullet_2'), t('landing.s4_bullet_3')]}
          icon={Zap}
          reverse
          tinted
          mock={<ApprovalQueueMock t={t} />}
        />

        {/* ========= HOW IT WORKS ========= */}
        <section id="workflow" style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}>
          <div className="mx-auto w-full max-w-[min(1100px,92vw)] text-center mb-14">
            <Eyebrow>{t('landing.how_eyebrow')}</Eyebrow>
            <h2 className="font-display font-bold text-3xl sm:text-4xl mt-3">{t('landing.how_title')}</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">{t('landing.how_desc')}</p>
          </div>
          <div className="mx-auto w-full max-w-[min(1280px,92vw)] grid md:grid-cols-3 gap-6 relative">
            {[
              { n: '01', t: t('landing.how_1_title'), d: t('landing.how_1_desc') },
              { n: '02', t: t('landing.how_2_title'), d: t('landing.how_2_desc') },
              { n: '03', t: t('landing.how_3_title'), d: t('landing.how_3_desc') },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-7 shadow-subtle relative">
                <div className="font-display text-5xl font-bold text-primary/15 absolute right-5 top-4 select-none">{s.n}</div>
                <div className="h-9 w-9 rounded-lg gradient-primary text-primary-foreground font-semibold flex items-center justify-center text-sm mb-4 shadow-glow">
                  {s.n}
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{s.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ========= COMPARISON ========= */}
        <section className="bg-muted/30 border-y border-border" style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}>
          <div className="mx-auto w-full max-w-[min(1100px,92vw)] text-center mb-12">
            <Eyebrow>{t('landing.vs_eyebrow')}</Eyebrow>
            <h2 className="font-display font-bold text-3xl sm:text-4xl mt-3">{t('landing.vs_title')}</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">{t('landing.vs_desc')}</p>
          </div>
          <div className="mx-auto w-full max-w-[min(1100px,92vw)] rounded-2xl border border-border bg-card overflow-hidden shadow-elevated">
            <div className="grid grid-cols-2 border-b border-border bg-muted/40">
              <div className="p-4 sm:p-5 text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <X className="h-4 w-4 text-destructive" /> {t('landing.vs_col_old')}
              </div>
              <div className="p-4 sm:p-5 text-sm font-semibold text-primary flex items-center gap-2 border-l border-border">
                <Check className="h-4 w-4" /> {t('landing.vs_col_new')}
              </div>
            </div>
            {[
              [t('landing.vs_row_1_old'), t('landing.vs_row_1_new')],
              [t('landing.vs_row_2_old'), t('landing.vs_row_2_new')],
              [t('landing.vs_row_3_old'), t('landing.vs_row_3_new')],
              [t('landing.vs_row_4_old'), t('landing.vs_row_4_new')],
              [t('landing.vs_row_5_old'), t('landing.vs_row_5_new')],
            ].map(([o, n], i, arr) => (
              <div key={o} className={cn('grid grid-cols-2', i < arr.length - 1 && 'border-b border-border')}>
                <div className="p-4 sm:p-5 text-sm text-muted-foreground line-through decoration-destructive/40">{o}</div>
                <div className="p-4 sm:p-5 text-sm font-medium border-l border-border flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{n}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========= SOCIAL PROOF ========= */}
        <section style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}>
          <div className="mx-auto w-full max-w-[min(1100px,92vw)] text-center mb-12">
            <Eyebrow>{t('landing.proof_eyebrow')}</Eyebrow>
            <h2 className="font-display font-bold text-3xl sm:text-4xl mt-3">{t('landing.proof_title')}</h2>
          </div>
          <div className="mx-auto w-full max-w-[min(1280px,92vw)] grid md:grid-cols-3 gap-5">
            {[
              { q: t('landing.testimonial_1_quote'), a: t('landing.testimonial_1_author'), r: t('landing.testimonial_1_role') },
              { q: t('landing.testimonial_2_quote'), a: t('landing.testimonial_2_author'), r: t('landing.testimonial_2_role') },
              { q: t('landing.testimonial_3_quote'), a: t('landing.testimonial_3_author'), r: t('landing.testimonial_3_role') },
            ].map(({ q, a, r }) => (
              <figure key={a} className="rounded-2xl border border-border bg-card p-6 shadow-subtle flex flex-col">
                <div className="flex gap-0.5 mb-4 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <blockquote className="text-sm leading-relaxed text-foreground/90 flex-1">"{q}"</blockquote>
                <figcaption className="mt-5 pt-4 border-t border-border">
                  <div className="font-semibold text-sm">{a}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ========= TRUST / SECURITY ========= */}
        <section className="bg-muted/30 border-y border-border" style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}>
          <div className="mx-auto w-full max-w-[min(1280px,92vw)] grid lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
            <div>
              <Eyebrow>{t('landing.trust_eyebrow')}</Eyebrow>
              <h2 className="font-display font-bold text-3xl sm:text-4xl mt-3">{t('landing.trust_title')}</h2>
              <p className="text-muted-foreground mt-4 leading-relaxed">{t('landing.trust_desc')}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Shield, t: t('landing.trust_1') },
                { icon: Award, t: t('landing.trust_2') },
                { icon: Lock, t: t('landing.trust_3') },
                { icon: Globe2, t: t('landing.trust_4') },
              ].map(({ icon: Icon, t: text }) => (
                <div key={text} className="rounded-xl border border-border bg-card p-5 flex items-start gap-3 shadow-subtle">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-sm font-medium leading-snug pt-1.5">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========= FAQ ========= */}
        <section id="pricing" style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}>
          <div className="mx-auto w-full max-w-[min(820px,92vw)] text-center mb-10">
            <Eyebrow>{t('landing.faq_eyebrow')}</Eyebrow>
            <h2 className="font-display font-bold text-3xl sm:text-4xl mt-3">{t('landing.faq_title')}</h2>
          </div>
          <div className="mx-auto w-full max-w-[min(820px,92vw)] divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden shadow-subtle">
            {[
              { q: t('landing.faq_1_q'), a: t('landing.faq_1_a') },
              { q: t('landing.faq_2_q'), a: t('landing.faq_2_a') },
              { q: t('landing.faq_3_q'), a: t('landing.faq_3_a') },
              { q: t('landing.faq_4_q'), a: t('landing.faq_4_a') },
              { q: t('landing.faq_5_q'), a: t('landing.faq_5_a') },
            ].map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} defaultOpen={i === 0} />
            ))}
          </div>
        </section>

        {/* ========= FINAL CTA ========= */}
        <section style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}>
          <div className="mx-auto w-full max-w-[min(1100px,92vw)] relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-10 sm:p-14 text-center shadow-elevated">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
            </div>
            <Eyebrow>{t('landing.final_eyebrow')}</Eyebrow>
            <h2 className="font-display font-bold text-3xl sm:text-5xl mt-3 tracking-tight">{t('landing.final_title')}</h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">{t('landing.final_desc')}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="rounded-xl gradient-primary text-primary-foreground px-8 gap-2 shadow-glow h-12" onClick={primaryCta}>
                {user ? t('landing.btn_goto_workspace') : t('landing.final_cta')}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl px-8 h-12" onClick={() => navigate('/auth')}>
                {t('landing.final_cta_secondary')}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground"
          style={{ paddingInline: 'var(--density-page-pad-x)' }}
        >
          <EffectimeLogo size={24} variant="full" />
          <span>{t('landing.footer_copyright', { year: String(new Date().getFullYear()) })}</span>
        </div>
      </footer>
    </div>
  );
}

/* ============================================================
   Helper / mock components
   ============================================================ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider">
      <Sparkles className="h-3 w-3" />
      {children}
    </div>
  );
}

interface ShowcaseRowProps {
  eyebrow: string;
  title: string;
  desc: string;
  bullets: string[];
  icon: React.ComponentType<{ className?: string }>;
  reverse: boolean;
  tinted?: boolean;
  mock: React.ReactNode;
}

function ShowcaseRow({ eyebrow, title, desc, bullets, icon: Icon, reverse, tinted, mock }: ShowcaseRowProps) {
  return (
    <section
      className={cn(tinted && 'bg-muted/30 border-y border-border')}
      style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)', paddingInline: 'var(--density-page-pad-x)' }}
    >
      <div className="mx-auto w-full max-w-[min(1280px,92vw)] grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className={cn('order-1', reverse ? 'lg:order-2' : 'lg:order-1')}>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h3 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-tight">{title}</h3>
          <p className="text-muted-foreground mt-4 leading-relaxed">{desc}</p>
          <ul className="mt-6 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
                <span className="text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn('order-2', reverse ? 'lg:order-1' : 'lg:order-2')}>
          <div className="relative">
            <div aria-hidden className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/10 blur-2xl rounded-3xl -z-10" />
            {mock}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Hero mockup ---------- */
function HeroMockup({ t }: { t: (k: string, p?: Record<string, string>) => string }) {
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 bg-gradient-to-br from-primary/30 via-accent/20 to-transparent rounded-[2rem] blur-3xl -z-10" />
      <div className="rounded-2xl border border-border bg-card shadow-elevated overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
          </div>
          <div className="ml-3 text-xs font-mono text-muted-foreground">effectime.app/w/budapest-hq</div>
        </div>
        {/* Body */}
        <div className="grid grid-cols-[140px_1fr] min-h-[340px]">
          {/* Sidebar */}
          <div className="border-r border-border bg-muted/20 p-3 space-y-1">
            {[
              { icon: LayoutDashboard, l: 'Dashboard', active: true },
              { icon: CalendarDays, l: 'Calendar' },
              { icon: ClipboardCheck, l: 'Requests' },
              { icon: BarChart3, l: 'Capacity' },
              { icon: Users, l: 'Team' },
            ].map(({ icon: Icon, l, active }) => (
              <div key={l} className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium',
                active ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
              )}>
                <Icon className="h-3.5 w-3.5" />
                {l}
              </div>
            ))}
          </div>
          {/* Main */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">This week</div>
              <div className="text-xs text-muted-foreground">82% capacity</div>
            </div>
            {/* Mini calendar */}
            <div className="grid grid-cols-7 gap-1">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} className="text-[10px] text-muted-foreground text-center font-medium">{d}</div>
              ))}
              {Array.from({ length: 21 }).map((_, i) => {
                const state = [2,9,16].includes(i) ? 'leave' : [5,12,19].includes(i) ? 'remote' : 'in';
                return (
                  <div key={i} className={cn(
                    'h-7 rounded-md border text-[10px] flex items-center justify-center font-medium',
                    state === 'leave' && 'bg-accent/15 border-accent/30 text-accent',
                    state === 'remote' && 'bg-primary/10 border-primary/30 text-primary',
                    state === 'in' && 'bg-card border-border text-muted-foreground',
                  )}>
                    {i + 1}
                  </div>
                );
              })}
            </div>
            {/* Approval pill */}
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">AK</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">Anna K. · 5 day leave</div>
                <div className="text-[10px] text-muted-foreground">Jun 17 – 21 · awaiting you</div>
              </div>
              <div className="text-xs font-semibold text-primary">Approve</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Leave request mock ---------- */
function LeaveRequestMock({ t }: { t: (k: string) => string }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-elevated overflow-hidden max-w-md mx-auto lg:mx-0">
      <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">AK</div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{t('landing.s1_mock_title')}</div>
          <div className="text-xs text-muted-foreground">{t('landing.s1_mock_status')}</div>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wider rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 px-2 py-1">Pending</div>
      </div>
      <div className="p-5 space-y-4">
        <div className="rounded-xl bg-muted/40 p-4 space-y-2.5">
          <Row label="Type" value={t('landing.s1_mock_type')} />
          <Row label="Range" value={t('landing.s1_mock_range')} />
          <Row label="Balance" value={t('landing.s1_mock_balance')} valueClass="text-primary font-semibold" />
        </div>
        {/* Approval chain */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Approval chain</div>
          {[
            { n: 'Team lead · Márton', done: true },
            { n: 'HR · Petra', done: false },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-2.5 text-xs">
              <div className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center',
                s.done ? 'bg-primary text-primary-foreground' : 'border-2 border-dashed border-border'
              )}>
                {s.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </div>
              <span className={cn(s.done ? 'text-muted-foreground line-through' : 'font-medium')}>{s.n}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <button className="flex-1 h-9 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold shadow-glow">
            {t('landing.s1_mock_approve')}
          </button>
          <button className="flex-1 h-9 rounded-lg border border-border text-xs font-semibold hover:bg-muted/40">
            {t('landing.s1_mock_decline')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', valueClass)}>{value}</span>
    </div>
  );
}

/* ---------- Team calendar mock ---------- */
function TeamCalendarMock({ t }: { t: (k: string) => string }) {
  const people = [
    { name: 'Anna K.', site: 'BUD' },
    { name: 'Márton Sz.', site: 'BUD' },
    { name: 'Petra N.', site: 'VIE' },
    { name: 'Tomáš H.', site: 'PRG' },
    { name: 'Lena B.', site: 'BUD' },
  ];
  // pattern: 0 in, 1 remote, 2 leave
  const pattern = [
    [0,0,1,0,0,2,2],
    [0,1,1,0,0,2,2],
    [0,0,0,2,2,2,2],
    [1,0,0,0,0,2,2],
    [0,0,0,1,1,2,2],
  ];
  const colorFor = (s: number) =>
    s === 2 ? 'bg-accent' :
    s === 1 ? 'bg-primary/70' :
              'bg-primary/25';

  return (
    <div className="rounded-2xl border border-border bg-card shadow-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Week 25 · June
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> 3 sites
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-[100px_1fr] gap-2 text-[10px] text-muted-foreground font-medium mb-2">
          <div />
          <div className="grid grid-cols-7 gap-1 text-center">
            {['M','T','W','T','F','S','S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
        </div>
        <div className="space-y-2">
          {people.map((p, i) => (
            <div key={p.name} className="grid grid-cols-[100px_1fr] gap-2 items-center">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {p.name.split(' ').map(s => s[0]).join('')}
                </div>
                <div className="text-xs font-medium truncate">{p.name}</div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {pattern[i].map((s, j) => (
                  <div key={j} className={cn('h-6 rounded-md', colorFor(s))} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-primary/25" /> {t('landing.s2_mock_legend_in')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-primary/70" /> {t('landing.s2_mock_legend_remote')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-accent" /> {t('landing.s2_mock_legend_leave')}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Capacity heatmap mock ---------- */
function CapacityHeatmapMock({ t }: { t: (k: string) => string }) {
  // 14 days × 4 shifts
  const data = [
    [3,3,4,4,4,2,2,4,4,4,4,4,3,3],
    [4,4,4,3,3,2,2,4,4,4,3,3,2,2],
    [3,4,4,4,4,1,2,3,4,4,4,4,3,3], // row with gap
    [4,4,3,3,4,2,2,4,4,4,3,3,4,4],
  ];
  const shifts = ['Morning', 'Mid', 'Evening', 'Night'];
  const heat = (v: number) => {
    if (v <= 1) return 'bg-destructive text-destructive-foreground';
    if (v === 2) return 'bg-yellow-500/40 text-foreground';
    if (v === 3) return 'bg-primary/40 text-foreground';
    return 'bg-primary text-primary-foreground';
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          {t('landing.s3_mock_title')}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">Jun 14 → Jun 27</div>
      </div>
      <div className="p-4 space-y-2">
        {data.map((row, i) => (
          <div key={i} className="grid grid-cols-[64px_1fr] gap-2 items-center">
            <div className="text-[11px] font-medium text-muted-foreground">{shifts[i]}</div>
            <div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
              {row.map((v, j) => (
                <div key={j} className={cn('h-6 rounded text-[9px] font-bold flex items-center justify-center', heat(v))}>
                  {v}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-border space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t('landing.s3_mock_warn')}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          {t('landing.s3_mock_ok')}
        </div>
      </div>
    </div>
  );
}

/* ---------- Approval queue mock ---------- */
function ApprovalQueueMock({ t }: { t: (k: string) => string }) {
  const items = [
    { who: 'Anna K.', type: 'Annual leave', range: 'Jun 17 – 21', age: '2h', sla: 'ok' },
    { who: 'Márton Sz.', type: 'Sick leave', range: 'Jun 13', age: '14m', sla: 'ok' },
    { who: 'Petra N.', type: 'Remote work', range: 'Jun 19 – 20', age: '4h', sla: 'warn' },
    { who: 'Tomáš H.', type: 'Annual leave', range: 'Jul 1 – 5', age: '1d', sla: 'late' },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-elevated overflow-hidden max-w-lg mx-auto lg:mx-0">
      <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          {t('landing.s4_mock_title')}
        </div>
        <div className="text-[10px] flex items-center gap-1.5 text-muted-foreground font-mono">
          <Clock className="h-3 w-3" /> SLA · {t('landing.s4_mock_sla')}
        </div>
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => (
          <div key={it.who + it.type} className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
              {it.who.split(' ').map(s => s[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{it.who} · <span className="font-normal text-muted-foreground">{it.type}</span></div>
              <div className="text-[10px] text-muted-foreground">{it.range} · {it.age} ago</div>
            </div>
            <div className={cn(
              'text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5',
              it.sla === 'ok' && 'bg-primary/15 text-primary',
              it.sla === 'warn' && 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
              it.sla === 'late' && 'bg-destructive/15 text-destructive',
            )}>
              {it.sla === 'ok' ? 'On time' : it.sla === 'warn' ? 'Soon' : 'Late'}
            </div>
            <button className="h-7 px-2.5 rounded-md gradient-primary text-primary-foreground text-[11px] font-semibold shadow-sm">
              <Check className="h-3 w-3 inline" strokeWidth={3} />
            </button>
            <button className="h-7 px-2 rounded-md border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted/40">
              <X className="h-3 w-3 inline" strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- FAQ item ---------- */
function FaqItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <span className="font-semibold text-sm sm:text-base">{q}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{a}</div>
      )}
    </div>
  );
}
