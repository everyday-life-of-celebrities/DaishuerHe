import type { Board, MoveEvent, SequenceConfig, Tile } from "../core";
import { updateGameOverUI, type UiElements } from "./dom";
import type { GameState } from "./state";

function buildSequenceLengthMap(configs: SequenceConfig[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const config of configs) {
    map.set(config.id, config.atoms.length);
  }
  return map;
}

function isFinalTile(tile: Tile, sequenceLengthMap: Map<string, number>): boolean {
  const sequenceLength = sequenceLengthMap.get(tile.sequenceId);
  if (sequenceLength === undefined) {
    return false;
  }

  return tile.start === 0 && tile.end === sequenceLength - 1;
}

function tileClass(tile: Tile, sequenceLengthMap: Map<string, number>): string {
  if (isFinalTile(tile, sequenceLengthMap)) {
    return "tile tile-l6";
  }

  const length = tile.end - tile.start + 1;
  const level = Math.min(6, Math.max(1, length));
  return `tile tile-l${level}`;
}

function getBoardColumnCount(board: Board): number {
  return board[0]?.length ?? 0;
}

function computeTileFontSize(tile: Tile): number {
  const glyphCount = Math.max(1, Array.from(tile.symbol).length);
  const size = (-2 / 5) * glyphCount + 25;
  return Math.max(12, size);
}

export function formatEvent(event: MoveEvent): string {
  switch (event.type) {
    case "slide":
      return `slide #${event.tileId} ${event.from.join(",")} -> ${event.to.join(",")}`;
    case "merge":
      if (event.completedSequenceId) {
        return `merge [${event.consumedTileIds.join("+")}] completed ${event.completedSequenceId}`;
      }
      return `merge [${event.consumedTileIds.join("+")}] => ${event.resultTile?.symbol ?? "?"}`;
    case "reward":
      return `reward ${event.sequenceId} +${event.reward?.score ?? 0}`;
    case "spawn":
      return `spawn ${event.tile.symbol} @ ${event.at.join(",")}`;
    default:
      return "event";
  }
}

function renderBoard(
  board: Board,
  boardElement: HTMLDivElement,
  sequenceLengthMap: Map<string, number>
): void {
  const fragment = document.createDocumentFragment();
  const columnCount = getBoardColumnCount(board);
  boardElement.style.setProperty("--board-cols", String(Math.max(1, columnCount)));

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const tile = board[row][col];
      if (tile) {
        const tileElement = document.createElement("div");
        tileElement.className = tileClass(tile, sequenceLengthMap);
        tileElement.style.setProperty("--tile-font-size", `${computeTileFontSize(tile)}px`);
        tileElement.textContent = tile.symbol;
        cell.appendChild(tileElement);
      }

      fragment.appendChild(cell);
    }
  }

  boardElement.replaceChildren(fragment);
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

export function render(ui: UiElements, state: GameState, configs: SequenceConfig[]): void {
  ui.scoreElement.textContent = String(state.score);
  ui.bestScoreElement.textContent = String(state.bestScore);
  ui.movesElement.textContent = String(state.moves);
  ui.statusElement.textContent = state.status;
  ui.eventsElement.textContent = state.eventLines.join("\n");

  const sequenceLengthMap = buildSequenceLengthMap(configs);
  renderCompletedCounts(ui.completedCountsElement, state.completedCounts, configs);
  renderBoard(state.board, ui.boardElement, sequenceLengthMap);
  updateGameOverUI(ui, state.gameOver);
}
