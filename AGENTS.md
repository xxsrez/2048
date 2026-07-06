# AGENTS.md

## Project

This is a local Vite + TypeScript implementation of 2048 with a 4x4 board and three helpers: undo, swap two occupied tiles, and delete one occupied tile.

## Commands

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Run tests: `npm test`
- Run production build: `npm run build`

## Working Notes

- Keep the first screen as the playable game, not a landing page.
- Keep engine behavior in `src/game.ts` and cover non-trivial game changes with Vitest.
- Update docs when changing gameplay, helper behavior, or setup commands.
