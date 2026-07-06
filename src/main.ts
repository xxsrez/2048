import { createIcons, icons } from "lucide";
import "./styles.css";
import {
  Board,
  Direction,
  GRID_SIZE,
  Position,
  cloneBoard,
  countOccupiedCells,
  createInitialBoard,
  deleteTile,
  getGameStatus,
  getLargestTile,
  isOccupied,
  moveBoard,
  positionsEqual,
  spawnTileWithPosition,
  swapTiles,
} from "./game";
import {
  HELPER_ACTIONS,
  HELPER_LABELS,
  HELPER_MAX_CHARGES,
  awardHelperCharges,
  consumeHelperCharge,
  createEmptyHelperCharges,
  inferHelperChargesFromBoard,
  parseHelperCharges,
  type BoardHelperMode,
  type HelperAction,
  type HelperCharges,
  type HelperMode,
} from "./helpers";

interface Snapshot {
  board: Board;
  score: number;
  keepPlaying: boolean;
}

interface RenderTile {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew: boolean;
  isMerged: boolean;
  isGhost: boolean;
}

interface RuntimeState {
  board: Board;
  tiles: RenderTile[];
  score: number;
  bestScore: number;
  helperCharges: HelperCharges;
  keepPlaying: boolean;
  history: Snapshot[];
  mode: HelperMode;
  selection: Position[];
  isAnimating: boolean;
  lastGain: number;
  message: string;
}

interface PersistedGame {
  version: 1;
  board: Board;
  score: number;
  bestScore: number;
  helperCharges: HelperCharges;
  keepPlaying: boolean;
  history: Snapshot[];
}

interface MoveAnimation {
  displayTiles: RenderTile[];
  settledTiles: RenderTile[];
}

const BEST_SCORE_KEY = "local-2048-best-score";
const GAME_STATE_KEY = "local-2048-game-state";
const HELPER_CHARGES_KEY = "local-2048-helper-charges";
const HISTORY_LIMIT = 100;
const MAX_QUEUED_MOVES = 8;
const MOVE_SETTLE_MS = 120;
const ANIMATION_RESET_MS = 260;
const SWIPE_THRESHOLD = 36;

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <main class="game-shell">
    <section class="game-surface" aria-labelledby="game-title">
      <header class="topbar">
        <div class="brand">
          <h1 id="game-title">2048</h1>
        </div>
        <div class="score-row" aria-label="Scores">
          <div class="score-box">
            <span>Score</span>
            <strong id="score-value">0</strong>
          </div>
          <div class="score-box">
            <span>Best</span>
            <strong id="best-score-value">0</strong>
          </div>
        </div>
        <nav class="toolbar" aria-label="Game controls">
          <button class="tool-button primary" id="new-game" type="button" title="New game" aria-label="New game">
            <i data-lucide="rotate-ccw"></i>
            <span>New Game</span>
          </button>
        </nav>
      </header>

      <div class="board-frame">
        <div class="board" id="board" role="grid" aria-label="2048 board" tabindex="0">
          <div class="grid-layer" id="grid-layer" aria-hidden="true"></div>
          <div class="tile-layer" id="tile-layer"></div>
        </div>
        <div class="result-overlay" id="result-overlay" hidden>
          <div class="result-panel">
            <p id="result-kicker"></p>
            <strong id="result-title"></strong>
            <div class="result-actions">
              <button class="tool-button primary" id="keep-going" type="button">
                <i data-lucide="play"></i>
                <span>Keep</span>
              </button>
              <button class="tool-button" id="restart" type="button">
                <i data-lucide="rotate-ccw"></i>
                <span>Restart</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <nav class="helper-dock" aria-label="Helper controls">
        <button class="tool-button" id="undo" type="button" title="Undo" aria-label="Undo">
          <i data-lucide="undo-2"></i>
          <span class="helper-label">Undo</span>
          <span class="charge-meter" id="undo-charge-meter" aria-hidden="true">
            <span class="charge-pip"></span>
            <span class="charge-pip"></span>
          </span>
        </button>
        <button class="tool-button" id="swap" type="button" title="Swap 2" aria-label="Swap 2" aria-pressed="false">
          <i data-lucide="arrow-left-right"></i>
          <span class="helper-label">Swap 2</span>
          <span class="charge-meter" id="swap-charge-meter" aria-hidden="true">
            <span class="charge-pip"></span>
            <span class="charge-pip"></span>
          </span>
        </button>
        <button class="tool-button danger" id="delete" type="button" title="Delete tile" aria-label="Delete tile" aria-pressed="false">
          <i data-lucide="eraser"></i>
          <span class="helper-label">Delete</span>
          <span class="charge-meter" id="delete-charge-meter" aria-hidden="true">
            <span class="charge-pip"></span>
            <span class="charge-pip"></span>
          </span>
        </button>
      </nav>

      <div class="status-line" id="status-line" role="status" aria-live="polite"></div>
    </section>

    <aside class="stats-panel" aria-label="Game details">
      <div class="stat">
        <span>Largest</span>
        <strong id="largest-tile">0</strong>
      </div>
      <div class="stat">
        <span>Turns</span>
        <strong id="turns-count">0</strong>
      </div>
      <div class="stat">
        <span>Tiles</span>
        <strong id="tiles-count">0</strong>
      </div>
    </aside>
  </main>
