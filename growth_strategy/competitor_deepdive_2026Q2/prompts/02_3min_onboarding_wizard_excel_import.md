# Prompt 02 — 3 perces onboarding wizard + Excel import

**Beat:** ruac.eu ("10 perc bevezetés")
**Cél:** Effectime onboarding ≤ 3 perc, beleértve a meglévő Excel jelenléti-ív importját.
**Effort:** S-M (2-3 hét)

## User story

> Mint kisvállalkozás-tulajdonos, akinek Excel-ben van a jelenléti íve, **3 perc alatt élesedjen** az Effectime workspace-em, a csapatom CSV-ből legyen importálva, és lássam az első műszakot/szabadságot.

## Acceptance criteria

1. **5-step wizard** `/onboarding`:
   - 1. Workspace neve + iparág (vendéglátás / iroda / retail / építőipar / egyéb)
   - 2. **Csapat import:** CSV upload (név, email, beosztás) ↔ M365 connector ↔ kézzel
   - 3. Ünnepnap-pack választás (HU/SK/CZ/PL/RO/AT/DE auto-import — lásd `competitor_feature_prompts/03`)
   - 4. Első műszak-sablon vagy szabadság-policy választás (preset library)
   - 5. Manager-meghívás (email)
2. **Progress bar** (1/5...5/5), **Skip everything** lehetőség minden lépésnél, **sample data** populálás opció.
3. **Excel/CSV import:** drag-drop, fejléc-auto-detect (név/email/beosztás kötelező mezők), preview + error highlighting + bulk-fix UI.
4. **Time-to-first-value mérés:** wizard-start → first-shift-or-leave-displayed ≤ 3 perc target metric.

## Anti-regression

- Ne érintse a meglévő `/app` workspace-pickert.
- A wizard csak az új workspace létrehozási flow-t cseréli — a meglévő workspace-ek érintetlenek.

## Marketing claim

*"3 perc alatt élesben. CSV-ből, Excelből, vagy Microsoft 365-ből — egy kattintással."*
