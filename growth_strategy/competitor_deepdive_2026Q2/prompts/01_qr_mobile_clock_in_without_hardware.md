# Prompt 01 — QR + Mobile GPS Clock-In (hardver nélkül)

**Beat:** e-lock.hu / Kelio
**Cél:** Felzárkózni e-lock biometrikus terminál-élményéhez **fizikai hardver-vásárlás nélkül**, mobil + QR kombóval.
**Effort:** M (4–6 hét)
**Anti-regression:** ne érintse a meglévő `enterprise_time_attendance_*` táblákat, csak új capture-mechanizmust adjon hozzá.

## User story

> Mint vendéglátós/építőipari/retail manager szeretném, hogy a dolgozóim hardver (terminál) nélkül, a saját telefonjukon, **csak a munkahelyen** be tudjanak jelentkezni — geofence + dinamikus QR-kód kettős validációval, GDPR-megfelelően.

## Acceptance criteria

1. **Workspace setting** "QR/GPS clock-in" toggle (opt-in), location-list (cím → lat/lng + sugár méterben).
2. **Mobile app (Capacitor):** "Bejelentkezés" gomb → GPS-pozíció lekérés → ha a workspace-helyszín X méteres körén belül van, beolvasható a helyszínen kifüggesztett rotating QR (15 mp-enként frissül).
3. **Validáció:** geofence + QR-token + timestamp. Mind3 hibája esetén block + fail-event.
4. **Audit log:** `enterprise_clock_in_attempts` új tábla, RLS-protected (csak workspace admin lát).
5. **GDPR-consent banner** első használatkor a mobil app-ban: "GPS-koordinátád csak a clock-in pillanatában dolgozzuk fel, nem tároljuk folyamatosan."
6. **Fallback:** ha a GPS nem elérhető, csak QR-rel is megy, de manager-aprovel kell hozzá.

## Anti-regression

- Ne nyúlj a `enterprise_time_attendance_records`-hoz, csak új `enterprise_clock_in_attempts` táblát hozz létre + INSERT trigger ami az approved attempts-ből csinálja a record-ot.
- Lokalizáció: HU + EN.

## Telemetry

`clock_in.qr_attempted`, `clock_in.geofence_failed`, `clock_in.success`.

## Marketing claim

*"Effectime hardver nélkül adja meg a vendéglátós/építőipari clock-in megbízhatóságát — geofence + QR + mobil, GDPR-megfelelően."*
