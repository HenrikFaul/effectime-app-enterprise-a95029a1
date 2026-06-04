# AGENTS.md

## Read order
1. `.governance/controller.md`
2. `.governance/execution_authority_and_automation_rules.md`
3. `.governance/codingLessonsLearnt.md`
4. `.governance/ui_ux_rules.md` when UI is affected
5. `AI_PROMPTING_FOLDERSTRUCTURE/admin/00_INDEX.md` when ANY admin or superadmin surface is touched
6. `CHANGELOG.md` and latest versioning artifacts
7. `SEO/11_AUTO_INDEXABILITY_GUARDIAN.md` — AUTO-LOAD at session start AND session end whenever routes, `index.html`, `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, `src/components/seo/SeoHead.tsx`, or any pillar page is touched. Run its §6 audit and write `SEO/outputs/11_indexability_guardian_output.md`.

## Operating rule
Treat clear user requests as execution instructions.
If GitHub, changelog, governance, or documentation updates are the natural next step, perform them without separate permission unless the action is destructive, external, production-affecting, or security-sensitive.

## Non-negotiable
- Never break already working functionality.
- Prefer the smallest regression-risk solution.
- Re-check affected flows after every change.