`;

createIcons({ icons });

const boardElement = getElement<HTMLDivElement>("board");
const gridLayerElement = getElement<HTMLDivElement>("grid-layer");
const tileLayerElement = getElement<HTMLDivElement>("tile-layer");
const scoreElement = getElement<HTMLElement>("score-value");
const bestScoreElement = getElement<HTMLElement>("best-score-value");
const largestTileElement = getElement<HTMLElement>("largest-tile");
const turnsCountElement = getElement<HTMLElement>("turns-count");
const tilesCountElement = getElement<HTMLElement>("tiles-count");
const statusLineElement = getElement<HTMLElement>("status-line");
const overlayElement = getElement<HTMLDivElement>("result-overlay");
const resultKickerElement = getElement<HTMLElement>("result-kicker");
const resultTitleElement = getElement<HTMLElement>("result-title");
const newGameButton = getElement<HTMLButtonElement>("new-game");
const restartButton = getElement<HTMLButtonElement>("restart");
const keepGoingButton = getElement<HTMLButtonElement>("keep-going");
const undoButton = getElement<HTMLButtonElement>("undo");
const swapButton = getElement<HTMLButtonElement>("swap");
const deleteButton = getElement<HTMLButtonElement>("delete");
const helperButtons: Record<HelperAction, HTMLButtonElement> = {
  undo: undoButton,
  swap: swapButton,
  delete: deleteButton,
};
const helperChargeMeters: Record<HelperAction, HTMLElement> = {
  undo: getElement<HTMLElement>("undo-charge-meter"),
  swap: getElement<HTMLElement>("swap-charge-meter"),
  delete: getElement<HTMLElement>("delete-charge-meter"),
};

let pointerStart: { x: number; y: number } | null = null;
let queuedMoves: Direction[] = [];
let nextTileId = 1;
let moveAnimationTimer: number | undefined;
let animationCleanupTimer: number | undefined;
let tileMetrics = {
  size: 0,
  gap: 0,
};

const savedGame = readGameState();
const initialBoard = savedGame?.board ?? createInitialBoard();
const initialBestScore = Math.max(
  readBestScore(),
  savedGame?.bestScore ?? 0,
  savedGame?.score ?? 0,
);

const state: RuntimeState = {
  board: initialBoard,
  tiles: createRenderTiles(initialBoard, !savedGame),
  score: savedGame?.score ?? 0,
  bestScore: initialBestScore,
  helperCharges: savedGame?.helperCharges ?? createEmptyHelperCharges(),
  keepPlaying: savedGame?.keepPlaying ?? false,
  history: savedGame?.history ?? [],
  mode: "move",
  selection: [],
  isAnimating: false,
  lastGain: 0,
  message: savedGame ? "Restored" : "Ready",
};

renderGrid();
syncTileMetrics();
render();

newGameButton.addEventListener("click", startNewGame);
restartButton.addEventListener("click", startNewGame);
keepGoingButton.addEventListener("click", keepGoing);
undoButton.addEventListener("click", undo);
swapButton.addEventListener("click", () => toggleMode("swap"));
deleteButton.addEventListener("click", () => toggleMode("delete"));

boardElement.addEventListener("click", (event) => {
  const tile = (event.target as HTMLElement).closest<HTMLButtonElement>(".tile");

  if (!tile) {
    return;
  }

  handleCellClick({
    row: Number(tile.dataset.row),
    col: Number(tile.dataset.col),
  });
});

new ResizeObserver(() => {
  syncTileMetrics();
  renderTiles();
}).observe(tileLayerElement);

boardElement.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

boardElement.addEventListener("pointerup", (event) => {
  if (!pointerStart) {
    return;
  }

  const diffX = event.clientX - pointerStart.x;
  const diffY = event.clientY - pointerStart.y;
  pointerStart = null;

  if (Math.max(Math.abs(diffX), Math.abs(diffY)) < SWIPE_THRESHOLD) {
    return;
  }

  requestMove(
    Math.abs(diffX) > Math.abs(diffY)
      ? diffX > 0
        ? "right"
        : "left"
      : diffY > 0
        ? "down"
        : "up",
  );
});

window.addEventListener("keydown", (event) => {
  const directionByKey: Record<string, Direction | undefined> = {
    ArrowUp: "up",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowLeft: "left",
    w: "up",
    d: "right",
    s: "down",
    a: "left",
    W: "up",
    D: "right",
    S: "down",
    A: "left",
  };
  const direction = directionByKey[event.key];

  if (!direction) {
    return;
  }

  event.preventDefault();
  requestMove(direction);
});

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Element #${id} was not found.`);
  }

  return element as T;
}

