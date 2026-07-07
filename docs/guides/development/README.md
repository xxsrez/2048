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

## Production Release

Production runs on Railway:

- Project: `2048`
- Environment: `production`
- Service: `2048`
- URL: `https://2048-srez.up.railway.app`

Release from a clean local checkout on `main`:

```bash
git status --short --branch
npm test
npm run build
npm run dev -- --port 5173
npm run test:e2e
git add <changed-files>
git commit -m "<release summary>"
git push origin main
railway status
railway up --service 2048 --environment production --message "<release summary>"
railway deployment list --json
```

`npm run test:e2e` expects the Vite dev server to already be running at
`http://127.0.0.1:5173`. Stop the dev server after the check.

The current Railway release path is a CLI upload from the local checkout.
Pushing to GitHub keeps `origin/main` current, but do not assume the push alone
has deployed production unless Railway shows a new successful deployment.

## Change Checklist

- Keep the playable game as the first screen.
- Keep deterministic engine behavior in `src/game.ts`.
- Keep helper-charge rules in `src/helpers.ts`.
- Update docs when gameplay, helper behavior, persistence, setup commands, or verification steps change.
- Run the narrowest relevant checks, and run `npm run build` before considering broad changes complete.
