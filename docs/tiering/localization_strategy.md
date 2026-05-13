# Phase 12 — Localization Strategy

## Vezérelv (CLAUDE.md kötelező)

Minden user-facing string i18n key-en keresztül, **5 nyelvű paritással ugyanazon commitban**: `en`, `hu`, `cs`, `sk`, `pl`. A `hu` az elsődleges nyelv (üzleti DNS), de a fejlesztés `en`-ben rögzíti az új kulcsokat először, mert ez a "default fallback" a bundle-lookup-ban.

## Kulcs-struktúra

```
namespace.subnamespace.key

pl.
  feature_tiers.tab_tiers
  feature_tiers.tree_missing_prereq
  create_workspace.tier_label
  feature_gate.locked_title
```

**Konvenciók:**
- snake_case minden kulcsban
- top-level namespace = feature / oldal (pl. `feature_tiers`, `create_workspace`, `ws_nav`)
- a `common.*` minimalista — csak valóban általános fogalmak (`common.save`, `common.cancel`, `common.description`)
- interpoláció: `{{varName}}` — i18n-Provider `interpolate()` resolve-ja

## Forrás és perzisztencia

| Réteg | Hol | Mikor |
|-------|-----|-------|
| Statikus bundle | `src/i18n/resources/{en,hu,cs,sk,pl}.ts` | Build-time, részé a JS bundle-nek |
| Workspace override | `enterprise_workspace_translations` tábla | Runtime, `loadWorkspaceOverrides(workspaceId)` |
| Fallback chain | Active locale override → active bundle → default-locale override → default bundle → key string | Resolution order in `I18nProvider.t()` |

## Hozzáadott v3.15.0 namespace-ek

| Namespace | Kulcsok száma | Forrás |
|-----------|---------------|--------|
| `feature_tiers.*` | 50+ | `FeatureTiersTab.tsx` v3.15.0 refaktor |
| `feature_gate.*` | 2 | `LockedFeatureNotice.tsx` |
| `create_workspace.tier_*` | 3 | Tier-aware workspace creation |

## Fallback magatartás

A `t(key)` resolver order:

1. Workspace-szintű override az aktív locale-ben
2. Statikus bundle az aktív locale-ben
3. Workspace-szintű override a default locale-ben (`en`)
4. Statikus bundle a default locale-ben
5. Magát a key-t visszaadja + DEV módban `console.warn`-ol

Ez biztosítja, hogy egy fél-lokalizált új feature is sose dob hibát; a hiányzó `hu` kulcs az `en` szöveget mutatja `hu` userek számára, jelezve a fordítás-igényt.

## i18n parity teszt

`src/test/i18n.localization.test.ts` minden CI futáson:

- Minden `en` kulcs szerepel `hu`-ban (és viszont) — `flatten()` lapított key-set diff
- Sem `en` sem `hu` bundle nem üres kulccsal — silent fallback gap megelőzése
- Min. 100 top-level kulcs — accidental deletion guard

A `cs/sk/pl` jelenleg "lazy parity" — nem hibázik, ha hiányzik, mert a fallback chain az `en`-re esik vissza.

## Language selector UX

**Recommendation:** workspace-szintű választó a `WorkspaceSettings` lapon (`Settings > Általános > Nyelv`), nem globális header-ben.

**Indok:**
- Egy felhasználó több workspace-nek tagja lehet (multi-tenant); a nyelv-preferencia gyakran a workspace business kontextusa szerint változik (pl. multi-country szervezet).
- A globális header-választó konfliktust okozna a workspace-szintű override-okkal.
- A profil-szintű `preferred_locale` (a `profiles` táblában) marad a default-locale-fallback, ha workspace-szintű override nincs.

## Backend perzisztencia

`profiles.preferred_locale` (text, nullable) — minden user `setLocale()` hívás után megpróbálja perzisztálni (silent on error, így a kolumn hiánya nem dob).

## Translation workflow (CLAUDE.md követelmény)

Minden új user-facing string commitja:

1. **Author en** — `src/i18n/resources/en.ts`-be írni a kulcsot
2. **Translate hu** — kötelező, ugyanabban a commitban
3. **Translate cs/sk/pl** — javasolt, de a fallback miatt nem hard requirement (megengedett egy follow-up PR-ban)
4. **Wire via `useI18n().t(key)`** — komponensben hardcode nincs
5. **i18n.localization.test futtatása** — `npm run test`

## User manual i18n status

| Doc | EN | HU | CS | SK | PL | Megjegyzés |
|-----|----|----|----|----|----|----|
| User manual main | ✗ | ✗ | ✗ | ✗ | ✗ | Nincs külön user manual; help drawer chunks-okra van bontva (`enterprise_help_chunks` táblában) |
| Help drawer (in-product) | részben | igen | részben | részben | részben | `help_drawer` feature, lokalizált `enterprise_help_chunks` rekordok |
| Tier matrix (a docs/tiering/) | igen | igen | — | — | — | Magyar-elsődleges, EN tag-ekkel |

## Hátralévő lokalizációs munkák

Lásd `docs_tasks.md` (Phase 12 másik fele).