function snapshot(): Snapshot {
  return {
    board: cloneBoard(state.board),
    score: state.score,
    keepPlaying: state.keepPlaying,
  };
}

function pushHistory(): void {
  state.history.push(snapshot());

  if (state.history.length > HISTORY_LIMIT) {
    state.history.shift();
  }
}

function startNewGame(): void {
  clearAnimationTimers();
  queuedMoves = [];
  state.board = createInitialBoard();
  state.tiles = createRenderTiles(state.board, true);
  state.score = 0;
  state.helperCharges = createEmptyHelperCharges();
  state.keepPlaying = false;
  state.history = [];
  state.mode = "move";
  state.selection = [];
  state.isAnimating = false;
  state.lastGain = 0;
  state.message = "Ready";
  render();
  boardElement.focus();
}

function keepGoing(): void {
  if (state.isAnimating) {
    return;
  }

  state.keepPlaying = true;
  state.message = "Keep going";
  render();
  boardElement.focus();
}

function undo(): void {
  if (state.isAnimating) {
    return;
  }

  clearAnimationTimers();
  queuedMoves = [];

  if (state.helperCharges.undo <= 0) {
    state.message = "No undo uses";
    render();
    return;
  }

  const previous = state.history.pop();

  if (!previous) {
    state.message = "No undo";
    render();
    return;
  }

  state.board = cloneBoard(previous.board);
  state.tiles = createRenderTiles(state.board);
  state.score = previous.score;
  state.keepPlaying = previous.keepPlaying;
  state.helperCharges = consumeHelperCharge(state.helperCharges, "undo");
  state.mode = "move";
  state.selection = [];
  state.lastGain = 0;
  state.message = "Undone";
  render();
  boardElement.focus();
}

function toggleMode(mode: BoardHelperMode): void {
  if (state.isAnimating) {
    return;
  }

  if (getGameStatus(state.board, state.keepPlaying) !== "playing") {
    return;
  }

  if (state.helperCharges[mode] <= 0) {
    state.mode = "move";
    state.selection = [];
    state.message = `No ${HELPER_LABELS[mode]} uses`;
    render();
    return;
  }

  if (state.mode === mode) {
    state.mode = "move";
    state.selection = [];
    state.message = "Ready";
  } else {
    state.mode = mode;
    state.selection = [];
    state.message = mode === "swap" ? "Select first tile" : "Select tile";
  }

  state.lastGain = 0;
  queuedMoves = [];
  render();
  boardElement.focus();
}

