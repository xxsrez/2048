# Architecture

## Stack

- Vite serves and builds the app.
- TypeScript keeps the engine and UI typed.
- Vitest covers the pure game engine.
- Playwright verifies the rendered UI flow.
- Lucide provides toolbar icons.

## Source Layout

- `src/game.ts` contains deterministic board operations.
- `src/main.ts` owns UI state, input handling, helpers, persistence, and the animated tile layer.
- `src/styles.css` contains the responsive game surface.
- `src/game.test.ts` validates movement, merge, spawn, and helper behavior.
- `scripts/verify-ui.mjs` runs a browser sanity-check against a live dev server.

## State Model

The UI keeps a runtime state with board, animated tile identities, score, best score, helper-use charges, helper mode, selected cells, and undo history. Pure engine functions never mutate the incoming board, which makes moves easy to test and safe to undo.

Best score and the current in-progress game are stored in `localStorage`. Saved game data includes helper-use charges, is versioned, and is validated before restore; invalid data falls back to a fresh board. Helper-use charges are also mirrored under `local-2048-helper-charges`, and legacy saved games without charges infer a conservative charge state from the largest tile before being rewritten in the current format.

Move rendering keeps source tiles sliding while merged and new tiles are already in the DOM with delayed pop/appear animations. This mirrors the original 2048 actuator timing more closely than changing tile values during movement.

Keyboard and swipe moves entered during an active slide are queued and replayed after the current animation settles, so rapid directional input is not dropped.
