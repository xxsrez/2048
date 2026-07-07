# Architecture

## Stack

- Vite serves and builds the browser app.
- TypeScript keeps game logic and UI state typed.
- Vitest covers pure game and helper-charge behavior.
- Playwright drives browser-level UI verification through `scripts/verify-ui.mjs`.
- Lucide provides toolbar icons.
- `serve` hosts the built `dist` folder for the production start command.

## Runtime Shape

The app is a single-page browser game mounted from `src/main.ts`. The first rendered view is the playable board, score area, helper controls, and compact stats panel.

The engine layer is kept separate from the DOM layer:

- `src/game.ts` owns immutable board operations: creating boards, sliding and merging lines, spawning tiles, status checks, swaps, and deletes.
- `src/helpers.ts` owns helper-charge rules: earning, spending, caps, parsing, and legacy inference.
- `src/main.ts` owns runtime UI state, event handling, animation state, persistence, and DOM rendering.
- `src/styles.css` owns the responsive layout and tile presentation.

## Game Flow

1. Keyboard, WASD, or touch input requests a direction.
2. `moveBoard` computes the next board and score gain without mutating the existing board.
3. A valid move pushes an undo snapshot, spawns a new tile, awards helper charges from merged tile values, updates score, and starts the slide animation.
4. When animation settles, queued directional moves are replayed in order.
5. Render updates the board, overlay state, helper availability, stats, and persisted game state.

Helper actions do not spawn new tiles:

- Undo consumes one Undo charge and restores the latest snapshot.
- Swap 2 consumes one Swap charge after two different occupied cells are selected.
- Delete consumes one Delete charge after an occupied cell is selected and clears every tile with that selected value.

## State And Persistence

The runtime state tracks:

- Board values and animated tile identities.
- Score and best score.
- Helper charges.
- Keep-playing state after reaching 2048.
- Undo history.
- Active helper mode and selected cells.
- Animation and queued-move state.

Browser storage keys:

- `local-2048-best-score` stores the best score.
- `local-2048-game-state` stores the versioned active game state.
- `local-2048-helper-charges` mirrors helper charges for older saved-game migration.

Saved data is validated before restore. Invalid or incompatible data falls back to a fresh game. Legacy saved games without helper charges infer a conservative charge state from the largest tile before being rewritten in the current format.

## Animation Model

Move rendering keeps sliding source tiles, merged tiles, and newly spawned tiles in the DOM together for the animation window. This gives merged tiles and new tiles their own timing instead of changing values in place mid-slide.

Tile position is computed from board metrics observed at runtime. A resize observer keeps tile metrics synchronized with responsive layout changes.

## Verification

- `src/game.test.ts` validates movement, merge, spawn, status, swap, and delete engine behavior.
- `src/helpers.test.ts` validates helper-charge earning, spending, parsing, caps, and legacy inference.
- `npm run test:e2e` starts a browser verification script against a running app and checks initial render, helper flows, persistence, legacy migration, game-over undo, responsive screenshots, and favicon behavior.
