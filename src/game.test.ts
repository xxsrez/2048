import { describe, expect, it } from "vitest";
import {
  Board,
  createInitialBoard,
  canDeleteTile,
  deleteTile,
  getGameStatus,
  hasMoves,
  moveBoard,
  slideLine,
  spawnTile,
  spawnTileWithPosition,
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
      mergedValues: [4],
    });
    expect(slideLine([2, 2, 2, 2])).toEqual({
      line: [4, 4, 0, 0],
      scoreGain: 8,
      mergedValues: [4, 4],
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
      mergedValues: [4, 8, 4],
    });
  });

  it.each([
    ["left", [[4, 0], [8, 0]]],
    ["right", [[0, 4], [0, 8]]],
    ["up", [[2, 2], [4, 4]]],
    ["down", [[2, 2], [4, 4]]],
  ] as const)("moves %s and reports only real merges", (direction, expected) => {
    const result = moveBoard([[2, 2], [4, 4]], direction);
    expect(result.board).toEqual(expected);
    expect(result.mergedValues).toEqual(direction === "left" || direction === "right" ? [4, 8] : []);
    expect(result.moved).toBe(direction === "left" || direction === "right");
  });

  it("handles vertical merges, win continuation and a bounded reroll", () => {
    expect(moveBoard([[2, 4], [2, 8]], "down")).toMatchObject({
      board: [[0, 4], [4, 8]], scoreGain: 4, mergedValues: [4], moved: true,
    });
    expect(hasMoves([[2, 4], [2, 8]])).toBe(true);
    expect(getGameStatus([[2048, 2], [4, 8]], false)).toBe("won");
    expect(getGameStatus([[2048, 2], [4, 8]], true)).toBe("over");
    const rerolled = spawnTileWithPosition([[2, 0], [4, 8]], () => 0, {
      position: { row: 0, col: 1 }, value: 2,
    });
    expect(rerolled).toMatchObject({ position: { row: 0, col: 1 }, value: 4 });
  });

  it("merges from the leading edge on right and downward moves", () => {
    const row = [[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const column = [[2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0]];
    expect(moveBoard(row, "right")).toMatchObject({
      board: [[0, 0, 2, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], mergedValues: [4],
    });
    expect(moveBoard(column, "down")).toMatchObject({
      board: [[0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0]], mergedValues: [4],
    });
    expect(moveBoard(column, "up").board).toEqual([[4, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
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
    expect(getGameStatus([[0, 0], [0, 0]], false)).toBe("over");
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

  it("rerolls an excluded spawn outcome", () => {
    const spawn = spawnTileWithPosition(
      [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      sequence([0, 0, 0.5, 0]),
      { position: { row: 0, col: 1 }, value: 2 },
    );

    expect(spawn.position).toEqual({ row: 2, col: 0 });
    expect(spawn.value).toBe(2);
  });

  it("creates an initial board with two tiles", () => {
    const board = createInitialBoard(sequence([0, 0.1, 0, 0.95]));

    expect(board[0][0]).toBe(2);
    expect(board[0][1]).toBe(4);
  });

  it("supports swap and delete helpers", () => {
    const board: Board = [
      [2, 4, 0, 4],
      [0, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const swapped = swapTiles(board, { row: 0, col: 0 }, { row: 0, col: 1 });
    const deleted = deleteTile(swapped, { row: 0, col: 0 });

    expect(swapped[0].slice(0, 2)).toEqual([4, 2]);
    expect(deleted).toEqual([
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  it("does not allow deletion of the last remaining value", () => {
    expect(canDeleteTile([[2, 2], [0, 0]], { row: 0, col: 0 })).toBe(false);
    expect(canDeleteTile([[2, 4], [0, 0]], { row: 0, col: 0 })).toBe(true);
    expect(canDeleteTile([[2, 4], [0, 0]], { row: 1, col: 0 })).toBe(false);
  });
});