function handleCellClick(position: Position): void {
  if (state.isAnimating) {
    return;
  }

  const status = getGameStatus(state.board, state.keepPlaying);

  if (status !== "playing" || state.mode === "move") {
    return;
  }

  if (state.helperCharges[state.mode] <= 0) {
    state.mode = "move";
    state.selection = [];
    state.message = "No helper uses";
    render();
    return;
  }

  if (!isOccupied(state.board, position)) {
    state.message = "Empty tile";
    render();
    return;
  }

  if (state.mode === "delete") {
    pushHistory();
    state.board = deleteTile(state.board, position);
    state.tiles = state.tiles.filter(
      (tile) => tile.row !== position.row || tile.col !== position.col,
    );
    state.helperCharges = consumeHelperCharge(state.helperCharges, "delete");
    state.keepPlaying = state.keepPlaying && getLargestTile(state.board) >= 2048;
    state.mode = "move";
    state.selection = [];
    state.lastGain = 0;
    state.message = "Deleted";
    render();
    return;
  }

  const selectedPosition = state.selection[0];

  if (!selectedPosition) {
    state.selection = [position];
    state.message = "Select second tile";
    render();
    return;
  }

  if (positionsEqual(selectedPosition, position)) {
    state.selection = [];
    state.message = "Select first tile";
    render();
    return;
  }

  pushHistory();
  state.board = swapTiles(state.board, selectedPosition, position);
  state.tiles = swapRenderTiles(state.tiles, selectedPosition, position);
  state.helperCharges = consumeHelperCharge(state.helperCharges, "swap");
  state.mode = "move";
  state.selection = [];
  state.lastGain = 0;
  state.message = "Swapped";
  render();
}

function move(direction: Direction): void {
  if (state.isAnimating) {
    queueMove(direction);
    return;
  }

  const status = getGameStatus(state.board, state.keepPlaying);

  if (status !== "playing") {
    return;
  }

  if (state.mode !== "move") {
    state.mode = "move";
    state.selection = [];
  }

  const result = moveBoard(state.board, direction);

  if (!result.moved) {
    state.message = "No move";
    state.lastGain = 0;
    render();
    return;
  }

  pushHistory();
  const spawn = spawnTileWithPosition(result.board);
  const moveAnimation = createMoveAnimation(state.tiles, direction, spawn);
  state.helperCharges = awardHelperCharges(
    state.helperCharges,
    moveAnimation.settledTiles
      .filter((tile) => tile.isMerged)
      .map((tile) => tile.value),
  );
  state.board = spawn.board;
  state.tiles = moveAnimation.displayTiles;
  state.isAnimating = true;
  state.score += result.scoreGain;
  state.bestScore = Math.max(state.bestScore, state.score);
  state.lastGain = result.scoreGain;
  state.message = result.scoreGain > 0 ? `+${result.scoreGain}` : "Moved";
  writeBestScore(state.bestScore);
  render();

  moveAnimationTimer = window.setTimeout(() => {
    state.tiles = moveAnimation.settledTiles;
    state.isAnimating = false;
    render();
    playQueuedMove();
  }, MOVE_SETTLE_MS);
}

function requestMove(direction: Direction): void {
  if (state.isAnimating) {
    queueMove(direction);
    return;
  }

  move(direction);
}

function queueMove(direction: Direction): void {
  if (queuedMoves.length >= MAX_QUEUED_MOVES) {
    queuedMoves.shift();
  }

  queuedMoves.push(direction);
}

function playQueuedMove(): void {
  if (state.isAnimating) {
    return;
  }

  const direction = queuedMoves.shift();

  if (!direction) {
    return;
  }

  move(direction);

  if (!state.isAnimating && queuedMoves.length > 0) {
    window.setTimeout(playQueuedMove, 0);
  }
}

function render(): void {
  const status = getGameStatus(state.board, state.keepPlaying);
  const occupiedCells = countOccupiedCells(state.board);

  scoreElement.textContent = String(state.score);
  bestScoreElement.textContent = String(state.bestScore);
  largestTileElement.textContent = String(getLargestTile(state.board));
  turnsCountElement.textContent = String(state.history.length);
  tilesCountElement.textContent = String(occupiedCells);
  statusLineElement.textContent = state.message;
  boardElement.dataset.mode = state.mode;

  undoButton.disabled =
    state.helperCharges.undo === 0 || state.history.length === 0 || state.isAnimating;
  swapButton.disabled =
    state.helperCharges.swap === 0 ||
    state.isAnimating ||
    status !== "playing" ||
    occupiedCells < 2;
  deleteButton.disabled =
    state.helperCharges.delete === 0 ||
    state.isAnimating ||
    status !== "playing" ||
    occupiedCells === 0;
  swapButton.classList.toggle("is-active", state.mode === "swap");
  deleteButton.classList.toggle("is-active", state.mode === "delete");
  swapButton.setAttribute("aria-pressed", String(state.mode === "swap"));
  deleteButton.setAttribute("aria-pressed", String(state.mode === "delete"));
  renderHelperCharges();

  renderTiles();
  renderOverlay(status);
  persistGameState();
  scheduleAnimationCleanup();
}

