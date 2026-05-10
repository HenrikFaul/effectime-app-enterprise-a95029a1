# Effectime Enterprise – Szerepkör–jogosultság mátrix

<!-- METADATA -->
| Mező | Érték |
|---|---|
| Dokumentum | ROLE_PERMISSION_MATRIX.md |
| Generálva | 2026-05-10T12:00:00Z |
| Repozitórium | HenrikFaul/effectime-app-enterprise-a95029a1 |
| Branch | claude/create-software-documentation-O7kj1 |
| Revision | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| Megbízhatóság | Magas |
| Kapcsolódó dok. | FEATURE_CATALOG.md, BUSINESS_SYSTEM_REFERENCE.md |

---

## Szerepkörök definíciója

| Role value | Label (HU) | Leírás |
|---|---|---|
| `owner` | Tulajdonos | Teljes hozzáférés; törölheti a workspace-t, meghívhat, jóváhagyhat, konfigurálhat |
| `resourceAssistant` | Erőforrás asszisztens | Admin szintű hozzáférés a legtöbb funkcióhoz; nem törölheti a workspace-t |
| `member` | Tag | Korlátozott, olvasási szintű hozzáférés; saját szabadságkérelmeket kezelhet |

**Admin definíció a kódban:**
```typescript
const isAdmin = role === 'owner' || role === 'resourceAssistant'
```

---

## Permission kulcsok referenciája

### `canView(key)` kulcsok

| Permission kulcs | Leírás |
|---|---|
| `members` | Tagok tab és szervezet megjelenítése |
| `calendar` | Naptár tab megjelenítése |
| `calendar_leave_days` | Szabadságnapok megjelenítése a naptárban |
| `calendar_coverage` | Kapacitástervező megjelenítése |
| `calendar_requests` | Kérelmek megjelenítése a naptárban |
| `calendar_conflicts` | Ütközések megjelenítése |
| `requests_own` | Saját kérelmek megtekintése |
| `requests_team` | Csapat kérelmeinek megtekintése |
| `approvals` | Jóváhagyó inbox megjelenítése |
| `rules` | Szabálykonfiguráció megjelenítése |
| `reports` | Riportok megtekintése |
| `audit` | Audit napló megtekintése |
| `export` | Export funkció elérése |
| `settings` | Beállítások tab elérése |

### `canEdit(key)` kulcsok

| Permission kulcs | Leírás |
|---|---|
| `invitations` | Tagok meghívása |
| `leave_requests_submit` | Szabadságkérelem beküldési jog |
| `admin_override` | Admin felülbírálat jog |
| `permission_config` | Jogosultság-konfiguráció szerkesztése |
| `layout_setting` | UI elrendezés beállítása |

---

## Fő jogosultság mátrix

### Funkciók vs. szerepkörök

| Funkció / Kategória | owner | resourceAssistant | member |
|---|:---:|:---:|:---:|
| **Tagok tab megtekintése** | ✅ | ✅ | ❌ |
| **Tagok meghívása** | ✅ | ✅ | ❌ |
| **Tag szerkesztése** | ✅ | ✅ | ❌ (csak saját profil) |
| **Tag deaktiválása** | ✅ | ✅ | ❌ |
| **Tag szerepkörének változtatása** | ✅ | ❌ | ❌ |
| **Workspace törlése** | ✅ | ❌ | ❌ |
| **Szervezet tab megtekintése** | ✅ | ✅ | ❌ |
| **Org chart megtekintése** | ✅ | ✅ | ✅ (inferred) |
| **Szervezeti struktúra szerkesztése** | ✅ | ✅ | ❌ |
| **Naptár tab megtekintése** | ✅ | ✅ | ✅ |
| **Saját szabadságok a naptárban** | ✅ | ✅ | ✅ |
| **Csapat szabadságai a naptárban** | ✅ | ✅ | ❌ (inferred) |
| **Kapacitástervező megtekintése** | ✅ | ✅ | ❌ (inferred) |
| **Saját kérelem beküldése** | ✅ | ✅ | ✅ |
| **Saját kérelmek megtekintése** | ✅ | ✅ | ✅ |
| **Csapat kérelmeinek megtekintése** | ✅ | ✅ | ❌ |
| **Jóváhagyó inbox** | ✅ | ✅ | ❌ |
| **Jóváhagyás / elutasítás** | ✅ | ✅ | ❌ |
| **Admin felülbírálat** | ✅ | ✅ | ❌ |
| **Szabályok konfigurálása** | ✅ | ✅ | ❌ |
| **Jóváhagyási lánc szerkesztése** | ✅ | ✅ | ❌ |
| **Folyamatok (Workflows) tab** | ✅ | ✅ | ❌ |
| **Onboarding feladatok megtekintése** | ✅ | ✅ | ✅ (saját) |
| **Onboarding sablonok szerkesztése** | ✅ | ✅ | ❌ |
| **Erőforrások tab megtekintése** | ✅ | ✅ | ✅ |
| **Projektek megtekintése** | ✅ | ✅ | ✅ |
| **Projektek szerkesztése** | ✅ | ✅ | ❌ (inferred) |
| **Agile tábla megtekintése** | ✅ | ✅ | ✅ |
| **Issue writeback** | ✅ | ✅ | ❌ (inferred) |
| **Kapacitás-hiány riport** | ✅ | ✅ | ✅ |
| **Riportok megtekintése** | ✅ | ✅ | ❌ |
| **Riport export** | ✅ | ✅ | ❌ |
| **Audit napló megtekintése** | ✅ | ✅ | ❌ |
| **Beállítások tab elérése** | ✅ | ✅ | ❌ |
| **Általános beállítások szerkesztése** | ✅ | ✅ | ❌ |
| **Jogosultságok konfigurálása** | ✅ | ❌ | ❌ |
| **Branding szerkesztése** | ✅ | ❌ (inferred) | ❌ |
| **Integrációk kezelése** | ✅ | ✅ | ❌ |
| **Help rendszer kezelése** | ✅ | ❌ (inferred) | ❌ |
| **Értesítési preferenciák (saját)** | ✅ | ✅ | ✅ |
| **Helyreállítási mód kezelése** | ✅ | ❌ (inferred) | ❌ |

