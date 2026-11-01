# Gameplay Guide

## Core Mode

This project implements the basic 2048 mode on a 4x4 grid:

- A new game starts with two random tiles.
- Each valid move slides all tiles in one direction.
- Matching tiles merge once per move.
- Merges increase the score by the value of the produced tile.
- A new tile appears only after a move changes the board.
- Reaching 2048 shows a win state, and the player can continue.
- A full board with no adjacent matches is game over.
- Game over shows Undo and Restart actions. Undo needs an eligible charge and a saved snapshot. Restart is available unless the saved game has changed in another tab.

## Helpers

The helpers are intentionally direct and do not spawn new tiles. They start with zero uses, each helper can hold up to two uses, and valid merges refill them:

- Making a 128 tile adds one Undo use.
- Making a 256 tile adds one Swap 2 use.
- Making a 512 tile adds one Delete use.
- Undo restores the previous board, score, and win/continue state, removes any charges awarded by that move, then spends one Undo use earned before that move. Charges spent on helper actions are not refunded. Older saved history may not record the awards.
- Repeating the same move immediately after Undo rerolls the added tile instead of reproducing the cancelled spawn.
- Swap 2 enters a selection mode, then swaps two occupied cells with different values and spends one Swap 2 use.
- Delete enters a selection mode, then clears every tile matching the selected tile value and spends one Delete use. It cannot remove the last remaining value.
- Delete mode uses a muted warm outline on the helper, board, and selectable tiles while it waits for a tile value.
- Swap 2 shows a gold selection state for the first tile, changes the prompt for the second tile, and briefly marks both swapped tiles with related but distinct completion effects.

Helpers save history first, so they can be undone.
The History counter shows saved undo snapshots, including helper actions, up to 100; it is not a count of moves played.

## Input

- Arrow keys and WASD move the board.
- Touch swipes move the board on mobile.
- Directional input during a slide is queued and replayed after the current animation settles.
- Clicking an empty cell during helper selection does not spend a charge.
- Clicking the same selected tile twice during Swap 2 clears the current swap selection.

## Persistence

The current board, score, helper uses, keep-playing state, and undo history are saved in `localStorage`. Helper uses are also mirrored in a dedicated storage key so refreshes and older saved games keep the charges stable. The best score has a monotonic backup and is reconciled across open tabs and browser page-cache restores so stale in-memory state cannot lower it. Refreshing the page restores the in-progress game. New Game starts a fresh saved game with zero helper uses.

When another tab changes the saved game, the older tab stops accepting moves; reload it to continue from the saved game. An unreadable save is left untouched; New Game first copies it to a separate browser storage key before starting. If the backup cannot be written, the original remains untouched and the new game cannot start. If browser storage is unavailable, the game works in memory but cannot be restored after a reload.

Browser storage is separate for each website address. The Railway and Sites versions therefore keep independent games and best scores.

## Game-End Behavior

- Reaching 2048 shows a win overlay.
- Keep allows play to continue past 2048.
- A blocked board with no legal moves shows game over.
- Game over keeps Restart available.
- Game over also offers Undo when a history snapshot and an eligible Undo charge earned before that action are available.
