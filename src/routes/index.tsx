import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import {
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Effectime — Vállalati idő- és erőforrás-kezelés",
      },
      {
        name: "description",
        content:
          "Az Effectime egy vállalati munkaerő-platform: naptár, szabadságkezelés, jóváhagyási folyamatok és csapatszintű erőforrás-tervezés egy helyen.",
      },
      { property: "og:title", content: "Effectime — Vállalati idő- és erőforrás-kezelés" },
      {
        property: "og:description",
        content:
          "Naptár, szabadságkezelés és jóváhagyások egy átlátható platformon. Az Effectime segít a csapatoknak stratégiailag tervezni az időt.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: CalendarRange,
    title: "Egységes csapatnaptár",
    description:
      "Lássa egy nézetben a kollégák elérhetőségét, szabadságokat és projektütemezéseket — automatikus szinkronizációval.",
  },
  {
    icon: ClipboardCheck,
    title: "Szabadság- és kérelemkezelés",
    description:
      "Egyszerű igénylés, gyors jóváhagyás. Kvóták, féléves egyenlegek és féllapos szabadságok támogatásával.",
  },
  {
    icon: LayoutDashboard,
    title: "Erőforrás-tervezés",
    description:
      "Vizualizálja csapata kapacitását, kerülje el a túlterheltséget és tartsa egyensúlyban a projekteket.",
  },
  {
    icon: ShieldCheck,
    title: "Granuláris jogosultságok",
    description:
      "Tulajdonos, erőforrás-asszisztens, tag — testreszabható szerepkörök minden funkcióhoz.",
  },
  {
    icon: Users,
    title: "Munkaterületek",
    description:
      "Külön munkaterületek cégegységenként, dedikált tagsággal, szabályokkal és audit trailjel.",
  },
  {
    icon: CheckCircle2,
    title: "Jóváhagyási munkafolyamatok",
    description:
      "Átlátható, követhető folyamatok minden kérelemhez. Értesítések, naplózás, exportálás.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteNav />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-80">
          <div className="absolute left-1/2 top-0 h-[700px] w-[1100px] -translate-x-1/2 nebula-glow" />
          <div
            className="absolute -bottom-32 right-0 h-[500px] w-[600px] opacity-60"
            style={{
              background:
                "radial-gradient(circle, oklch(0.78 0.22 142 / 0.18) 0%, transparent 60%)",
            }}
          />
        </div>

        <div className="container mx-auto px-6 pt-24 pb-32 text-center lg:px-8 lg:pt-32 lg:pb-40">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Új generációs vállalati erőforrás-platform
          </span>

          <h1 className="mx-auto mt-8 max-w-4xl text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Navigálja vállalkozása erőforrásait{" "}
            <span className="bg-gradient-to-r from-brand via-primary to-brand bg-clip-text text-transparent">
              stratégiával
            </span>
            .
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
            Intelligens idő-, szabadság- és erőforrás-kezelés egy platformon. Az Effectime
            segít a csapatoknak átlátni a kapacitást és gyorsítani a jóváhagyásokat.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button className="group inline-flex items-center justify-center rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/50">
              Kezdje el ingyen
            </button>
            <button className="inline-flex items-center justify-center rounded-xl border border-border/60 bg-surface/40 px-8 py-4 text-base font-semibold text-foreground backdrop-blur transition-colors hover:bg-surface">
              Demó kérése
            </button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Nincs bankkártya — 14 napos próbaidőszak
          </p>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-background py-24 lg:py-32">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Mindent egy helyen
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Az Effectime modulokra épül, melyek együtt egy teljes vállalati erőforrás-rendszert
              alkotnak.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface/50 p-8 transition-all hover:border-primary/40 hover:bg-surface"
              >
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                  <feature.icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-border/60 py-24 lg:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 nebula-glow opacity-70" />
        </div>
        <div className="container mx-auto px-6 text-center lg:px-8">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Készen áll a stratégiai erőforrás-kezelésre?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Csatlakozzon azokhoz a csapatokhoz, akik már az Effectime-mal tervezik az időt.
          </p>
          <button className="mt-10 inline-flex items-center justify-center rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/50">
            Próbálja ingyen 14 napig
          </button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
