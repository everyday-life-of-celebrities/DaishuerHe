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
  const next = createInitialState(configs, state.bestScore);
  state.board = next.board;
  state.score = next.score;
  state.bestScore = next.bestScore;
  state.moves = next.moves;
  state.status = next.status;
  state.eventLines = next.eventLines;
  state.completedCounts = next.completedCounts;
  state.gameOver = next.gameOver;
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

function updateGameOverState(board: Board): void {
  state.gameOver = !hasAvailableMove(board, DIRECTIONS, configMap);
  if (state.gameOver) {
    state.status = STATUS_TEXT.gameOver;
  }
}

function syncBestScore(): void {
  if (state.score <= state.bestScore) {
    return;
  }

  state.bestScore = state.score;
  saveBestScore(state.bestScore);
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
    updateGameOverState(state.board);
    if (!state.gameOver) {
      state.status = STATUS_TEXT.noMove;
    }

    render(ui, state, configs);
    return;
  }

  state.board = result.board;
  state.moves += 1;

  const scoreDelta = result.rewards.reduce((acc, reward) => acc + (reward.reward?.score ?? 0), 0);
  state.score += scoreDelta;
  syncBestScore();
  applyCompletionCounts(result.events);

  updateGameOverState(state.board);
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

document.addEventListener("keydown", (event) => {
  const keyMap: Record<string, MoveDirection> = {
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    ArrowDown: "Down"
  };

  const dir = keyMap[event.key];
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

function restartGame(): void {
  seedBoard();
  render(ui, state, configs);
}

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