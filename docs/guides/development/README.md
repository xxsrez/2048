# Development Guide

## Setup

```bash
npm install
```

## Local App

```bash
npm run dev
```

The Vite dev server is configured for `http://127.0.0.1:5173`.

## Tests

```bash
npm test
```

Use Vitest for pure game and helper logic. Add or update tests when changing move rules, helper behavior, persistence parsing, or other non-trivial engine behavior.

## UI Verification

Start the app first, then run:

```bash
npm run test:e2e
```

The Playwright script checks the rendered game, helper flows, persistence, legacy charge migration, game-over undo, favicon behavior, and desktop/mobile screenshots.

## Build And Serve

```bash
npm run build
npm start
```

`npm run build` runs TypeScript and Vite. `npm start` serves the built `dist` folder on `$PORT`, defaulting to `4173`.

For a Vite preview server:

```bash
npm run preview
```

## Change Checklist

- Keep the playable game as the first screen.
- Keep deterministic engine behavior in `src/game.ts`.
- Keep helper-charge rules in `src/helpers.ts`.
- Update docs when gameplay, helper behavior, persistence, setup commands, or verification steps change.
- Run the narrowest relevant checks, and run `npm run build` before considering broad changes complete.