function renderGrid(): void {
  gridLayerElement.innerHTML = "";

  for (let index = 0; index < 16; index += 1) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    gridLayerElement.append(cell);
  }
}

function renderTiles(): void {
  const selectedKeys = new Set(
    state.selection.map((position) => `${position.row}:${position.col}`),
  );
  const liveIds = new Set(state.tiles.map((tile) => tile.id));

  tileLayerElement.querySelectorAll<HTMLButtonElement>(".tile").forEach((tile) => {
    if (!liveIds.has(Number(tile.dataset.id))) {
      tile.remove();
    }
  });

  state.tiles.forEach((tile) => {
    const selected = selectedKeys.has(`${tile.row}:${tile.col}`);
    let element = tileLayerElement.querySelector<HTMLButtonElement>(
      `.tile[data-id="${tile.id}"]`,
    );

    if (!element) {
      element = document.createElement("button");
      element.type = "button";
      element.className = "tile";
      element.dataset.id = String(tile.id);
      element.setAttribute("role", "gridcell");
      element.innerHTML = '<span class="tile-inner"></span>';
      tileLayerElement.append(element);
    }

    const inner = element.querySelector<HTMLSpanElement>(".tile-inner");
    if (!inner) {
      throw new Error("Tile inner element was not found.");
    }

    element.className = getTileClassName(tile, selected);
    element.dataset.row = String(tile.row);
    element.dataset.col = String(tile.col);
    element.setAttribute("aria-label", `Tile ${tile.value}`);
    inner.textContent = String(tile.value);
    applyTilePosition(element, tile);
  });
}

function renderOverlay(status: string): void {
  if (status === "won") {
    overlayElement.hidden = false;
    resultKickerElement.textContent = "Reached";
    resultTitleElement.textContent = "2048";
    keepGoingButton.hidden = false;
    return;
  }

  if (status === "over") {
    overlayElement.hidden = false;
    resultKickerElement.textContent = "No moves";
    resultTitleElement.textContent = "Game over";
    keepGoingButton.hidden = true;
    return;
  }

  overlayElement.hidden = true;
}

function getTileClassName(tile: RenderTile, selected: boolean): string {
  const classes = ["tile", `tile-${tile.value}`];

  if (tile.value >= 1024) {
    classes.push("is-small-text");
  }

  if (tile.value > 2048) {
    classes.push("tile-super");
  }

  if (selected) {
    classes.push("is-selected");
  }

  if (tile.isNew) {
    classes.push("is-new");
  }

  if (tile.isMerged) {
    classes.push("is-merged");
  }

  if (tile.isGhost) {
    classes.push("is-ghost");
  }

  return classes.join(" ");
}

function createRenderTiles(board: Board, markNew = false): RenderTile[] {
  const tiles: RenderTile[] = [];

  board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === 0) {
        return;
      }

      tiles.push({
        id: nextTileId,
        value,
        row: rowIndex,
        col: colIndex,
        isNew: markNew,
        isMerged: false,
        isGhost: false,
      });
      nextTileId += 1;
    });
  });

  return tiles;
}

function renderHelperCharges(): void {
  HELPER_ACTIONS.forEach((action) => {
    const button = helperButtons[action];
    const count = state.helperCharges[action];

    button.dataset.charges = String(count);
    button.title = `${HELPER_LABELS[action]}: ${count}/${HELPER_MAX_CHARGES}`;
    button.setAttribute(
      "aria-label",
      `${HELPER_LABELS[action]} (${count}/${HELPER_MAX_CHARGES})`,
    );

    helperChargeMeters[action]
      .querySelectorAll<HTMLElement>(".charge-pip")
      .forEach((pip, index) => {
        pip.classList.toggle("is-filled", index < count);
      });
  });
}

