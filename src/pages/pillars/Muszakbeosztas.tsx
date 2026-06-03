import SeoHead from "@/components/seo/SeoHead";
import PillarPageLayout, { PillarFaq } from "@/components/seo/PillarPageLayout";

const TITLE = "Műszakbeosztó program 2026 | Effectime";
const DESCRIPTION =
  "Műszakbeosztó program magyar csapatoknak: heti rács, sablonok, automatikus ütközésellenőrzés, Outlook szinkron. Próbáld ki ingyen – kártyaadat nélkül.";
const PATH = "/muszakbeosztas";

const FAQS: PillarFaq[] = [
  {
    q: "Mi az a műszakbeosztó program?",
    a: "A műszakbeosztó program egy szoftver, amely automatizálja a heti vagy havi beosztás készítését: nyilvántartja a műszaktípusokat, csapattagokat, távollétet és valós időben jelzi az ütközéseket. Az Effectime ezt 2 perc alatt használatba vehetően kínálja, magyar nyelven.",
  },
  {
    q: "Hogyan készítsek műszakbeosztást Excel helyett?",
    a: "Az Effectime-ban hozz létre munkaterületet, importáld a csapatot CSV-ből vagy Microsoft 365 SSO-val, definiáld a műszaktípusokat (időtartam, létszám, készségek), majd heti nézetben egy kattintással oszd ki a műszakokat. A program automatikusan jelzi a szabadságot, túlórát és a Mt. szerinti határértékeket.",
  },
  {
    q: "Hány órát dolgozhat egy munkavállaló műszakban?",
    a: "A magyar Munka törvénykönyve (Mt.) szerint a beosztás szerinti napi munkaidő legfeljebb 12 óra, a heti munkaidő 48 óra (négyhavi átlagban). Az Effectime beosztó automatikusan figyelmeztet, ha egy beosztás átlépné ezeket a határértékeket.",
  },
  {
    q: "Melyik a legjobb műszakbeosztó program 2026-ban?",
    a: "A magyar piacon az Effectime a vezető műszakbeosztó program: 4.8/5 értékelés 127 vélemény alapján, magyar nyelvű felület, Microsoft 365 integráció, CRM beágyazás és GDPR-konform EU adatkezelés. 5 főtől több száz fős csapatig skálázódik.",
  },
  {
    q: "Mennyibe kerül egy műszakbeosztó szoftver?",
    a: "Az Effectime ingyenesen kipróbálható kártyaadat nélkül. Fizetős enterprise csomagok elérhetők – az ár a felhasználók számától és a választott modulok körétől függ.",
  },
];

export default function Muszakbeosztas() {
  return (
    <>
      <SeoHead
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        keywords="műszakbeosztó program, műszakbeosztás szoftver, beosztáskészítő program, online beosztás készítő, műszakbeosztó Excel helyett, forgó műszakbeosztás"
        breadcrumbs={[
          { name: "Főoldal", path: "/" },
          { name: "Műszakbeosztás", path: PATH },
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
            serviceType: "Műszakbeosztó program",
            name: "Effectime műszakbeosztó",
            provider: { "@type": "Organization", name: "Effectime", url: "https://effectime.app/" },
            areaServed: { "@type": "Country", name: "Hungary" },
            description: DESCRIPTION,
          },
        ]}
      />
      <PillarPageLayout
        eyebrow="Műszakbeosztás"
        h1="Műszakbeosztó program – heti rács, sablonok, automatikus ellenőrzés"
        lede="Az Effectime műszakbeosztó program 5 főtől több száz fős csapatig kezeli a heti beosztást. Magyar nyelvű felület, Outlook szinkron, Mt.-figyelmeztetés és sablonok – nem kell több Excel-tábla."
        primaryCta={{ label: "Próbáld ki ingyen", to: "/auth" }}
        secondaryCta={{ label: "Funkciók megnézése", to: "/" }}
        sections={[
          {
            h2: "Miért váltsunk Excelről műszakbeosztó programra?",
            body: (
              <ul className="list-disc space-y-2 pl-6">
                <li><strong>Időmegtakarítás:</strong> egy heti beosztás 30 perc helyett 5 perc alatt elkészül.</li>
                <li><strong>Hibamentesség:</strong> a rendszer jelzi az ütközéseket, túlórát, hiányzó lefedettséget.</li>
                <li><strong>Átláthatóság:</strong> a csapat mobilon és Outlook naptárban azonnal látja a beosztást.</li>
                <li><strong>Mt. megfelelőség:</strong> automatikus napi 12 / heti 48 órás határérték-ellenőrzés.</li>
                <li><strong>Audit nyom:</strong> minden módosítás naplózva van – bér- és HR-vita esetén bizonyíték.</li>
              </ul>
            ),
          },
          {
            h2: "Hogyan működik az Effectime műszakbeosztó",
            body: (
              <ol className="list-decimal space-y-3 pl-6">
                <li><strong>Munkaterület létrehozása</strong> – 2 perc, kártyaadat nélkül.</li>
                <li><strong>Csapat felvétele</strong> – CSV import vagy Microsoft 365 SSO-s meghívás.</li>
                <li><strong>Műszaktípusok beállítása</strong> – időtartam, létszám, szükséges készségek (kész sablonok elérhetők).</li>
                <li><strong>Heti beosztás generálása</strong> – drag-and-drop vagy egy kattintásos automatikus kiosztás.</li>
                <li><strong>Megosztás és értesítés</strong> – push, email, Outlook naptár szinkron.</li>
              </ol>
            ),
          },
          {
            h2: "Kinek ajánljuk",
            body: (
              <ul className="list-disc space-y-2 pl-6">
                <li>Egészségügyi szolgáltatók (rendelők, klinikák, ügyeleti rendszer)</li>
                <li>Kiskereskedelmi láncok és vendéglátóhelyek</li>
                <li>Logisztikai, raktározási és gyártó cégek</li>
                <li>IT- és support csapatok (24/7 ügyelet, on-call rotáció)</li>
                <li>Bármely 5–500 fős csapat, ahol forgó vagy változó műszakbeosztás van</li>
              </ul>
            ),
          },
        ]}
        faqs={FAQS}
        related={[
          { label: "Szabadságkezelő rendszer", to: "/szabadsagkezeles" },
          { label: "Kapacitástervező szoftver", to: "/kapacitastervezes" },
        ]}
      />
    </>
  );
}
