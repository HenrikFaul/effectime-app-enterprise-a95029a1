# Pozíciók és skill-elvárások

Két útvonal létezik pozíció hozzárendelésére:

1. **Egyéni címke** (megőrzött): bármilyen szöveg írható a pozíció mezőbe.
2. **Előre definiált katalógus**: nyisd meg a választót → kategória → pozíció → ajánlott skillek áttekintése → szenioritás → alkalmazás.

A katalógus munkaterület-szintű (`enterprise_workspace_role_categories`, `enterprise_workspace_roles`, `enterprise_workspace_role_skills`) és a globális katalógusból (`enterprise_catalog_*`) van seedelve.

## Skill öröklődés

Katalógus pozíció választása ajánlott skill-készletet csatol. Alapból a **kötelező** skillek be vannak pipálva; mentés előtt skillenként opt-in vagy opt-out választható. A skillek nyomon követéssel kerülnek a tagra (manuális vs katalógus-örökölt).

## Szenioritás

A szenioritás a tag-pozíció hozzárendelés tulajdonsága, nem a katalógus elemé. Elérhető szintek: junior, medior, senior, lead, principal.
