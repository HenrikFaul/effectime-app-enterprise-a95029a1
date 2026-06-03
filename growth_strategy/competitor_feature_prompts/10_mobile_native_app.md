# Prompt 10 — Native mobile app (productise Capacitor wrapper)

**Gap source:** Minden major versenytárs (Absentify, Vacation Tracker, Deputy, When I Work, Humanforce)
**Effort:** M · **Strategic value:** Critical

## Problem
*"A fiataloknak nem küldök emailt szabadságjóváhagyásra. Ha nincs app, nem fognak válaszolni. A Vacation Trackernek és a Deputynak van iOS és Android appja — miért nincs az Effectime-nak?"*

## Háttér
A repo már tartalmaz `capacitor.config.ts`-t, tehát a Capacitor wrapper alapja létezik. Ezt productizálni kell, kiadni az App Store + Play Store-ba.

## User story
Mint munkavállaló, le szeretném tölteni az Effectime appot iPhone/Android telefonomra, push notifikációt kapni a beosztásváltozásról és szabadság-jóváhagyásról, és offline is látni a következő 14 nap beosztásomat.

## Acceptance criteria
- [ ] iOS build (TestFlight → App Store) publishelve "Effectime" néven
- [ ] Android build (Internal testing → Play Store)
- [ ] Push notifikációk: shift assigned/changed, leave approved/rejected, swap request
- [ ] Offline cache: legközelebbi 14 nap beosztás, saját szabadság-balance
- [ ] Biometric login (Face ID / fingerprint)
- [ ] Deep linking: `effectime://w/<workspaceId>/shifts/<shiftId>`
- [ ] App icon, splash screen, store screenshots HU + EN
- [ ] App Store + Play Store leírás SEO-optimalizálva
- [ ] Auto-update CI/CD (EAS Build vagy Fastlane)

## Anti-regression
- A web app marad az elsődleges platform, az app csak wrapper
- Új feature mindig web-first, mobile követi (max. 1 sprint csúszással)

## Telemetry
- `mobile.app_opened`, `mobile.push_received`, `mobile.push_opened`, `mobile.offline_used`

## Marketing claim
*"Vidd a beosztást a zsebedben — Effectime mobil app iOS-re és Android-ra, push notifikációval és offline nézettel."*

## Out of scope
- Apple Watch / Wear OS extension (későbbi)
- Mobile-only featúrák (GPS clock-in → külön prompt #15)
