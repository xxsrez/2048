import { describe, expect, it } from "vitest";
import {
  Board,
  createInitialBoard,
  deleteTile,
  getGameStatus,
  hasMoves,
  moveBoard,
  slideLine,
  spawnTile,
  swapTiles,
} from "./game";

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

describe("2048 engine", () => {
  it("merges each tile at most once per slide", () => {
    expect(slideLine([2, 2, 2, 0])).toEqual({
      line: [4, 2, 0, 0],
      scoreGain: 4,
    });
    expect(slideLine([2, 2, 2, 2])).toEqual({
      line: [4, 4, 0, 0],
      scoreGain: 8,
    });
  });

  it("moves and scores in the requested direction", () => {
    const board: Board = [
      [2, 0, 2, 4],
      [0, 0, 4, 4],
      [2, 2, 2, 0],
      [0, 0, 0, 0],
    ];

    expect(moveBoard(board, "left")).toEqual({
      board: [
        [4, 4, 0, 0],
        [8, 0, 0, 0],
        [4, 2, 0, 0],
        [0, 0, 0, 0],
      ],
      scoreGain: 16,
      moved: true,
    });
  });

  it("detects blocked boards", () => {
    const blocked: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];

    expect(hasMoves(blocked)).toBe(false);
    expect(getGameStatus(blocked, false)).toBe("over");
  });

  it("spawns deterministic tiles into empty cells", () => {
    const board = spawnTile(
      [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      sequence([0, 0.95]),
    );

    expect(board[0][1]).toBe(4);
  });

  it("creates an initial board with two tiles", () => {
    const board = createInitialBoard(sequence([0, 0.1, 0, 0.95]));

    expect(board[0][0]).toBe(2);
    expect(board[0][1]).toBe(4);
  });

  it("supports swap and delete helpers", () => {
    const board: Board = [
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const swapped = swapTiles(board, { row: 0, col: 0 }, { row: 0, col: 1 });
    const deleted = deleteTile(swapped, { row: 0, col: 0 });

    expect(swapped[0].slice(0, 2)).toEqual([4, 2]);
    expect(deleted[0].slice(0, 2)).toEqual([0, 2]);
  });
});
