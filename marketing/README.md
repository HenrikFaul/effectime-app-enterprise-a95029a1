# Marketing Prompt Library for Effectime

This folder contains the first version of the marketing prompting library for Effectime. The purpose of the library is to help AI systems create a coherent B2B SaaS marketing operating system that is reusable, role-aware, channel-aware, and aligned with the product’s real value.

Effectime should be marketed primarily as a solution that makes the daily lives of leaders, managers, employees, HR, and operations teams easier by reducing operational chaos, improving clarity, and reducing administrative friction.

## What this starter package contains

- `marketing/SYSTEM.md` — the global controller and routing logic.
- `marketing/strategy/positioning_masterprompt.md` — master prompt for positioning, messaging, audience, differentiation, and outcome-based framing.
- `marketing/content/linkedin_content_masterprompt.md` — master prompt for founder-led LinkedIn content and expert authority building.
- `marketing/visual/visual_direction_controller.md` — master prompt for visual art direction and campaign/website creative alignment.
- `marketing/MASTERFILE.json` — machine-readable routing file for AI systems and frontend help-menu style tooling.

## Recommended usage order

1. Start with `SYSTEM.md`.
2. Use `strategy/positioning_masterprompt.md` to define positioning and messaging.
3. Use `content/linkedin_content_masterprompt.md` to build the founder/content engine.
4. Use `visual/visual_direction_controller.md` to create visual systems that match the messaging.
5. Use `MASTERFILE.json` to let AI or frontend tools understand which files are responsible for what.

## Suggested future expansion

The next files that should probably be added are:
- `marketing/strategy/go_to_market_masterprompt.md`
- `marketing/strategy/channel_strategy_masterprompt.md`
- `marketing/content/seo_article_masterprompt.md`
- `marketing/content/case_study_masterprompt.md`
- `marketing/website/homepage_masterprompt.md`
- `marketing/campaigns/linkedin_ads_masterprompt.md`
- `marketing/sales/one_pager_masterprompt.md`
- `marketing/governance/content_quality_checklist.md`

## Working philosophy

This library should not produce random campaign ideas in isolation. It should produce connected outputs where:
- strategy informs messaging,
- messaging informs content,
- content informs visuals,
- visuals support campaigns,
- and all of the above can be reused in a growing AI prompt system.
