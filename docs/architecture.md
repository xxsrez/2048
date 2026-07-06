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

Best score is stored in `localStorage`; the current board is intentionally not persisted.
