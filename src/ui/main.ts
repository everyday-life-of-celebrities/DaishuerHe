import {
  buildAtomIndex,
  buildConfigMap,
  listAtomDefinitions,
  step,
  type Board,
  type MoveDirection,
  type MoveEvent,
  type SpawnResult
} from "../core";
import { loadBestScore, saveBestScore } from "./best-score";
import { DIRECTIONS, ElPsyCongroo, STATUS_TEXT } from "./constants";
import { hasAvailableMove } from "./deadlock";
import { mountUi } from "./dom";
import { formatEvent, render } from "./render";
import { configs } from "./seq-data";
import { createStrategicSpawnPolicy } from "./spawn-policy";
import { createInitialState, type GameState } from "./state";

const ui = mountUi();

const atomIndex = buildAtomIndex(configs);
const atomPool = listAtomDefinitions(configs);
const configMap = buildConfigMap(configs);
const spawnPolicy = createStrategicSpawnPolicy(atomPool, configMap);

const state: GameState = createInitialState(configs, loadBestScore());

function placeSpawn(board: Board, spawn: Exclude<SpawnResult, null>): Board {
  const next = board.map((row) => row.slice());
  const [row, col] = spawn.position;
  next[row][col] = spawn.tile;
  return next;
}

function resetState(): void {
  const next = createInitialState(configs, state.bestScoreStats, state.bestScoreDisplayMode);
  state.board = next.board;
  state.score = next.score;
  state.bestScoreStats = next.bestScoreStats;
  state.bestScoreDisplayMode = next.bestScoreDisplayMode;
  state.moves = next.moves;
  state.status = next.status;
  state.eventLines = next.eventLines;
  state.completedCounts = next.completedCounts;
  state.gameOver = next.gameOver;
}

function persistCurrentScoreIfNeeded(): void {
  if (state.moves === 0 && state.score === 0 && !state.gameOver) {
    return;
  }

  state.bestScoreStats = saveBestScore(state.score);
}

function seedBoard(): void {
  resetState();
  for (let i = 0; i < 2; i += 1) {
    const spawn = spawnPolicy({ board: state.board, configs });
    if (!spawn) {
      break;
    }

    state.board = placeSpawn(state.board, spawn);
  }

  updateGameOverState(state.board);
}

function applyCompletionCounts(events: MoveEvent[]): void {
  for (const event of events) {
    if (event.type !== "merge" || !event.completedSequenceId) {
      continue;
    }

    const sequenceId = event.completedSequenceId;
    state.completedCounts[sequenceId] = (state.completedCounts[sequenceId] ?? 0) + 1;
  }
}

function updateGameOverState(board: Board): boolean {
  const wasGameOver = state.gameOver;

  state.gameOver = !hasAvailableMove(board, DIRECTIONS, configMap);
  if (state.gameOver) {
    state.status = STATUS_TEXT.gameOver;
  }

  return !wasGameOver && state.gameOver;
}

function setStatusAfterMove(scoreDelta: number): void {
  if (state.gameOver) {
    return;
  }

  state.status = scoreDelta > 0 ? `Gained ${scoreDelta} score this move.` : STATUS_TEXT.moveApplied;
}

function executeMove(direction: MoveDirection): void {
  if (state.gameOver) {
    return;
  }

  const result = step(state.board, direction, configs, spawnPolicy);
  if (!result.changed) {
    const justGameOver = updateGameOverState(state.board);
    if (justGameOver) {
      persistCurrentScoreIfNeeded();
    } else {
      state.status = STATUS_TEXT.noMove;
    }

    render(ui, state, configs);
    return;
  }

  state.board = result.board;
  state.moves += 1;

  const scoreDelta = result.rewards.reduce((acc, reward) => acc + (reward.reward?.score ?? 0), 0);
  state.score += scoreDelta;
  applyCompletionCounts(result.events);

  const justGameOver = updateGameOverState(state.board);
  if (justGameOver) {
    persistCurrentScoreIfNeeded();
  }

  setStatusAfterMove(scoreDelta);

  state.eventLines = result.events.slice(-8).map(formatEvent);
  render(ui, state, configs);
}

