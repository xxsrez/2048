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

The helpers are intentionally direct and do not spawn new tiles:

- Undo restores the previous board, score, and win/continue state.
- Swap 2 enters a selection mode, then swaps two occupied cells.
- Delete enters a selection mode, then clears one occupied cell.

Helpers save history first, so they can be undone.
