# Szervezet

A Szervezet modul a hierarchia, vezetés, szerződések, iparági besorolás, munkakategóriák és munkacsaládok hivatalos forrása. A munkaterületen belüli **Szervezet** fülről érhető el.

## Alfülek

| Fül | Cél |
|---|---|
| Felépítés | Szervezeti egységek fája (divíziók, osztályok, csapatok). |
| Vezetés | Vezetői szintek katalógusa (Stratégiai, Operatív, Technikai, Végrehajtó). |
| Szerződések | Szerződéses viszonyok (alkalmazott, vállalkozó stb.). |
| Iparág | Munkaterület iparági / tevékenységi besorolás. |
| Munkakategóriák | Kontrollált szótár a platform többi részén. |
| Munkacsaládok | Rokon pozíciók csoportosítása analitikához. |
| Szervezeti diagram | Vezetői kapcsolatokból generált diagram. |

## Alapértelmezések betöltése

A **Vezetés** és **Szerződések** alatt is van *Seed defaults* gomb, ami létrehozza a standard katalógust. Ezután egyéni elemek hozzáadhatóak vagy archiválhatóak.

## Szervezeti diagram

A diagram az `enterprise_memberships.manager_id` mezőből generálódik. A keresővel szűrhetsz; a **Pillanatkép újragenerálása** gomb az aktuális állapotot az `enterprise_org_chart_snapshots` táblába menti gyorsabb későbbi betöltéshez. A hierarchiabeli ciklusokat adatbázis-szinten tiltjuk.
