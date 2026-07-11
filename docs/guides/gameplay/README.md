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
- Game over shows Undo and Restart actions. Undo is disabled when no Undo use is available; Restart always remains available.

## Helpers

The helpers are intentionally direct and do not spawn new tiles. They start with zero uses, each helper can hold up to two uses, and valid merges refill them:

- Making a 128 tile adds one Undo use.
- Making a 256 tile adds one Swap 2 use.
- Making a 512 tile adds one Delete use.
- Undo restores the previous board, score, and win/continue state, then spends one Undo use.
- Repeating the same move immediately after Undo rerolls the added tile instead of reproducing the cancelled spawn.
- Swap 2 enters a selection mode, then swaps two occupied cells and spends one Swap 2 use.
- Delete enters a selection mode, then clears every tile matching the selected tile value and spends one Delete use.

Helpers save history first, so they can be undone.

## Input

- Arrow keys and WASD move the board.
- Touch swipes move the board on mobile.
- Directional input during a slide is queued and replayed after the current animation settles.
- Clicking an empty cell during helper selection does not spend a charge.
- Clicking the same selected tile twice during Swap 2 clears the current swap selection.

## Persistence

The current board, score, helper uses, keep-playing state, and undo history are saved in `localStorage`. Helper uses are also mirrored in a dedicated storage key so refreshes and older saved games keep the charges stable. Refreshing the page restores the in-progress game. New Game starts a fresh saved game with zero helper uses.

## Game-End Behavior

- Reaching 2048 shows a win overlay.
- Keep allows play to continue past 2048.
- A blocked board with no legal moves shows game over.
- Game over keeps Restart available.
- Game over also offers Undo when an Undo charge and history snapshot are available.
