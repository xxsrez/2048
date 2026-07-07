# Project Overview

## Purpose

2048 Local is a small local browser game that preserves the original 4x4 2048 loop while adding a few limited helper actions. The first screen should always be the playable game rather than a landing page.

## Product Scope

- Classic 4x4 2048 board with keyboard, WASD, and touch-swipe input.
- Local-only runtime using browser storage for the active game, best score, helper charges, and undo history.
- Three helper actions with capped charges:
  - Undo restores the previous board, score, and win/continue state.
  - Swap 2 swaps two occupied tiles.
  - Delete clears every tile that matches the selected tile value.
- Helper charges start at zero, cap at two per helper, and are earned from specific merge milestones.
- The app should remain usable on desktop and mobile viewports.

## Constraints

- Game engine behavior belongs in `src/game.ts` and should stay covered by Vitest when it changes.
- Helper-charge behavior belongs in `src/helpers.ts` and should stay covered by Vitest when it changes.
- UI behavior and persistence live in `src/main.ts`.
- This repo is a fresh implementation; it does not vendor the original 2048 source.

## Non-Goals

- Online accounts, multiplayer, server-side game state, analytics, and leaderboards.
- A marketing homepage ahead of the playable game.
- Additional board sizes unless the engine, UI, tests, and docs are updated together.

## Success Criteria

- `npm test` and `npm run build` pass after non-trivial changes.
- `npm run test:e2e` passes for UI, persistence, and helper-flow changes.
- Documentation links remain current after moving files or changing commands.
