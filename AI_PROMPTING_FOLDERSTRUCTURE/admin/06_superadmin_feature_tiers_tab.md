# 06 — Superadmin Feature & Tier Management (`/superadmin` → Tiers tab)

> **Supersedes** `docs/tiering/superadmin_spec.md` (the original wireframe spec is preserved there for history but this is the authoritative prompt for AI dev sessions).

## Scope
- 135-feature catalog: list / search / module filter
- Tier × feature matrix (Freemium / Pro / Enterprise) with live toggle
- Addon × feature matrix with live toggle
- Routing / menu tab — drag-drop reordering, route_path / menu_path editing
- Feature detail dialog (dependency tree visualisation)

**Non-goals:** workspace-specific overrides (those live in `tenant_subscription_overrides`), tier price editing.

## Component tree
- `src/components/superadmin/FeatureTiersTab.tsx` (1158 LOC) — wired in `SuperadminControlPlane.tsx` as the `'tiers'` tab (Layers icon, lazy-mounted)
- Sub-views: Tiers matrix | Addons matrix | Routing/menu tree | Feature detail dialog (Eye icon)

## Data contract
| Operation | Source |
|---|---|
| feature list | `SELECT * FROM public.features ORDER BY module, key` |
| tier × feature | `public.tier_features (tier_id, feature_id)` — junction |
| addon × feature | `public.addon_features (addon_id, feature_id)` — junction |
| toggle on | `supabase.from('tier_features').insert({...})` |
| toggle off | `supabase.from('tier_features').delete().eq(...)` |
| routing edit | `UPDATE public.features SET route_path=..., menu_path=...` |
| audit on every change | `INSERT INTO platform_audit_events ...` |

CSV regeneration: `node scripts/build_tiering_csvs.mjs` — keeps `docs/tiering/tiers_matrix.csv` and `docs/tiering/pricing_matrix.csv` in sync.

## State machine
- Optimistic UI on every toggle; on error, revert + toast.
- Routing tree open/closed state persisted at `localStorage['routingTreeOpen:v3:<userId>:<tierId>']` — prefix-tagged keys (`page::<route>|menu::<seg>`) so locale switch does NOT collapse nodes.

## Security
- Superadmin only. The toggle endpoints MUST re-verify; client-side disabling is NOT sufficient.
- `tier_features` and `addon_features` tables have RLS policies that allow only superadmin writes; see `docs/tiering/rls_policies.md`.

## i18n — namespace `feature_tiers.*`
All user-facing strings exist in 5 locales (currently `en, hu, de, at, ro`). Czech / Slovak / Polish to be added — track in `AI_PROMPTING_FOLDERSTRUCTURE/localization_controller.md`.

## Audit-log
EVERY tier/addon toggle AND every routing edit writes `platform_audit_events`:
| Event | `action` | payload |
|---|---|---|
| Toggle feature on for tier | `superadmin.tier_feature.enable` | `{ tier_key, feature_key }` |
| Toggle feature off for tier | `superadmin.tier_feature.disable` | `{ tier_key, feature_key }` |
| Toggle for addon | `superadmin.addon_feature.enable\|disable` | `{ addon_key, feature_key }` |
| Routing edit | `superadmin.feature.routing_edit` | `{ feature_key, before, after }` |

## Acceptance
- 135 features visible, searchable, filterable by module.
- Toggle persists across reload + appears in audit log.
- Routing audit panel shows 3 hardcoded categories (missing `route_path`, whitespace menu segment, dependency violation).
- Tree open-state survives locale switch.

## Regression-protection
- **NEVER** remove the routing-audit warnings — they prevent the v3.15.0 "ghost menu" regression.
- The `__no_route__` key MUST stay decoupled from its display label (locale-switch bug).
- CSV drift: any change here MUST be followed by a `node scripts/build_tiering_csvs.mjs` run; CI gate planned in v3.52.x.

## Change log
- 2026-06-04 v3.49.11 — rewrote as authoritative prompt; legacy spec moved to "supersedes" reference.
