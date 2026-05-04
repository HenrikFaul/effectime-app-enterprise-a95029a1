import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, BarChart3, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Szabadság-kezelés',
    description: 'Kérelmek, jóváhagyások és csapatnaptár egy helyen.',
  },
  {
    icon: Users,
    title: 'Kapacitástervezés',
    description: 'Valós idejű csapat-elérhetőség és erőforrás-áttekintés.',
  },
  {
    icon: BarChart3,
    title: 'Riportok és elemzések',
    description: 'Részletes kimutatások a HR és a menedzsment számára.',
  },
  {
    icon: Shield,
    title: 'Biztonság & megfelelőség',
    description: 'Szerepkör-alapú hozzáférés, GDPR-kompatibilis adatkezelés.',
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
  const { user } = useAuth();
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
          <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="rounded-xl">
            Bejelentkezés
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm text-primary font-medium mb-6">
            <Shield className="h-3.5 w-3.5" />
            Enterprise szabadságkezelő platform
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl leading-tight mb-6 text-foreground">
            Vállalati szabadság&shy;kezelés,{' '}
            <span className="text-primary">egyszerűen</span>
          </h1>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Az Effectime segítségével a csapatod szabadsági kérelmei, jóváhagyásai és kapacitástervezése
            egyetlen helyen, átláthatóan kezelhető.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="rounded-xl gradient-primary text-primary-foreground px-8 gap-2 shadow-glow"
              onClick={() => navigate('/auth')}
            >
              Próbálja ingyen
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl px-8"
              onClick={() => navigate('/auth')}
            >
              Bejelentkezés
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-center mb-12">
            Minden, amire egy vállalatnak szüksége van
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  Nincs szükség bonyolult integrációkra. Az Effectime Enterprise-ban minden funkció beépítve érkezik.
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
                <div className="font-display font-bold text-xl">Kezdjen el ma</div>
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
                <p className="text-xs text-muted-foreground text-center">Nem szükséges bankkártya.</p>
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
