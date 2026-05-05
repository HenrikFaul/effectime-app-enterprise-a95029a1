# Nyelvi beállítások

Az Effectime alapból támogatja az angolt és a magyart. Az aktív nyelv a fejlécbeli kerek zászlóval választható.

- **Felhasználónként**: a `profiles.preferred_locale` mezőben tárolva. Bejelentkezéskor figyelembe vesszük.
- **Munkaterületenként**: opcionális alapérték az `enterprise_workspaces.default_locale` mezőben (admin által kezelt; konfigurációs UI későbbi kiadásban).
- **Fallback lánc**: felhasználó → munkaterület → böngésző → angol.

A Beállítások → Nyelvi beállítások oldal listázza az engedélyezett nyelveket, jelöli a munkaterület-alapértelmezést, és jelenti a hiányzó kulcsok számát. Új nyelv hozzáadása konfigurációs változás — adj hozzá egy resource fájlt `src/i18n/resources/<locale>.ts` alá, és regisztráld a `src/i18n/locales.ts`-ben.
