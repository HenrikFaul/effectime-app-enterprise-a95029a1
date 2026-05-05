# Contextual help

The Help control is the question-mark icon on the **left** side of every header.

When opened, it shows a right-side drawer (or full-screen sheet on mobile) with:

- **Title** of the current section.
- **Summary** of what the section is for.
- **Common tasks** that you can do right now.
- A breadcrumb chip row mirroring your current location.

When the help drawer opens, the corresponding region on the page is highlighted with a soft ring for ~1.2 seconds (respecting `prefers-reduced-motion`). Each page registers a help anchor via `useHelpAnchor(...)` — anchors currently shipped: `home.overview`, `workspace.members`, `workspace.organization`, `workspace.calendar`, `workspace.approvals`, `settings.localization`.

Help content lives in the i18n resource bundles under `help.anchors.<id>` and is bilingual from day one.
