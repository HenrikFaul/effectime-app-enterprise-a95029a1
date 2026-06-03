# Prompt 11 — Magyar bérprogram exportok

**Gap source:** Humanforce, Deputy (10+ payroll integrációval)
**Effort:** M · **Strategic value:** HU-specific moat

## Problem
*"A HR-es minden hónap végén 2 napot tölt azzal, hogy az Excelből átmásolja a Nexonba a ledolgozott órákat. Ha az Effectime tudna közvetlenül Nexon-export CSV-t generálni, az havi 16 órát spórolna."*

## Háttér
A magyar bérszámfejtési piacot 5 program dominálja: **Nexon, Nexum, Kulcs-Bér, KultúrSoft, SAP HCM**. Mindegyiknek saját CSV/XML import formátuma van.

## User story
Mint bérszámfejtő, a hónap végén egy gombnyomással szeretném letölteni az adott workspace adott havi `Bérexport` fájlját a bérprogramom által várt pontos formátumban, és azt 1:1-ben importálni a bérszoftverbe.

## Acceptance criteria
- [ ] Export modul `/w/:wid/payroll/export` (Business+ tier)
- [ ] Támogatott formátumok v1-ben: **Nexon CSV, Kulcs-Bér CSV, Generic CSV**
- [ ] v2 cél: Nexum XML, KultúrSoft CSV, SAP HCM IDoc
- [ ] Mezőtérkép-konfigurátor (custom field mapping per workspace)
- [ ] Tartalom: ledolgozott óra, túlóra (50%/100%), éjszakai pótlék, ünnepi pótlék, szabadság (fizetett/fizetetlen), betegszabadság, GYED/GYES
- [ ] Audit log: ki, mikor, milyen időszakra exportált
- [ ] Sandbox: dry-run preview az export előtt (sor-szintű ellenőrzés)
- [ ] Validátor: Mt. 2012/I szerinti túlóra plafon (max 250 óra/év) figyelmeztetés
- [ ] Dokumentáció `docs/payroll-export/` mappában minden formátumhoz

## Anti-regression
- A nyers időadatok (`time_entries`) változatlan struktúra
- Bérexport read-only — soha nem módosít forrásadatot

## Telemetry
- `payroll.export_generated{format}`, `payroll.dry_run_used`, `payroll.validation_warning_count`

## Marketing claim
*"Egy kattintás — Nexon, Kulcs-Bér, KultúrSoft bér-export, magyar bérszámfejtésre kalibrálva. A HR-es havi 2 napot spórol."*

## Out of scope
- Közvetlen API-integráció (nincs nyilvános API a Nexonnak)
- Bér-számfejtés saját motorral (sosem cél)
