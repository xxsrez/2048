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

The UI keeps a runtime state with board, animated tile identities, score, best score, helper mode, selected cells, and undo history. Pure engine functions never mutate the incoming board, which makes moves easy to test and safe to undo.

Best score and the current in-progress game are stored in `localStorage`. Saved game data is versioned and validated before restore; invalid data falls back to a fresh board.

Move rendering uses a two-phase animation: source tiles slide first, then the settled board renders merged and new tiles. This mirrors the original 2048 actuator timing more closely than changing tile values during movement.
