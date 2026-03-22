import {
  buildAtomIndex,
  buildConfigMap,
  listAtomDefinitions,
  step,
  type Board,
  type MoveDirection,
  type MoveEvent,
  type SequenceConfig,
  type SpawnResult
} from "../core";
import { loadBestScore, saveBestScore } from "./best-score";
import { DIRECTIONS, STATUS_TEXT, type StrategicRatio } from "./constants";
import { hasAvailableMove } from "./deadlock";
import type { UiElements } from "./dom";
import { formatEvent, render } from "./render";
import { createStrategicSpawnPolicy } from "./spawn-policy";
import { createInitialState, type GameState } from "./state";

export type GameController = {
  initialize: () => void;
  executeMove: (direction: MoveDirection) => void;
  restartGame: () => void;
  toggleBestScoreDisplay: () => void;
  toggleTileTextVisibility: (tileId: number) => void;
};

function placeSpawn(board: Board, spawn: Exclude<SpawnResult, null>): Board {
  const next = board.map((row) => row.slice());
  const [row, col] = spawn.position;
  next[row][col] = spawn.tile;
  return next;
}

function collectTileIds(board: Board): Set<number> {
  const tileIds = new Set<number>();

  for (const row of board) {
    for (const tile of row) {
      if (tile) {
        tileIds.add(tile.id);
      }
    }
  }

  return tileIds;
}

export function createGameController(ui: UiElements, configs: SequenceConfig[], strategicRatio: StrategicRatio): GameController {
  const atomIndex = buildAtomIndex(configs);
  const atomPool = listAtomDefinitions(configs);
  const configMap = buildConfigMap(configs);
  const spawnPolicy = createStrategicSpawnPolicy(atomPool, configMap, strategicRatio);

  const state: GameState = createInitialState(configs, loadBestScore());

  const renderNow = (): void => {
    render(ui, state, configs);
  };

  const syncHiddenTileIds = (board: Board): void => {
    const currentTileIds = collectTileIds(board);
    for (const hiddenId of Array.from(state.hiddenTileIds)) {
      if (!currentTileIds.has(hiddenId)) {
        state.hiddenTileIds.delete(hiddenId);
      }
    }
  };

  const resetState = (): void => {
    const next = createInitialState(configs, state.bestScoreStats, state.bestScoreDisplayMode);
    state.board = next.board;
    state.score = next.score;
    state.bestScoreStats = next.bestScoreStats;
    state.bestScoreDisplayMode = next.bestScoreDisplayMode;
    state.hiddenTileIds = next.hiddenTileIds;
    state.moves = next.moves;
    state.status = next.status;
    state.eventLines = next.eventLines;
    state.completedCounts = next.completedCounts;
    state.gameOver = next.gameOver;
  };

  const persistCurrentScoreIfNeeded = (): void => {
    if (state.moves === 0 && state.score === 0 && !state.gameOver) {
      return;
    }

    state.bestScoreStats = saveBestScore(state.score);
  };

  const applyCompletionCounts = (events: MoveEvent[]): void => {
    for (const event of events) {
      if (event.type !== "merge" || !event.completedSequenceId) {
        continue;
      }

      const sequenceId = event.completedSequenceId;
      state.completedCounts[sequenceId] = (state.completedCounts[sequenceId] ?? 0) + 1;
    }
  };

  const updateGameOverState = (board: Board): boolean => {
    const wasGameOver = state.gameOver;

    state.gameOver = !hasAvailableMove(board, DIRECTIONS, configMap);
    if (state.gameOver) {
      state.status = STATUS_TEXT.gameOver;
    }

    return !wasGameOver && state.gameOver;
  };

  const setStatusAfterMove = (scoreDelta: number): void => {
    if (state.gameOver) {
      return;
    }

    state.status = scoreDelta > 0 ? `Gained ${scoreDelta} score this move.` : STATUS_TEXT.moveApplied;
  };

  const seedBoard = (): void => {
    resetState();
    for (let i = 0; i < 2; i += 1) {
      const spawn = spawnPolicy({ board: state.board, configs });
      if (!spawn) {
        break;
      }

      state.board = placeSpawn(state.board, spawn);
    }

    syncHiddenTileIds(state.board);
    updateGameOverState(state.board);
  };

  const executeMove = (direction: MoveDirection): void => {
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

      renderNow();
      return;
    }

    state.board = result.board;
    syncHiddenTileIds(state.board);
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
    renderNow();
  };

  const restartGame = (): void => {
    persistCurrentScoreIfNeeded();
    seedBoard();
    renderNow();
  };

  const toggleBestScoreDisplay = (): void => {
    state.bestScoreDisplayMode = state.bestScoreDisplayMode === "highest" ? "lowest" : "highest";
    renderNow();
  };

  const toggleTileTextVisibility = (tileId: number): void => {
    if (state.hiddenTileIds.has(tileId)) {
      state.hiddenTileIds.delete(tileId);
    } else {
      state.hiddenTileIds.add(tileId);
    }

    renderNow();
  };

  const initialize = (): void => {
    seedBoard();
    renderNow();

    console.log("Atom index:", atomIndex);
    console.log("Atom pool size:", atomPool.length);
  };

  return {
    initialize,
    executeMove,
    restartGame,
    toggleBestScoreDisplay,
    toggleTileTextVisibility
  };
}