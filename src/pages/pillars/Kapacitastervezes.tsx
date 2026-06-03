import SeoHead from "@/components/seo/SeoHead";
import PillarPageLayout, { PillarFaq } from "@/components/seo/PillarPageLayout";

const TITLE = "Kapacitástervező szoftver 2026 | Effectime";
const DESCRIPTION =
  "Kapacitástervező szoftver csapatoknak és projekteknek: valós idejű kapacitás vs. igény, allokáció, riportok, Jira/Azure DevOps integráció. Próbáld ki ingyen.";
const PATH = "/kapacitastervezes";

const FAQS: PillarFaq[] = [
  {
    q: "Mi az a kapacitástervező szoftver?",
    a: "A kapacitástervező szoftver megmutatja, hogy a csapat egy adott időszakban mennyi munkát tud elvégezni (kapacitás), és ezt összeveti a betervezett igénnyel. Az Effectime ezt valós időben, projekt- és csapatszinten egyaránt kezeli.",
  },
  {
    q: "Mi a különbség a műszakbeosztás és a kapacitástervezés között?",
    a: "A műszakbeosztás operatív: ki, mikor, melyik műszakban dolgozik. A kapacitástervezés stratégiai: van-e elég erőforrásunk a tervezett projektekhez a következő hetekben/hónapokban? Az Effectime mindkettőt egy platformon kezeli.",
  },
  {
    q: "Hogyan kapcsolódik a kapacitástervezés agilis csapathoz?",
    a: "Az Effectime importálja a Jira/Azure DevOps story point becsléseket, és összeveti a sprint kapacitással (csapatlétszám × dolgozott napok × velocity). A sprint planning-en azonnal látszik, ha túltervezés van.",
  },
  {
    q: "Mennyibe kerül a kapacitástervező?",
    a: "A kapacitástervező modul az Effectime platform része. Ingyenesen kipróbálható kártyaadat nélkül; enterprise csomag a felhasználók számától és az integrációktól függ.",
  },
  {
    q: "Milyen riportokat ad?",
    a: "Csapatkihasználtság (%), allokáció projektekre, kapacitás vs. igény heatmap, túl- és alultervezés figyelmeztetés, történeti trendek. Mind exportálható CSV-be és PDF-be.",
  },
];

export default function Kapacitastervezes() {
  return (
    <>
      <SeoHead
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        keywords="kapacitástervező szoftver, workforce management magyar, csapatnaptár szoftver, erőforrás tervezés, agilis kapacitás, sprint planning"
        breadcrumbs={[
          { name: "Főoldal", path: "/" },
          { name: "Kapacitástervezés", path: PATH },
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
            serviceType: "Kapacitástervező szoftver",
            name: "Effectime kapacitástervező",
            provider: { "@type": "Organization", name: "Effectime", url: "https://effectime.app/" },
            areaServed: { "@type": "Country", name: "Hungary" },
            description: DESCRIPTION,
          },
        ]}
      />
      <PillarPageLayout
        eyebrow="Kapacitástervezés"
        h1="Kapacitástervező szoftver – valós idejű kapacitás vs. igény"
        lede="Az Effectime kapacitástervező megmutatja, mennyi munkát bír el a csapat a következő hetekben, és ezt összeveti a betervezett projektekkel. Jira és Azure DevOps integrációval agilis csapatoknak is."
        primaryCta={{ label: "Próbáld ki ingyen", to: "/auth" }}
        secondaryCta={{ label: "Funkciók megnézése", to: "/" }}
        sections={[
          {
            h2: "Mit lát a tervező",
            body: (
              <ul className="list-disc space-y-2 pl-6">
                <li><strong>Kapacitás heatmap</strong> – napi/heti bontásban, csapat- és személyszinten.</li>
                <li><strong>Allokáció</strong> – ki, milyen projekten, hány órán dolgozik.</li>
                <li><strong>Túltervezés-figyelmeztetés</strong> – ha egy emberre 100% feletti terhelés esik.</li>
                <li><strong>Szabadság- és műszak-szinkron</strong> – a szabadnapok és műszakok automatikusan csökkentik a kapacitást.</li>
                <li><strong>Riportok</strong> – csapatkihasználtság, projekt allokáció, történeti trend.</li>
              </ul>
            ),
          },
          {
            h2: "Agilis kapacitástervezés Jira / Azure DevOps integrációval",
            body: (
              <ol className="list-decimal space-y-3 pl-6">
                <li>Kapcsold össze a Jira vagy Azure DevOps projektet az Effectime-mal.</li>
                <li>A sprint story pointok importálódnak, az Effectime velocity-vel órára konvertál.</li>
                <li>A sprint planning-en azonnal látszik, ha túl van tervezve a sprint.</li>
                <li>A szabadság és műszak automatikusan csökkenti a sprint-kapacitást.</li>
              </ol>
            ),
          },
          {
            h2: "Kinek ajánljuk",
            body: (
              <ul className="list-disc space-y-2 pl-6">
                <li>Szoftverfejlesztő csapatok (sprint planning, velocity tervezés)</li>
                <li>Ügynökségek és tanácsadó cégek (projekt allokáció, billable órák)</li>
                <li>Mérnöki és építőipari csapatok (projekt erőforrás-tervezés)</li>
                <li>Bármely projektszemléletű, 10–500 fős szervezet</li>
              </ul>
            ),
          },
        ]}
        faqs={FAQS}
        related={[
          { label: "Műszakbeosztó program", to: "/muszakbeosztas" },
          { label: "Szabadságkezelő rendszer", to: "/szabadsagkezeles" },
        ]}
      />
    </>
  );
}
