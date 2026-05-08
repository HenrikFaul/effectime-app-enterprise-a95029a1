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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <EffectimeLogo size={32} variant="full" />
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/app')} className="rounded-xl">
                  Munkaterület
                </Button>
                <Button variant="destructive" size="sm" onClick={signOut} className="rounded-xl gap-1.5">
                  <LogOut className="h-4 w-4" />
                  Kilépés
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
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground font-semibold mb-6 shadow-lg shadow-primary/25">
            <Shield className="h-3.5 w-3.5" />
            Enterprise kapacitáskezelő platform
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl leading-tight mb-6 text-foreground">
            Navigáld vállalkozásod erőforrásait{' '}
            <span className="text-primary">stratégiával</span>
          </h1>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Az Effectime platformmal valós időben láthatod és optimalizálhatod csapatod kapacitását.
            Egységesítjük a tervezést, projektek ütemezését és az erőforrás-gazdálkodást, hogy szervezeted minden pillanatban a stratégiára koncentrálhasson.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="rounded-xl gradient-primary text-primary-foreground px-8 gap-2 shadow-glow"
              onClick={() => navigate(user ? '/app' : '/auth')}
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
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="font-display font-bold text-3xl sm:text-4xl">
              Mindent egy helyen
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Az Effectime modulokra épül, melyek együtt egy teljes vállalati erőforrás-rendszert alkotnak.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-base">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-muted/40 border-y border-border py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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
                  onClick={() => navigate('/auth')}
                >
                  Ingyenes regisztráció
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <EffectimeLogo size={24} variant="full" />
          <span>© {new Date().getFullYear()} Effectime. Minden jog fenntartva.</span>
        </div>
      </footer>
    </div>
  );
}
