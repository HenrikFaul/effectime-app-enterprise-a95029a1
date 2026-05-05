# Localization

Effectime supports English and Hungarian out of the box. The active language is selected via the circular flag in the header.

- **Per user**: stored in `profiles.preferred_locale`. Honoured at sign-in.
- **Per workspace**: optional default in `enterprise_workspaces.default_locale` (admin-managed; configuration UI in a future release).
- **Fallback chain**: user → workspace → browser → English.

The Settings → Localization page lists enabled languages, marks the workspace default, and reports missing-key counts. Adding a third language is a configuration change — bundle a new resource file under `src/i18n/resources/<locale>.ts` and register it in `src/i18n/locales.ts`.
