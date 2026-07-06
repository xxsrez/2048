import { createIcons, icons } from "lucide";
import "./styles.css";
import {
  Board,
  Direction,
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
  spawnTile,
  swapTiles,
} from "./game";

type HelperMode = "move" | "swap" | "delete";

interface Snapshot {
  board: Board;
  score: number;
  keepPlaying: boolean;
}

interface RuntimeState {
  board: Board;
  score: number;
  bestScore: number;
  keepPlaying: boolean;
  history: Snapshot[];
  mode: HelperMode;
  selection: Position[];
  lastGain: number;
  message: string;
}

const BEST_SCORE_KEY = "local-2048-best-score";
const HISTORY_LIMIT = 100;
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
          <span class="mode-chip">4x4</span>
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
      </header>

      <nav class="toolbar" aria-label="Game controls">
        <button class="tool-button primary" id="new-game" type="button" title="New game" aria-label="New game">
          <i data-lucide="rotate-ccw"></i>
          <span>New</span>
        </button>
        <button class="tool-button" id="undo" type="button" title="Undo" aria-label="Undo">
          <i data-lucide="undo-2"></i>
          <span>Undo</span>
        </button>
        <button class="tool-button" id="swap" type="button" title="Swap 2" aria-label="Swap 2" aria-pressed="false">
          <i data-lucide="arrow-left-right"></i>
          <span>Swap 2</span>
        </button>
        <button class="tool-button danger" id="delete" type="button" title="Delete tile" aria-label="Delete tile" aria-pressed="false">
          <i data-lucide="eraser"></i>
          <span>Delete</span>
        </button>
      </nav>

      <div class="board-frame">
        <div class="board" id="board" role="grid" aria-label="2048 board" tabindex="0"></div>
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

let pointerStart: { x: number; y: number } | null = null;

const state: RuntimeState = {
  board: createInitialBoard(),
  score: 0,
  bestScore: readBestScore(),
  keepPlaying: false,
  history: [],
  mode: "move",
  selection: [],
  lastGain: 0,
  message: "Ready",
};

render();

newGameButton.addEventListener("click", startNewGame);
restartButton.addEventListener("click", startNewGame);
keepGoingButton.addEventListener("click", keepGoing);
undoButton.addEventListener("click", undo);
swapButton.addEventListener("click", () => toggleMode("swap"));
deleteButton.addEventListener("click", () => toggleMode("delete"));

boardElement.addEventListener("click", (event) => {
  const cell = (event.target as HTMLElement).closest<HTMLButtonElement>(".cell");

  if (!cell) {
    return;
  }

  handleCellClick({
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
  });
});

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

  move(Math.abs(diffX) > Math.abs(diffY) ? (diffX > 0 ? "right" : "left") : diffY > 0 ? "down" : "up");
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
  move(direction);
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
  state.board = createInitialBoard();
  state.score = 0;
  state.keepPlaying = false;
  state.history = [];
  state.mode = "move";
  state.selection = [];
  state.lastGain = 0;
  state.message = "Ready";
  render();
  boardElement.focus();
}

function keepGoing(): void {
  state.keepPlaying = true;
  state.message = "Keep going";
  render();
  boardElement.focus();
}

function undo(): void {
  const previous = state.history.pop();

  if (!previous) {
    state.message = "No undo";
    render();
    return;
  }

  state.board = cloneBoard(previous.board);
  state.score = previous.score;
  state.keepPlaying = previous.keepPlaying;
  state.mode = "move";
  state.selection = [];
  state.lastGain = 0;
  state.message = "Undone";
  render();
  boardElement.focus();
}

function toggleMode(mode: Exclude<HelperMode, "move">): void {
  if (getGameStatus(state.board, state.keepPlaying) !== "playing") {
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
  render();
  boardElement.focus();
}

function handleCellClick(position: Position): void {
  const status = getGameStatus(state.board, state.keepPlaying);

  if (status !== "playing" || state.mode === "move") {
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
  state.mode = "move";
  state.selection = [];
  state.lastGain = 0;
  state.message = "Swapped";
  render();
}

function move(direction: Direction): void {
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
  state.board = spawnTile(result.board);
  state.score += result.scoreGain;
  state.bestScore = Math.max(state.bestScore, state.score);
  state.lastGain = result.scoreGain;
  state.message = result.scoreGain > 0 ? `+${result.scoreGain}` : "Moved";
  writeBestScore(state.bestScore);
  render();
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

  undoButton.disabled = state.history.length === 0;
  swapButton.disabled = status !== "playing" || occupiedCells < 2;
  deleteButton.disabled = status !== "playing" || occupiedCells === 0;
  swapButton.classList.toggle("is-active", state.mode === "swap");
  deleteButton.classList.toggle("is-active", state.mode === "delete");
  swapButton.setAttribute("aria-pressed", String(state.mode === "swap"));
  deleteButton.setAttribute("aria-pressed", String(state.mode === "delete"));

  renderBoard();
  renderOverlay(status);
}

function renderBoard(): void {
  const selectedKeys = new Set(
    state.selection.map((position) => `${position.row}:${position.col}`),
  );

  boardElement.innerHTML = "";
  state.board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const cell = document.createElement("button");
      const selected = selectedKeys.has(`${rowIndex}:${colIndex}`);
      cell.type = "button";
      cell.className = getCellClassName(value, selected);
      cell.dataset.row = String(rowIndex);
      cell.dataset.col = String(colIndex);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute(
        "aria-label",
        value > 0 ? `Tile ${value}` : "Empty tile",
      );
      cell.textContent = value > 0 ? String(value) : "";

      boardElement.append(cell);
    });
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

function getCellClassName(value: number, selected: boolean): string {
  const classes = ["cell"];

  if (value === 0) {
    classes.push("is-empty");
  } else {
    classes.push("tile", `tile-${value}`);
  }

  if (value >= 1024) {
    classes.push("is-small-text");
  }

  if (selected) {
    classes.push("is-selected");
  }

  return classes.join(" ");
}

function readBestScore(): number {
  const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(stored) ? stored : 0;
}

function writeBestScore(bestScore: number): void {
  window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
}
