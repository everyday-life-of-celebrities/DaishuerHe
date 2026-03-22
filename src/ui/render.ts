import type { SequenceConfig } from "../core";
import { updateGameOverUI, type UiElements } from "./dom";
import { renderBoard } from "./render-board";
import type { GameState } from "./state";

function buildSequenceLengthMap(configs: SequenceConfig[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const config of configs) {
    map.set(config.id, config.atoms.length);
  }
  return map;
}

function getDisplayedBestScore(state: GameState): number {
  if (!state.bestScoreStats.hasSample) {
    return 0;
  }

  return state.bestScoreDisplayMode === "highest" ? state.bestScoreStats.highest : state.bestScoreStats.lowest;
}

function renderCompletedCounts(
  completedCountsElement: HTMLUListElement,
  completedCounts: Record<string, number>,
  configs: SequenceConfig[]
): void {
  const fragment = document.createDocumentFragment();

  for (const config of configs) {
    const item = document.createElement("li");
    item.className = "completed-item";

    const label = document.createElement("span");
    label.textContent = config.id;

    const value = document.createElement("strong");
    value.textContent = String(completedCounts[config.id] ?? 0);

    item.append(label, value);
    fragment.appendChild(item);
  }

  completedCountsElement.replaceChildren(fragment);
}

export { formatEvent } from "./event-format";

export function render(ui: UiElements, state: GameState, configs: SequenceConfig[]): void {
  const showingHighest = state.bestScoreDisplayMode === "highest";

  ui.scoreElement.textContent = String(state.score);
  ui.bestScoreLabelElement.textContent = showingHighest ? "Best" : "Worst";
  ui.bestScoreButton.textContent = String(getDisplayedBestScore(state));
  ui.movesElement.textContent = String(state.moves);
  ui.statusElement.textContent = state.status;
  ui.eventsElement.textContent = state.eventLines.join("\n");

  const sequenceLengthMap = buildSequenceLengthMap(configs);
  renderCompletedCounts(ui.completedCountsElement, state.completedCounts, configs);
  renderBoard(state.board, ui.boardElement, state.hiddenTileIds, sequenceLengthMap);
  updateGameOverUI(ui, state.gameOver);
}
