# Gameplay

## Core Mode

This project implements the basic 2048 mode on a 4x4 grid:

- A new game starts with two random tiles.
- Each valid move slides all tiles in one direction.
- Matching tiles merge once per move.
- Merges increase the score by the value of the produced tile.
- A new tile appears only after a move changes the board.
- Reaching 2048 shows a win state, and the player can continue.
- A full board with no adjacent matches is game over.

## Helpers

The helpers are intentionally direct and do not spawn new tiles. They start with zero uses, each helper can hold up to two uses, and valid merges refill them:

- Making a 128 tile adds one Undo use.
- Making a 256 tile adds one Swap 2 use.
- Making a 512 tile adds one Delete use.
- Undo restores the previous board, score, and win/continue state, then spends one Undo use.
- Swap 2 enters a selection mode, then swaps two occupied cells and spends one Swap 2 use.
- Delete enters a selection mode, then clears one occupied cell and spends one Delete use.

Helpers save history first, so they can be undone.

## Persistence

The current board, score, helper uses, keep-playing state, and undo history are saved in `localStorage`. Refreshing the page restores the in-progress game. New Game starts a fresh saved game with zero helper uses.