function parseDirection(value: string | null): MoveDirection | null {
  if (!value) {
    return null;
  }

  return DIRECTIONS.includes(value as MoveDirection) ? (value as MoveDirection) : null;
}

const KEY_TO_DIRECTION: Record<string, MoveDirection> = {
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  a: "Left",
  A: "Left",
  d: "Right",
  D: "Right",
  w: "Up",
  W: "Up",
  s: "Down",
  S: "Down",
  KeyA: "Left",
  KeyD: "Right",
  KeyW: "Up",
  KeyS: "Down"
};

type TouchPoint = {
  x: number;
  y: number;
};

const SWIPE_MIN_DISTANCE_PX = 28;
let touchStartPoint: TouchPoint | null = null;

function toSwipeDirection(start: TouchPoint, end: TouchPoint): MoveDirection | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_DISTANCE_PX) {
    return null;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "Right" : "Left";
  }

  return dy >= 0 ? "Down" : "Up";
}

function handleTouchStart(event: TouchEvent): void {
  if (event.touches.length !== 1) {
    touchStartPoint = null;
    return;
  }

  const touch = event.touches[0];
  touchStartPoint = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(event: TouchEvent): void {
  if (!touchStartPoint) {
    return;
  }

  if (event.changedTouches.length < 1) {
    touchStartPoint = null;
    return;
  }

  const touch = event.changedTouches[0];
  const direction = toSwipeDirection(touchStartPoint, { x: touch.clientX, y: touch.clientY });
  touchStartPoint = null;

  if (!direction) {
    return;
  }

  event.preventDefault();
  executeMove(direction);
}

function handleTouchCancel(): void {
  touchStartPoint = null;
}

function isRestartKey(event: KeyboardEvent): boolean {
  return event.key === "n" || event.key === "N" || event.code === "KeyN";
}

function restartGame(): void {
  persistCurrentScoreIfNeeded();
  seedBoard();
  render(ui, state, configs);
}

function toggleBestScoreDisplay(): void {
  state.bestScoreDisplayMode = state.bestScoreDisplayMode === "highest" ? "lowest" : "highest";
  render(ui, state, configs);
}

document.addEventListener("keydown", (event) => {
  if (isRestartKey(event)) {
    event.preventDefault();
    restartGame();
    return;
  }

  const dir = KEY_TO_DIRECTION[event.key] ?? KEY_TO_DIRECTION[event.code];
  if (!dir) {
    return;
  }

  event.preventDefault();
  executeMove(dir);
});

document.querySelectorAll<HTMLButtonElement>("button[data-dir]").forEach((button) => {
  button.addEventListener("click", () => {
    const dir = parseDirection(button.dataset.dir ?? null);
    if (dir) {
      executeMove(dir);
    }
  });
});

ui.boardElement.addEventListener("touchstart", handleTouchStart, { passive: true });
ui.boardElement.addEventListener("touchend", handleTouchEnd, { passive: false });
ui.boardElement.addEventListener("touchcancel", handleTouchCancel);

ui.bestScoreButton.addEventListener("click", toggleBestScoreDisplay);
ui.restartButton.addEventListener("click", restartGame);
ui.retryButtonElement.addEventListener("click", () => {
  window.open(
    ElPsyCongroo([104, 116, 116, 112, 115, 58, 47, 47, 116, 105, 97, 110, 46, 98, 105, 99, 109, 114, 46, 112, 107, 117, 46, 101, 100, 117, 46, 99, 110]),
    "_blank",
    "noopener,noreferrer"
  );
});

seedBoard();
render(ui, state, configs);

console.log("Atom index:", atomIndex);
console.log("Atom pool size:", atomPool.length);