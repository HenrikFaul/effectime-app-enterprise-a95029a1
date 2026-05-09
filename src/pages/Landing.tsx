import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, BarChart3, Shield, ArrowRight, CheckCircle2, ClipboardCheck, LayoutDashboard, Sparkles, LogOut } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Egységes csapatnaptár',
    description: 'Lásd egy nézetben a kollégák elérhetőségét, szabadságokat és projektütemezéseket — automatikus szinkronizációval.',
  },
  {
    icon: ClipboardCheck,
    title: 'Szabadság- és kérelemkezelés',
    description: 'Egyszerű igénylés, gyors jóváhagyás. Kvóták, féléves egyenlegek és félnapos szabadságok támogatásával.',
  },
  {
    icon: LayoutDashboard,
    title: 'Erőforrás-tervezés',
    description: 'Vizualizáld csapatod kapacitását, kerüld el a túlterheltséget és tartsd egyensúlyban a projekteket.',
  },
  {
    icon: Sparkles,
    title: 'Intelligens beosztás varázsló',
    description: 'Automatikus javaslatokat készít a szabadságok, ünnepnapok, telephely-prioritás és pozícióegyezés figyelembevételével.',
  },
  {
    icon: Users,
    title: 'Munkaterületek',
    description: 'Külön munkaterületek cégegységenként, dedikált tagsággal, szabályokkal és audit traillel.',
  },
  {
    icon: CheckCircle2,
    title: 'Jóváhagyási munkafolyamatok',
    description: 'Átlátható, követhető folyamatok minden kérelemhez. Értesítések, naplózás és exportálás.',
  },
];

const BENEFITS = [
  'Korlátlan munkaterület tagok',
  'Jóváhagyási munkafolyamatok',
  'iCal / naptár integráció',
  'Agilis sprint-integráció',
  'Email értesítések',
  'Dedikált ügyfélszolgálat',
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();

  // From the landing page we always land on the workspace picker, never on
  // whichever workspace was last opened. Pass ?select=1 so Enterprise.tsx
  // skips auto-selecting from localStorage.
  const goToWorkspaceSelector = () => navigate('/app?select=1');

  useEffect(() => {
    if (!user) return;
    if (searchParams.get('oauth') !== 'google') return;
    const redirectTo = searchParams.get('redirect') || '/app';
    navigate(redirectTo, { replace: true });
  }, [user, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav — full-bleed, adaptive padding */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div
          className="h-16 flex items-center justify-between gap-3"
          style={{ paddingInline: 'var(--density-page-pad-x)' }}
        >
          <EffectimeLogo size={32} variant="full" />
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button variant="outline" size="sm" onClick={goToWorkspaceSelector} className="rounded-xl">
                  Munkaterület
                </Button>
                <Button variant="destructive" size="sm" onClick={signOut} className="rounded-xl gap-1.5">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Kilépés</span>
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="rounded-xl">
                Bejelentkezés
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — uses full viewport, content stays readable via inner clamp */}
        <section
          className="relative overflow-hidden"
          style={{ paddingInline: 'var(--density-page-pad-x)', paddingBlock: 'clamp(3rem, 8vw, 7rem)' }}
        >
          {/* decorative gradient blobs — kept inside section bounds */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-40 right-1/4 h-[32rem] w-[32rem] rounded-full bg-accent/10 blur-3xl" />
          </div>

          <div className="mx-auto w-full max-w-[min(1280px,92vw)] text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground font-semibold mb-6 shadow-lg shadow-primary/25">
              <Shield className="h-3.5 w-3.5" />
              Enterprise kapacitáskezelő platform
            </div>
            <h1 className="font-display font-bold leading-tight mb-6 text-foreground"
                style={{ fontSize: 'clamp(2.25rem, 5.5vw, 4.75rem)' }}>
              Navigáld vállalkozásod erőforrásait{' '}
              <span className="text-primary">stratégiával</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed mx-auto mb-10"
               style={{ fontSize: 'clamp(1rem, 1.4vw, 1.25rem)', maxWidth: '52rem' }}>
              Az Effectime platformmal valós időben láthatod és optimalizálhatod csapatod kapacitását.
              Egységesítjük a tervezést, projektek ütemezését és az erőforrás-gazdálkodást, hogy szervezeted minden pillanatban a stratégiára koncentrálhasson.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="rounded-xl gradient-primary text-primary-foreground px-8 gap-2 shadow-glow"
                onClick={() => (user ? goToWorkspaceSelector() : navigate('/auth'))}
              >
                {user ? 'Munkaterületre' : 'Kezdje el ingyen'}
                <ArrowRight className="h-4 w-4" />
              </Button>
              {!user && (
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl px-8"
                  onClick={() => navigate('/auth')}
                >
                  Bejelentkezés
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Features — adaptive grid scales 1→2→3→4 cols, full-bleed */}
        <section className="shell-page" style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)' }}>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="font-display font-bold text-3xl sm:text-4xl">
              Mindent egy helyen
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Az Effectime modulokra épül, melyek együtt egy teljes vállalati erőforrás-rendszert alkotnak.
            </p>
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="group rounded-2xl border border-border bg-card p-6 flex flex-col gap-3 hover:border-primary/50 hover:shadow-elevated transition-all">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-base">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits — full-bleed band with inner two-column layout that expands on ultrawide */}
        <section className="bg-muted/40 border-y border-border" style={{ paddingBlock: 'clamp(3rem, 6vw, 5rem)' }}>
          <div className="shell-page mx-auto w-full max-w-[1400px]">
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12 items-center">
              <div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl mb-4">
                  Mindent tartalmaz, ami kell
                </h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Nincs szükség további integrációkra. Az Effectime Enterprise-ban minden funkció beépítve érkezik.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BENEFITS.map((b) => (
                    <li key={b} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-card p-8 flex flex-col gap-6 shadow-sm">
                <div className="font-display font-bold text-xl">Próbálja ki már ma</div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Regisztráljon ingyenesen, hozza létre munkaterületét, és invitálja meg csapatát percek alatt.
                </p>
                <Button
                  size="lg"
                  className="rounded-xl gradient-primary text-primary-foreground gap-2 shadow-glow"
                  onClick={() => (user ? goToWorkspaceSelector() : navigate('/auth'))}
                >
                  {user ? 'Munkaterületre' : 'Ingyenes regisztráció'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
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
          <span>© {new Date().getFullYear()} Effectime. Minden jog fenntartva.</span>
        </div>
      </footer>
    </div>
  );
}
