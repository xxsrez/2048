# 2048 Local

Local 2048 game inspired by the original play2048.co experience. This build keeps the classic 4x4 board and adds three helpers: undo, swap two occupied tiles, and delete one occupied tile.

## Commands

```bash
npm install
npm run dev
npm test
npm run test:e2e
npm run build
```

The dev server is configured for `http://127.0.0.1:5173`.

## Gameplay

- Move with arrow keys, WASD, or touch swipes.
- Equal tiles merge once per move and add their merged value to the score.
- A new 2 or 4 tile appears after each valid move.
- Helpers start with zero uses and can hold up to two uses each.
- Making a 128 tile adds one Undo use, making 256 adds one Swap 2 use, and making 512 adds one Delete use.
- Undo restores the previous board and score, Swap 2 swaps two occupied cells, and Delete removes one occupied tile.

## Documentation

- [Gameplay](docs/gameplay.md)
- [Architecture](docs/architecture.md)
- [Attribution](docs/attribution.md)
- [Project memory](docs/project-memory.md)
