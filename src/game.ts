export const GRID_SIZE = 4;
export const WIN_TILE = 2048;

export type Board = number[][];
export type Direction = "up" | "down" | "left" | "right";
export type GameStatus = "playing" | "won" | "over";

export interface Position {
  row: number;
  col: number;
}

export interface SlideResult {
  line: number[];
  scoreGain: number;
}

export interface MoveResult {
  board: Board;
  scoreGain: number;
  moved: boolean;
}

export interface SpawnResult {
  board: Board;
  position: Position | null;
  value: number | null;
}

export type RandomSource = () => number;

export function createEmptyBoard(size = GRID_SIZE): Board {
  return Array.from({ length: size }, () => Array<number>(size).fill(0));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function boardsEqual(a: Board, b: Board): boolean {
  return a.every((row, rowIndex) =>
    row.every((cell, colIndex) => cell === b[rowIndex]?.[colIndex]),
  );
}

export function slideLine(line: number[]): SlideResult {
  const compacted = line.filter((value) => value !== 0);
  const merged: number[] = [];
  let scoreGain = 0;

  for (let index = 0; index < compacted.length; index += 1) {
    const current = compacted[index];
    const next = compacted[index + 1];

    if (current === next) {
      const value = current * 2;
      merged.push(value);
      scoreGain += value;
      index += 1;
    } else {
      merged.push(current);
    }
  }

  while (merged.length < line.length) {
    merged.push(0);
  }

  return { line: merged, scoreGain };
}

export function moveBoard(board: Board, direction: Direction): MoveResult {
  const size = board.length;
  const nextBoard = createEmptyBoard(size);
  let scoreGain = 0;

  if (direction === "left" || direction === "right") {
    board.forEach((row, rowIndex) => {
      const sourceLine = direction === "right" ? [...row].reverse() : [...row];
      const result = slideLine(sourceLine);
      const line = direction === "right" ? result.line.reverse() : result.line;

      nextBoard[rowIndex] = line;
      scoreGain += result.scoreGain;
    });
  } else {
    for (let colIndex = 0; colIndex < size; colIndex += 1) {
      const column = board.map((row) => row[colIndex]);
      const sourceLine = direction === "down" ? column.reverse() : column;
      const result = slideLine(sourceLine);
      const line = direction === "down" ? result.line.reverse() : result.line;

      for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
        nextBoard[rowIndex][colIndex] = line[rowIndex];
      }

      scoreGain += result.scoreGain;
    }
  }

  return {
    board: nextBoard,
    scoreGain,
    moved: !boardsEqual(board, nextBoard),
  };
}

export function findEmptyCells(board: Board): Position[] {
  const cells: Position[] = [];

  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === 0) {
        cells.push({ row: rowIndex, col: colIndex });
      }
    });
  });

  return cells;
}

export function spawnTileWithPosition(
  board: Board,
  random: RandomSource = Math.random,
): SpawnResult {
  const nextBoard = cloneBoard(board);
  const emptyCells = findEmptyCells(nextBoard);

  if (emptyCells.length === 0) {
    return { board: nextBoard, position: null, value: null };
  }

  const cellIndex = Math.min(
    Math.floor(random() * emptyCells.length),
    emptyCells.length - 1,
  );
  const cell = emptyCells[cellIndex];
  const value = random() < 0.9 ? 2 : 4;
  nextBoard[cell.row][cell.col] = value;

  return { board: nextBoard, position: cell, value };
}

export function spawnTile(board: Board, random: RandomSource = Math.random): Board {
  return spawnTileWithPosition(board, random).board;
}

export function createInitialBoard(random: RandomSource = Math.random): Board {
  return spawnTile(spawnTile(createEmptyBoard(), random), random);
}

export function hasWon(board: Board): boolean {
  return board.some((row) => row.some((value) => value >= WIN_TILE));
}

export function hasMoves(board: Board): boolean {
  if (findEmptyCells(board).length > 0) {
    return true;
  }

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const value = board[row][col];
      const right = board[row][col + 1];
      const down = board[row + 1]?.[col];

      if (value === right || value === down) {
        return true;
      }
    }
  }

  return false;
}

export function getGameStatus(board: Board, keepPlaying: boolean): GameStatus {
  if (hasWon(board) && !keepPlaying) {
    return "won";
  }

  if (!hasMoves(board)) {
    return "over";
  }

  return "playing";
}

export function countOccupiedCells(board: Board): number {
  return board.reduce(
    (count, row) => count + row.filter((value) => value !== 0).length,
    0,
  );
}

export function getLargestTile(board: Board): number {
  return Math.max(...board.flat());
}

export function isInsideBoard(board: Board, position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < board.length &&
    position.col >= 0 &&
    position.col < board[position.row].length
  );
}

export function isOccupied(board: Board, position: Position): boolean {
  return isInsideBoard(board, position) && board[position.row][position.col] > 0;
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function swapTiles(board: Board, first: Position, second: Position): Board {
  const nextBoard = cloneBoard(board);
  const firstValue = nextBoard[first.row][first.col];

  nextBoard[first.row][first.col] = nextBoard[second.row][second.col];
  nextBoard[second.row][second.col] = firstValue;

  return nextBoard;
}

export function deleteTile(board: Board, position: Position): Board {
  const nextBoard = cloneBoard(board);
  nextBoard[position.row][position.col] = 0;
  return nextBoard;
}
