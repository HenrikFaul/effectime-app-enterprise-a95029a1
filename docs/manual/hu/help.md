# Kontextusfüggő súgó

A Súgó kontroll a fejléc **bal** oldalán lévő kérdőjel-ikon.

Megnyitáskor a jobb oldalon (mobilon teljes képernyős) panel jelenik meg, amely tartalmazza:

- A jelenlegi szakasz **címét**.
- A szakasz **rövid leírását**.
- A most elvégezhető **gyakori feladatok** listáját.
- A jelenlegi pozíciót tükröző breadcrumb-csip sort.

A súgópanel megnyitásakor az oldalon a hozzá tartozó terület halvány gyűrűvel kiemelődik kb. 1.2 másodpercig (a `prefers-reduced-motion` beállítást tiszteletben tartva). Minden oldal regisztrálja a súgóhorgonyát a `useHelpAnchor(...)` hookkal — jelenleg szállított horgonyok: `home.overview`, `workspace.members`, `workspace.organization`, `workspace.calendar`, `workspace.approvals`, `settings.localization`.

A súgótartalom az i18n resource bundle-ekben él `help.anchors.<id>` alatt, és kétnyelvű első naptól.
