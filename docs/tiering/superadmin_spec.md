# Superadmin UI Spec — Phase 8

> **⚠️ SUPERSEDED (v3.49.11):** The authoritative deep technical prompt for the Feature & Tier Management tab is now `AI_PROMPTING_FOLDERSTRUCTURE/admin/06_superadmin_feature_tiers_tab.md`. This file is kept for historical wireframes only. Do not extend it — extend the new prompt instead.


## Implementáció

Új tab a meglévő Superadmin Control Plane-ben, **a meglévő funkciók
megőrzésével**.

**Fájl:** `src/components/superadmin/FeatureTiersTab.tsx`
**Wiring:** `src/components/superadmin/SuperadminControlPlane.tsx` — új
`'tiers'` tab (Layers ikon) regisztrálva, lazy-mount.

## Funkciók (élő)

- 135 feature listázása modul + keresés szűréssel
- Tier × feature mátrix (Freemium/Pro/Enterprise) checkbox-ok élő toggle-lel
- Addon × feature mátrix élő toggle-lel
- Optimista UI a `supabase.from('tier_features').insert/delete` hívásokkal

## v3.15.0 frissítések

- **i18n teljes** — minden user-facing string `feature_tiers.*` namespace alatt 5 nyelven.
- **Audit trail** — minden tier/addon toggle ÉS routing edit `platform_audit_events`-be ír.
- **Stable tree state** — `routingTreeOpen:v3:<userId>:<tierId>` localStorage namespace, prefix-tagged keys (`page::<route>|menu::<seg>`); a `__no_route__` key decoupled a display label-től, így locale-váltás nem dob el nyitva-tartott node-okat.
- **Drift-safe CSV-k** — `scripts/build_tiering_csvs.mjs` regeneration.

## ASCII Wireframes (Phase 8 deliverable)