function createMoveAnimation(
  tiles: RenderTile[],
  direction: Direction,
  spawn: { position: Position | null; value: number | null },
): MoveAnimation {
  const displayTiles: RenderTile[] = [];
  const settledTiles: RenderTile[] = [];

  for (let lineIndex = 0; lineIndex < GRID_SIZE; lineIndex += 1) {
    const lineTiles = getLineTiles(tiles, direction, lineIndex);
    let outputIndex = 0;

    for (let index = 0; index < lineTiles.length; index += 1) {
      const current = lineTiles[index];
      const next = lineTiles[index + 1];

      if (next && current.value === next.value) {
        const targetPosition = getTargetPosition(direction, lineIndex, outputIndex);
        const mergedTile: RenderTile = {
          id: nextTileId,
          value: current.value * 2,
          ...targetPosition,
          isNew: false,
          isMerged: true,
          isGhost: false,
        };

        displayTiles.push({
          ...current,
          ...targetPosition,
          isNew: false,
          isMerged: false,
          isGhost: true,
        });
        displayTiles.push({
          ...next,
          ...targetPosition,
          isNew: false,
          isMerged: false,
          isGhost: true,
        });
        displayTiles.push(mergedTile);
        settledTiles.push(mergedTile);
        nextTileId += 1;
        index += 1;
      } else {
        const targetPosition = getTargetPosition(direction, lineIndex, outputIndex);

        displayTiles.push({
          ...current,
          ...targetPosition,
          isNew: false,
          isMerged: false,
          isGhost: false,
        });
        settledTiles.push({
          ...current,
          ...targetPosition,
          isNew: false,
          isMerged: false,
          isGhost: false,
        });
      }

      outputIndex += 1;
    }
  }

  if (spawn.position && spawn.value) {
    const spawnedTile: RenderTile = {
      id: nextTileId,
      value: spawn.value,
      row: spawn.position.row,
      col: spawn.position.col,
      isNew: true,
      isMerged: false,
      isGhost: false,
    };

    displayTiles.push(spawnedTile);
    settledTiles.push(spawnedTile);
    nextTileId += 1;
  }

  return { displayTiles, settledTiles };
}

function getLineTiles(
  tiles: RenderTile[],
  direction: Direction,
  lineIndex: number,
): RenderTile[] {
  const lineTiles = tiles.filter((tile) =>
    direction === "left" || direction === "right"
      ? tile.row === lineIndex
      : tile.col === lineIndex,
  );

  return lineTiles.sort((first, second) => {
    if (direction === "left") {
      return first.col - second.col;
    }

    if (direction === "right") {
      return second.col - first.col;
    }

    if (direction === "up") {
      return first.row - second.row;
    }

    return second.row - first.row;
  });
}

function getTargetPosition(
  direction: Direction,
  lineIndex: number,
  outputIndex: number,
): Position {
  if (direction === "left") {
    return { row: lineIndex, col: outputIndex };
  }

  if (direction === "right") {
    return { row: lineIndex, col: GRID_SIZE - 1 - outputIndex };
  }

  if (direction === "up") {
    return { row: outputIndex, col: lineIndex };
  }

  return { row: GRID_SIZE - 1 - outputIndex, col: lineIndex };
}

function swapRenderTiles(
  tiles: RenderTile[],
  first: Position,
  second: Position,
): RenderTile[] {
  return tiles.map((tile) => {
    if (positionsEqual(tile, first)) {
      return {
        ...tile,
        row: second.row,
        col: second.col,
        isNew: false,
        isMerged: false,
        isGhost: false,
      };
    }

    if (positionsEqual(tile, second)) {
      return {
        ...tile,
        row: first.row,
        col: first.col,
        isNew: false,
        isMerged: false,
        isGhost: false,
      };
    }

    return { ...tile, isNew: false, isMerged: false, isGhost: false };
  });
}

function syncTileMetrics(): void {
  const styles = getComputedStyle(tileLayerElement);
  const gap = Number.parseFloat(styles.getPropertyValue("--board-gap")) || 15;
  const width = tileLayerElement.clientWidth;
  const size = Math.max((width - gap * (GRID_SIZE - 1)) / GRID_SIZE, 0);

  tileMetrics = { size, gap };
  tileLayerElement.style.setProperty("--tile-size", `${size}px`);
}

function applyTilePosition(element: HTMLElement, tile: RenderTile): void {
  const x = tile.col * (tileMetrics.size + tileMetrics.gap);
  const y = tile.row * (tileMetrics.size + tileMetrics.gap);

  element.style.transform = `translate(${x}px, ${y}px)`;
}

