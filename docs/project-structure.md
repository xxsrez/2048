# Project Structure

This is the intended structure for the repository. Generated directories such as `node_modules/`, `dist/`, and `test-results/` are omitted from the main tree.

```text
.
├── AGENTS.md
├── README.md
├── THIRD_PARTY_NOTICES.md
├── docs/
│   ├── README.md
│   ├── overview.md
│   ├── architecture.md
│   ├── project-structure.md
│   ├── design/
│   ├── guides/
│   │   ├── development/
│   │   └── gameplay/
│   ├── instructions/
│   ├── reference/
│   ├── reports/
│   └── tasks/
├── public/
├── scripts/
├── src/
├── third_party/
├── index.html
├── package.json
├── package-lock.json
└── tsconfig.json
```

## Root Files

- `README.md` is the short project entry point with commands and the most important documentation links.
- `AGENTS.md` contains repo-local collaboration instructions for coding agents.
- `package.json` defines the Vite, Vitest, Playwright, build, and serve commands.
- `index.html` provides the Vite HTML shell.
- `THIRD_PARTY_NOTICES.md` records copied third-party assets.
- `LICENSE` is the repository license.

## Source

- `src/game.ts` contains deterministic board logic.
- `src/helpers.ts` contains helper-charge logic.
- `src/main.ts` contains UI state, input handling, persistence, and rendering.
- `src/styles.css` contains responsive visual styling.
- `src/game.test.ts` and `src/helpers.test.ts` contain Vitest coverage for pure logic.

## Scripts

- `scripts/verify-ui.mjs` is the Playwright UI verification script used by `npm run test:e2e`.

## Assets And Third Party

- `public/` contains favicon and Apple touch icon assets copied or generated from the original 2048 assets.
- `third_party/2048-LICENSE.txt` contains the copied MIT license text for the original 2048 project assets.

## Documentation

- `docs/overview.md` explains product goals and scope.
- `docs/architecture.md` explains runtime design and verification.
- `docs/guides/` contains current how-to guides.
- `docs/instructions/` contains documentation and workflow standards.
- `docs/reference/` contains licensing, attribution, memory, and other stable reference notes.
- `docs/design/`, `docs/tasks/`, and `docs/reports/` are reserved for future historical specs, complex investigations, and completed analysis.
