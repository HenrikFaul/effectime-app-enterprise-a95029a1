# Effectime Marketing Prompt System

This file is the global controller for the `marketing/` prompting library. It defines the operating model, routing rules, output expectations, and quality bar for all marketing-related AI work for Effectime.

Effectime must not be positioned as just another HR software tool. It should be positioned as a practical B2B SaaS solution that makes the daily lives of leaders, managers, employees, HR, and operations teams easier, clearer, and less chaotic.

## Core mission

The purpose of this library is to help AI systems produce a complete marketing operating system for Effectime, including:
- positioning,
- messaging,
- content,
- campaign planning,
- website conversion copy,
- visual art direction,
- sales enablement,
- and measurement logic.

All prompts in this library must translate product capabilities into business outcomes such as saved time, lower administrative burden, fewer mistakes, better visibility, better coordination, more accountability, smoother onboarding, and less managerial confusion.

## Global routing rules

Use this file first, then route to the most relevant specialist file.

### Routing priority
1. Strategy and product-to-market framing -> `marketing/strategy/positioning_masterprompt.md`
2. Organic thought leadership and expert content -> `marketing/content/linkedin_content_masterprompt.md`
3. Visual campaign system, brand direction, and design prompts -> `marketing/visual/visual_direction_controller.md`
4. Cross-library discovery and orchestration -> `marketing/MASTERFILE.json`

## Positioning doctrine

Always describe Effectime as an operational improvement system before describing it as software.

Preferred framing directions:
- a SaaS solution for reducing operational chaos,
- a system for making workforce coordination clearer,
- a way to reduce hidden HR/admin friction,
- a tool that gives leaders and teams better visibility and less follow-up burden,
- a platform that turns scattered people operations into clear workflows.

Avoid defaulting to:
- generic feature lists,
- category clichés,
- empty transformation language,
- startup hype language,
- vague AI claims that are not tied to operational outcomes.

## Channel doctrine

Default channel priority unless a prompt explicitly asks for something else:
1. Website messaging and conversion architecture
2. Founder-led LinkedIn content
3. SEO and pain-driven educational content
4. Sales enablement materials
5. Retargeting
6. LinkedIn paid campaigns
7. Email nurture
8. Events, webinars, and partnerships
9. Experimental or guerrilla tactics
10. Facebook or Instagram only if there is a clearly justified objective

### Facebook and Instagram rule
Do not recommend Facebook or Instagram as default primary channels for Effectime.
Only recommend them when one of these is true:
- retargeting website traffic,
- supporting employer-brand style familiarity,
- reinforcing campaign recall with simple proof creatives,
- promoting events or gated assets to tightly defined audiences.

If either channel is recommended, always explain:
- exact audience,
- campaign objective,
- expected creative format,
- funnel stage,
- and why the channel is worth testing.

## Founder-led growth doctrine

The founder should be positioned as a practical expert, not as a motivational influencer.

Founder content should:
- explain real workplace friction,
- expose hidden costs of manual processes,
- teach better operational habits,
- show patterns leaders and HR teams often miss,
- and connect these lessons back to Effectime only after value has been established.

## Output quality bar

Every output must be:
- specific,
- practical,
- B2B credible,
- outcome-driven,
- reusable,
- visually coherent,
- and easy for a non-marketer founder to use.

Every substantial asset should connect:
- audience,
- pain,
- desired outcome,
- message,
- proof,
- CTA,
- and distribution channel.

## Required output sections for major tasks

When asked for a major marketing plan or prompt output, produce:
1. Strategic objective
2. Audience definition
3. Pain and desired outcome map
4. Message architecture
5. Recommended channels and priority order
6. Asset list
7. Written asset guidance
8. Visual asset guidance
9. CTA and funnel logic
10. Measurement notes

## Integration with the rest of the prompt library

This marketing system should be used alongside the broader repository prompting structure. It should be able to read product context from product, frontend, ux, docs, or governance materials and convert that context into marketing-ready assets.

## Guardrails

Never:
- reduce Effectime to feature marketing,
- suggest random trendy campaigns without business logic,
- create disconnected visuals and copy,
- recommend vanity content without pipeline or trust-building value,
- produce generic “revolutionize your workflow” copy,
- or position the product in a way that sounds like every other HR platform.
