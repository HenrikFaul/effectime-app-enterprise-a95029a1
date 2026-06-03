# Prompt 06 — Drag-and-drop scheduler with live conflict detection

**Gap source:** Resource Guru, When I Work, Deputy
**Effort:** L · **Strategic value:** Critical (parity gap)

## Problem
*"Megnyitottam az Effectime-ot, és nem tudtam egyszerűen áthúzni egy műszakot egyik napról a másikra. A Resource Guru-ban ez egy húzás-és-elenged, és azonnal pirosra váltik, ha ütközés van."*

## User story
Mint beosztó, drag-and-drop módon szeretném áthelyezni a műszakokat a Gantt-szerű naptáron. Ha az áthelyezés ütközést okoz (pihenőidő megsértése, szabadság-átfedés, képesítés hiány), azonnal piros highlight + tooltip jelzi, és lehet "force"-olni admin engedéllyel.

## Acceptance criteria
- [ ] HTML5 drag API (vagy dnd-kit) implementálva a meglévő `CapacityPlanner` komponensen
- [ ] Élő konfliktus-detektálás client-side (instant feedback, <50ms)
- [ ] Server-side újraellenőrzés a mentésnél (race-condition védelem)
- [ ] Konfliktus típusok: szabadság-átfedés, max munkaóra, pihenőidő, képesítés, multi-assignment
- [ ] "Force save" admin-only flow, kötelező indoklással → audit log
- [ ] Undo (Ctrl+Z) az utolsó 20 művelethez
- [ ] Mobile: long-press → drag, vagy "Move to" modal alternatíva
- [ ] Optimistic UI update + rollback ha a server elutasít

## Anti-regression
- Meglévő beosztás-listanézet és kanban változatlan marad
- A Gantt teljesítménye 500+ shift / hét esetén is <100ms render

## Telemetry
- `scheduler.drag_completed`, `scheduler.conflict_detected{type}`, `scheduler.force_save_used`, `scheduler.undo_used`

## Marketing claim
*"Tervezz műszakot úgy, mint egy Trello-board: húzd, dobd, kész — az Effectime azonnal jelzi, ha bármi ütközik."*

## Out of scope
- AI-alapú auto-scheduling (külön prompt #09)
- Multi-week bulk drag (későbbi iteráció)
