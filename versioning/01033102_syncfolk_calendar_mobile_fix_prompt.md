# Syncfolk AI fejlesztési prompt

Azonosító: **01033102**
Verzió: **01**
Tárgy: **Event calendar dátumválasztó mobilos javítás - csak célzott hotfix**

## Forrás üzleti kérés kivonata
- Csak egy hibát szabad javítani.
- A Syncfolk esemény részletező / szerkesztő felületén a dátumválasztó naptár mobilon nem megfelelő helyen jelenik meg.
- A naptárnak mobilon mindig a képernyő közepén kell megjelennie.
- Az OK / megerősítő gombnak mindig látszódnia és használhatónak kell maradnia.
- Semmilyen más, már működő funkciót nem szabad rontani.
- A változtatás legyen minimális, célzott, regressziókerülő.
- A changelogot frissíteni kell, és hivatkozni kell erre a versioning fájlpárra.

## Kötelező fejlesztési szabályok
1. Fejlesztés előtt olvasd be a `CHANGELOG.md` fájlt.
2. Keresd meg a `codingLessonsLearnt.md` vagy azonos célú lessons learnt fájlt. Ha nincs a repóban, ezt külön jelezd a szállításban.
3. Csak a hiba által érintett komponensekhez nyúlj.
4. A korábban már jól működő mobilos középre igazított date picker logikát használd újra, ne találj ki eltérő megoldást.
5. Az OK gomb explicit módon maradjon a flow része.
6. A megoldás legyen reszponzív és viewport-biztos.
7. Fejlesztés végén builddel ellenőrizd, hogy a kód lefordul.
8. Csak a módosított fájlokat add vissza.

## Javasolt technikai megoldás
- Az `EventInfoModal` dátumszerkesztő részében a nyers `Popover + Calendar` megoldást cseréld le a már létező `DatePopoverField` komponens használatára.
- Tartsd meg a meglévő üzleti logikát:
  - kezdő dátum választása után az end date igazodjon, ha szükséges;
  - a második mező ne engedjen a kezdő dátumnál korábbi dátumot;
  - az egyik naptár megnyitásakor a másik záródjon.
- Ne módosíts más modalt, más popovert, vagy egyéb dátumkezelési logikát, hacsak nem feltétlenül szükséges a forduláshoz.

## Szállítási checklist
- [ ] `CHANGELOG.md` beolvasva
- [ ] `codingLessonsLearnt.md` ellenőrizve / hiánya jelezve
- [ ] csak célzott hotfix készült
- [ ] mobilon középre kerül a calendar popup
- [ ] OK gomb látszik és működik
- [ ] meglévő funkciók nem sérültek
- [ ] build sikeres
- [ ] changelog hivatkozik erre a versioning fájlpárra
