import SeoHead from "@/components/seo/SeoHead";
import PillarPageLayout, { PillarFaq } from "@/components/seo/PillarPageLayout";

const TITLE = "Szabadságkezelő rendszer 2026 | Effectime";
const DESCRIPTION =
  "Szabadságkezelő rendszer magyar Mt. szerint: felhalmozás, jóváhagyási folyamat, távollétnaptár, Outlook szinkron. Próbáld ki ingyen – kártyaadat nélkül.";
const PATH = "/szabadsagkezeles";

const FAQS: PillarFaq[] = [
  {
    q: "Mi az a szabadságkezelő rendszer?",
    a: "A szabadságkezelő rendszer egy szoftver, amely nyilvántartja a szabadságkereteket, a felhasználást, a jóváhagyási folyamatot és a maradék napokat. Az Effectime mindezt magyar Mt. szabályok szerint, automatikus felhalmozással és többszintű jóváhagyással kezeli.",
  },
  {
    q: "Hány nap szabadság jár 2026-ban a magyar Mt. szerint?",
    a: "Az alapszabadság évi 20 munkanap, amely életkor szerint pótszabadsággal egészül ki (25 évesen +1 nap, 28 évesen +2 nap, és így tovább, 45 éves kortól +10 nap). Az Effectime automatikusan számolja a pontos keretet minden munkavállalónak születési dátum alapján.",
  },
  {
    q: "Mi a különbség a szabadság és a távollét között?",
    a: "A szabadság a fizetett pihenőidő (rendes szabadság, pótszabadság). A távollét tágabb fogalom: ide tartozik a betegszabadság, táppénz, fizetés nélküli szabadság, képzés, home office is. Az Effectime mindkettőt egy felületen kezeli.",
  },
  {
    q: "Hogyan automatizálható a jóváhagyási folyamat?",
    a: "Az Effectime-ban beállítható egy- vagy többszintű jóváhagyás: a kérelem automatikusan megy a közvetlen vezetőnek, majd HR-nek. Email és push értesítés, határidős figyelmeztetés, helyettesítés, csapatszintű lefedettség-ellenőrzés mind beépített.",
  },
  {
    q: "GDPR-konform a szabadságkezelő?",
    a: "Igen. Az Effectime EU adatközpontot használ, az adatkezelés GDPR-konform, adatfeldolgozási megállapodás (DPA) elérhető enterprise ügyfeleknek. Az adatok soha nem hagyják el az EU területét.",
  },
];

export default function Szabadsagkezeles() {
  return (
    <>
      <SeoHead
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        keywords="szabadságkezelő rendszer, szabadság nyilvántartó program, távollétkezelő rendszer, szabadság felhalmozási szabályok, jelenlétkezelő szoftver, HR szoftver kkv"
        breadcrumbs={[
          { name: "Főoldal", path: "/" },
          { name: "Szabadságkezelés", path: PATH },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            serviceType: "Szabadságkezelő rendszer",
            name: "Effectime szabadságkezelő",
            provider: { "@type": "Organization", name: "Effectime", url: "https://effectime.app/" },
            areaServed: { "@type": "Country", name: "Hungary" },
            description: DESCRIPTION,
          },
        ]}
      />
      <PillarPageLayout
        eyebrow="Szabadságkezelés"
        h1="Szabadságkezelő rendszer – Mt.-konform, jóváhagyási folyamattal"
        lede="Az Effectime szabadságkezelő rendszer automatikusan számolja a kereteket a magyar Munka törvénykönyve szerint, kezeli a jóváhagyási folyamatot és valós idejű távollétnaptárat ad a csapatnak."
        primaryCta={{ label: "Próbáld ki ingyen", to: "/auth" }}
        secondaryCta={{ label: "Funkciók megnézése", to: "/" }}
        sections={[
          {
            h2: "Mit tud az Effectime szabadságkezelő",
            body: (
              <ul className="list-disc space-y-2 pl-6">
                <li><strong>Automatikus keretszámítás</strong> – alap- és pótszabadság, gyermekek után járó pótszabadság, év közbeni belépés arányosítás.</li>
                <li><strong>Többszintű jóváhagyás</strong> – vezető → HR; helyettesítési szabályok; csapatszintű lefedettség-ellenőrzés.</li>
                <li><strong>Felhalmozási szabályok</strong> – tárgyévi, áthozott, lejáró keretek külön nyilvántartva.</li>
                <li><strong>Távollétnaptár</strong> – teljes csapat egy nézetben; Outlook naptár szinkron.</li>
                <li><strong>Riportok</strong> – havi, negyedéves, éves szabadság-felhasználás CSV/Excel exporttal.</li>
              </ul>
            ),
          },
          {
            h2: "Munka törvénykönyve – mit kell figyelni",
            body: (
              <ul className="list-disc space-y-2 pl-6">
                <li><strong>Alapszabadság:</strong> évi 20 munkanap.</li>
                <li><strong>Életkor szerinti pótszabadság:</strong> 25 évestől +1 nap, 45 évestől +10 nap (lépcsőzetes).</li>
                <li><strong>Gyermek utáni pótszabadság:</strong> 1 gyermek után +2 nap, 2 gyermek után +4 nap, 3+ gyermek után +7 nap.</li>
                <li><strong>Kiadás:</strong> a tárgyévben kell kiadni; legfeljebb a következő év március 31-ig pótolható.</li>
                <li>Az Effectime mindezt automatikusan kalkulálja és figyelmeztet a lejáró keretekre.</li>
              </ul>
            ),
          },
          {
            h2: "Bevezetés 1 nap alatt",
            body: (
              <ol className="list-decimal space-y-3 pl-6">
                <li>Munkaterület létrehozása (2 perc).</li>
                <li>Csapat import CSV-ből vagy Microsoft 365 SSO-val.</li>
                <li>Szabadság-keretek importálása (vagy automatikus számítás születési dátum alapján).</li>
                <li>Jóváhagyási folyamat beállítása (vezető / HR / helyettesítés).</li>
                <li>Csapat meghívása – innentől minden kérelem digitálisan megy.</li>
              </ol>
            ),
          },
        ]}
        faqs={FAQS}
        related={[
          { label: "Műszakbeosztó program", to: "/muszakbeosztas" },
          { label: "Kapacitástervező szoftver", to: "/kapacitastervezes" },
        ]}
      />
    </>
  );
}