---

## canView() permission kulcs mátrix

| canView(key) | owner | resourceAssistant | member | Megj. |
|---|:---:|:---:|:---:|---|
| `members` | ✅ | ✅ | ❌ | Tab láthatóság: Tagok, Szervezet, Folyamatok |
| `calendar` | ✅ | ✅ | ✅ | Naptár tab alapja |
| `calendar_leave_days` | ✅ | ✅ | ✅ (saját) | Szabadságnapok a naptárban |
| `calendar_coverage` | ✅ | ✅ | ❌ (inferred) | Kapacitástervező |
| `calendar_requests` | ✅ | ✅ | ✅ (saját) | Kérelmek a naptárban |
| `calendar_conflicts` | ✅ | ✅ | ❌ (inferred) | Ütközés megjelenítés |
| `requests_own` | ✅ | ✅ | ✅ | Kérelmek tab feltétele |
| `requests_team` | ✅ | ✅ | ❌ | Csapat kérelmek |
| `approvals` | ✅ | ✅ | ❌ | Jóváhagyó inbox |
| `rules` | ✅ | ✅ | ❌ | Szabályok szekció |
| `reports` | ✅ | ✅ | ❌ | Riportok tab feltétele |
| `audit` | ✅ | ✅ | ❌ | Audit tab feltétele |
| `export` | ✅ | ✅ | ❌ | Export center |
| `settings` | ✅ | ✅ | ❌ | Beállítások tab |

---

## canEdit() permission kulcs mátrix

| canEdit(key) | owner | resourceAssistant | member | Megj. |
|---|:---:|:---:|:---:|---|
| `invitations` | ✅ | ✅ | ❌ | Tag meghívás jog |
| `leave_requests_submit` | ✅ | ✅ | ✅ | Kérelem beküldés (Kérelmek tab feltétele) |
| `admin_override` | ✅ | ✅ | ❌ | Admin felülbírálat |
| `permission_config` | ✅ | ❌ | ❌ | Jogosultságok szerkesztése |
| `layout_setting` | ✅ | ✅ (inferred) | ❌ | UI elrendezés |

---

## Tab láthatóság összefoglalója

| Tab | owner | resourceAssistant | member | Feltétel |
|---|:---:|:---:|:---:|---|
| Tagok | ✅ | ✅ | ❌ | `canView('members')` |
| Szervezet | ✅ | ✅ | ❌ | `canView('members')` |
| Naptár | ✅ | ✅ | ✅ | `canView('calendar')` |
| Kérelmek | ✅ | ✅ | ✅ | `canView('requests_own')` VAGY `canView('requests_team')` VAGY `canEdit('leave_requests_submit')` |
| Folyamatok | ✅ | ✅ | ❌ | `canView('members')` |
| Erőforrások | ✅ | ✅ | ✅ | Mindig látható |
| Riportok | ✅ | ✅ | ❌ | `canView('reports')` VAGY `canView('audit')` VAGY `canView('export')` |
| Beállítások | ✅ | ✅ | ❌ | `canView('settings')` |

---

## Megjegyzések

1. A permission rendszer konfigurálható a `RolePermissionManager`-ben — az alapértelmezett értékeket az owner módosíthatja.
2. A `member` szerepkör jogosultságai részben finomhangolhatók workspace-szinten (pl. egyes `canView` kulcsok engedélyezhetők).
3. Az `inferred` jelölés azt jelenti, hogy a konkrét implementáció nem volt közvetlenül a kódbázisból olvasható; a logika az architektúrából következtethető.
4. Az `isAdmin` flag (owner OR resourceAssistant) számos helyen egyszerűsíti a jogosultság-ellenőrzést.
