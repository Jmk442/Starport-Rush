# Requirements: Starport Rush

This is an Expo (React Native) mobile app requirement. iPhone portrait. Stage 1 only: build Level 1 and stop at the owner approval gate. Do NOT build Levels 2-5, publish, connect GitHub, or use paid services.

## Core Value
Build a premium casual iOS puzzle game called STARPORT RUSH: a directional traffic-clearing, passenger-sorting, limited-capacity puzzle in a colourful intergalactic spaceport. Same fundamental mechanics, visual richness, tactile satisfaction and strategic difficulty as Bus Traffic Fever! by GOODROID, but with original space-themed art, characters, sounds and branding. Offline, no backend, no login, no ads, no paid API.

## Features
The full original prompt (master prompt v1.0 + Technical Addendum v1.1) is the spec. It is stored verbatim at /app/memory/product/full_spec.md. Read it completely; it is authoritative.

Key points quoted from the user:
- "Replace every bus with an original miniature spaceship." Sizes: Scout Shuttle (capacity 4), Commuter Cruiser (6), Galaxy Transport (8). Each has white directional arrow, cockpit, engines, soft shadow.
- "Replace human passengers with tiny, colourful aliens." Winding terminal queue, batched rendering.
- Portrait layout: top ~30% alien terminal queue, ~15% docking stations (2-4), ~45% launch yard puzzle, ~10% controls (Undo, Restart, optional assistance, Settings). Safe-area aware.
- "The deterministic TypeScript game engine is the single source of truth." All actions go through a reducer producing new state, animation events, action result and undo/replay record.
- Colours: electric cyan, sunshine yellow, coral orange, bright pink, violet purple, emerald green, royal blue, cherry red, each with a shape symbol.
- Deterministic solver (BFS) with canonical state keys; deadlock detection on real game state; recoverable deadlock message with Undo and Restart.
- Sounds (original), music/SFX/haptics independently toggled. Local progress storage. Local privacy-preserving diagnostics.
- Automated TypeScript tests (invariants, integration, negative deadlock test: Pink then Cyan). Report real results; do not fabricate.
- Try React Native Skia if compatible with installed Expo version; batch alien rendering.

## Critical user flow
Level 1 played from start: tap Cyan (north, bay 1), Yellow then dispatches to bay 2, yellow boards and departs, cyan boards and departs, pink dispatches, boards, departs, victory with stars and Next Level button.

## Seed Data
Level 1 JSON as given in the addendum (see full_spec.md section 4).

## Integrations
None.

## Deliverables at stop gate
Exact files created, architecture summary, screenshot, verified solution trace, test results, preview/iPhone Expo Go instructions, unresolved issues.

## Next round notes (user words)
"polish it" - "it is for eventual release but is for me at the moment. and I would like it polished" - Priority when testing: "feels to play".
Style direction (agreed with user): snappy, arcade-y, bold neon, strong haptics, combo feel with rising sound pitch, upbeat short music, instant undo/restart. Aliens: "humour in the aliens (silly expressions and reactions)".