function scheduleAnimationCleanup(): void {
  if (!state.tiles.some((tile) => tile.isNew || tile.isMerged)) {
    return;
  }

  window.clearTimeout(animationCleanupTimer);
  animationCleanupTimer = window.setTimeout(() => {
    state.tiles = state.tiles.map((tile) => ({
      ...tile,
      isNew: false,
      isMerged: false,
      isGhost: false,
    }));
    renderTiles();
  }, ANIMATION_RESET_MS);
}

function clearAnimationTimers(): void {
  window.clearTimeout(moveAnimationTimer);
  window.clearTimeout(animationCleanupTimer);
  state.isAnimating = false;
}

function readBestScore(): number {
  try {
    const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(stored) ? stored : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(bestScore: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch {
    window.console.warn("Could not persist best score.");
  }
}

function persistGameState(): void {
  const gameState: PersistedGame = {
    version: 1,
    board: cloneBoard(state.board),
    score: state.score,
    bestScore: state.bestScore,
    helperCharges: { ...state.helperCharges },
    keepPlaying: state.keepPlaying,
    history: state.history.map((item) => ({
      board: cloneBoard(item.board),
      score: item.score,
      keepPlaying: item.keepPlaying,
    })),
  };

  try {
    window.localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    writeHelperCharges(state.helperCharges);
    writeBestScore(state.bestScore);
  } catch {
    window.console.warn("Could not persist game state.");
  }
}

function readGameState(): PersistedGame | null {
  try {
    const stored = window.localStorage.getItem(GAME_STATE_KEY);

    if (!stored) {
      return null;
    }

    const value = JSON.parse(stored) as unknown;
    return parsePersistedGame(value);
  } catch {
    return null;
  }
}

function parsePersistedGame(value: unknown): PersistedGame | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const board = parseBoard(value.board);
  const history = parseHistory(value.history);
  const score = parseNonNegativeInteger(value.score);
  const bestScore = parseNonNegativeInteger(value.bestScore);
  const helperCharges = parsePersistedHelperCharges(value.helperCharges, board);

  if (
    !board ||
    !history ||
    !helperCharges ||
    score === null ||
    bestScore === null ||
    typeof value.keepPlaying !== "boolean"
  ) {
    return null;
  }

  return {
    version: 1,
    board,
    score,
    bestScore,
    helperCharges,
    keepPlaying: value.keepPlaying,
    history,
  };
}

function parsePersistedHelperCharges(
  value: unknown,
  board: Board | null,
): HelperCharges | null {
  if (value !== undefined) {
    return parseHelperCharges(value);
  }

  return readHelperCharges() ?? inferHelperChargesFromBoard(board);
}

function readHelperCharges(): HelperCharges | null {
  try {
    const stored = window.localStorage.getItem(HELPER_CHARGES_KEY);

    if (!stored) {
      return null;
    }

    return parseHelperCharges(JSON.parse(stored));
  } catch {
    return null;
  }
}

function writeHelperCharges(helperCharges: HelperCharges): void {
  window.localStorage.setItem(HELPER_CHARGES_KEY, JSON.stringify(helperCharges));
}

function parseHistory(value: unknown): Snapshot[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const snapshots = value.slice(-HISTORY_LIMIT).map((item) => {
    if (!isRecord(item) || typeof item.keepPlaying !== "boolean") {
      return null;
    }

    const board = parseBoard(item.board);
    const score = parseNonNegativeInteger(item.score);

    if (!board || score === null) {
      return null;
    }

    return {
      board,
      score,
      keepPlaying: item.keepPlaying,
    };
  });

  if (snapshots.some((item) => item === null)) {
    return null;
  }

  return snapshots as Snapshot[];
}

function parseBoard(value: unknown): Board | null {
  if (!Array.isArray(value) || value.length !== GRID_SIZE) {
    return null;
  }

  const board = value.map((row) => {
    if (!Array.isArray(row) || row.length !== GRID_SIZE) {
      return null;
    }

    const parsedRow = row.map((cell) => {
      const parsedCell = parseTileValue(cell);
      return parsedCell;
    });

    return parsedRow.some((cell) => cell === null) ? null : parsedRow;
  });

  if (board.some((row) => row === null)) {
    return null;
  }

  return board as Board;
}

function parseTileValue(value: unknown): number | null {
  const numberValue = Number(value);

  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    return null;
  }

  if (numberValue === 0) {
    return 0;
  }

  return numberValue >= 2 && Number.isInteger(Math.log2(numberValue))
    ? numberValue
    : null;
}

function parseNonNegativeInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= 0
    ? numberValue
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