### Layout — Feature & Tier Management főképernyő

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ Superadmin > Feature & Tier Management                          [user▾] [⚙] ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                         ║
║ │ Tiers        │  │ Addons       │  │ Features     │                         ║
║ │      3       │  │      5       │  │     135      │                         ║
║ └──────────────┘  └──────────────┘  └──────────────┘                         ║
║                                                                              ║
║ 🔍 Szabadszöveges keresés (oldal / menü / funkció / útvonal)…           ▼   ║
║                                                                              ║
║ [⬛ Tiers]  [▢ Addons]  [▢ Útvonal / Menü]                                  ║
║                                                                              ║
║ Tier: [Freemium (freemium) ▾]      [ 41 / 135 funkció ]                     ║
║ ───────────────────────────────────────────────────────────────────────────  ║
║ 🔍 [Szűrés feature kulcs / név / leírás…           ]  [Modul ▾]              ║
║ ───────────────────────────────────────────────────────────────────────────  ║
║ ▌members_list │ Tagok listázása │ [members] [public]                 [⬛ ON] ║
║   Csapat-átláthatóság.                                                      ║
║   ⎇ Előfeltétel: Munkaterület létrehozása                                  ║
║   ▸ Erre épül: 24 funkció (members_invite, member_edit, …+18)              ║
║   ⌘ Útvonal: /app/team › Tagok                                              ║
║ ───────────────────────────────────────────────────────────────────────────  ║
║ ▌members_invite │ Tag meghívása │ [members] [public]               [⬛ ON]   ║
║   ⎇ Előfeltétel: Tagok listázása                                            ║
║   ▸ Erre épül: 1 funkció                                                    ║
║ ───────────────────────────────────────────────────────────────────────────  ║
║ … (görgetés, 41 row)                                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Layout — Routing / Menu tab

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ Tier szűrő: [Csak: Freemium (freemium) ▾]  [ 41 funkció ebben a tierben ]  ║
║                                                                              ║
║ ⚠ Routing audit — 3 hibakategória találat                                   ║
║   ▣ Hiányzó route_path  [3]    [ai_chat_assist] [help_regenerator] …        ║
║   ▣ Üres / whitespace menü szegmens [1]    [demo_workspace_seed]            ║
║                                                                              ║
║ 🔍 [Szűrés…]  [Modul ▾]                                                     ║
║ ───────────────────────────────────────────────────────────────────────────  ║
║ ▼ /app/team                                                            [8]  ║
║   ▼ Tagok                                                              [4]  ║
║     ⋮⋮ members_list      Tagok listázása        [members]   👁 ✎          ║
║     ⋮⋮ members_invite    Tag meghívása          [members]   👁 ✎          ║
║       ⚠ Hiányzó előfeltétel ebben a tierben: [members_list]                ║
║     ⋮⋮ member_edit       Tag adatainak szerk.   [members]   👁 ✎          ║
║   ▶ Beosztás                                                           [2]  ║
║   ▶ Pozíciók                                                           [2]  ║
║ ▼ /app/calendar                                                        [11] ║
║   ▼ Naptár                                                             [5]  ║
║     ⋮⋮ calendar_monthly  Havi naptár            [calendar]  👁 ✎          ║
║     …                                                                       ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Layout — Feature Detail dialog (gradient card view, Eye icon)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ Burnout & Wellbeing engine          [burnout_engine] [reports]          [X] ║
║ Wellbeing predikció — risk score / korai jel.                               ║
║                                                                              ║
║ ┌─────────────────────────────┐  ┌─────────────────────────────┐            ║
║ │ Útvonal (route_path)        │  │ Menü útvonal (menu_path)    │            ║
║ │ /app/reports/wellbeing      │  │ Riport › Wellbeing          │            ║
║ └─────────────────────────────┘  └─────────────────────────────┘            ║
║                                                                              ║
║ Routing-fa vizualizáció               [ Lefele ág megjelenítése ▾ ]         ║
║ ┌──────────────────────────────────────────────────────────────────────────┐ ║
║ │ ELŐFELTÉTEL · 2           ELŐFELTÉTEL · 1           AKTUÁLIS             │ ║
║ │ ┌──────────────┐          ┌──────────────┐         ┌──────────────────┐ │ ║
║ │ │ leave_submit │ ─►       │ leave_my_view│ ─►      │ burnout_engine   │ │ ║
║ │ │  [leave]     │          │  [leave]     │         │  [reports]       │ │ ║
║ │ └──────────────┘          ├──────────────┤         │ /app/reports/    │ │ ║
║ │                           │attendance_log│         │ wellbeing        │ │ ║
║ │                           │  [attendance]│         └──────────────────┘ │ ║
║ │                           └──────────────┘                              │ ║
║ └──────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║ Közvetlen előfeltételek: [leave_my_view] [attendance_log]                   ║
║ Erre épülő funkciók:    (nincs)                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Demo Workspace Creator (CreateWorkspaceDialog)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ Új munkaterület létrehozása                                              [X]║
║──────────────────────────────────────────────────────────────────────────────║
║ Név *                                                                        ║
║ ┌──────────────────────────────────────────────────────────────────────────┐ ║
║ │ pl. Marketing csapat                                                     │ ║
║ └──────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║ Leírás                                                                       ║
║ ┌──────────────────────────────────────────────────────────────────────────┐ ║
║ │ Opcionális leírás…                                                       │ ║
║ │                                                                          │ ║
║ │                                                                          │ ║
║ └──────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║ Előfizetési csomag (Tier)                                                    ║
║ ┌──────────────────────────────────────────────────────────────────────────┐ ║
║ │ Freemium                                                              ▾  │ ║
║ └──────────────────────────────────────────────────────────────────────────┘ ║
║ A munkaterület csak a kiválasztott csomaghoz tartozó funkciókat fogja látni.║
║                                                                              ║
║ ───────────────────────────────────────────────────────────────────────────  ║
║ ✨ Demo munkaterület                                                         ║
║ Valósághű munkaterületet hoz létre tagokkal, szabadságkérelmekkel…          ║
║ ┌──────────────────────────────────────────────────────────────────────────┐ ║
║ │  ✨ Demo munkaterület létrehozása                                         │ ║
║ └──────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║                              [Mégse]              [Létrehozás]               ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Locked feature notice (FeatureGate fallback)

```
                         ┌──────────────────────────────┐
                         │            🔒                │
                         │                              │
                         │ Ez a funkció nem szerepel    │
                         │  az előfizetésedben          │
                         │                              │
                         │ A(z) „executive_dashboard"   │
                         │ funkció zárolva van a jelen- │
                         │ legi előfizetési csomagodban.│
                         │ Lépj kapcsolatba a platform  │
                         │ adminisztrátorral az enge-   │
                         │ délyezéshez.                 │
                         └──────────────────────────────┘
```

## Backlog (még nem implementált, ld. backlog.md)

- **Tenant Assignment view**: tenant kiválasztás → tier dropdown → addons
  multiselect → save (megírja a `tenant_subscriptions`/`tenant_addons` rekordokat)
- **Tenant override editor**: tenant + feature + enabled bool + expires_at
- **Demo workspace creator** tier-select dropdown a workspace-create flow-ban
- **CSV import/export** a feature katalógusra
- **Audit timeline** tenantonként (subscription history + addon history)

## API contract (terv, jelenlegi RPC + table writes)

| Akció | Hívás |
|-------|-------|
| Feature list | `from('features').select('*')` |
| Tier→feature toggle | `from('tier_features').insert({tier_id,feature_id})` / `.delete()` |
| Tenant aktív feature-ök | `rpc('tenant_enabled_features', {_tenant_id})` |
| Tenant tier assign | `from('tenant_subscriptions').insert(...)` |
| Tenant addon assign | `from('tenant_addons').insert(...)` |
| Tenant override | `from('tenant_feature_overrides').upsert(...)` |
| Workspace → tenant | `rpc('tenant_id_for_workspace', {_workspace_id})` |
