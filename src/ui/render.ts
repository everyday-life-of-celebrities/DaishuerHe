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

function parseCssPixels(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateCellSize(boardElement: HTMLDivElement, columnCount: number): number {
  const safeColumnCount = Math.max(1, columnCount);
  const boardWidth = boardElement.clientWidth;

  if (boardWidth <= 0) {
    return 72;
  }

  const style = window.getComputedStyle(boardElement);
  const gap = parseCssPixels(style.columnGap || style.gap);
  const totalGap = Math.max(0, safeColumnCount - 1) * gap;
  return Math.max(24, (boardWidth - totalGap) / safeColumnCount);
}

const FONT_SIZE_SCALE = 0.9;
const FONT_SIZE_CELL_REFERENCE = 96;
const FONT_SIZE_CELL_EXPONENT = 0.9;

function computeFontSizeBaseline(glyphCount: number): number {
  // Keep the original slower shrink style: ~25px for short text, ~21px around 25 glyphs.
  return 25 - (glyphCount - 1) / 6;
}

function computeFontSizeFitCap(cellSize: number, glyphCount: number): number {
  const usable = Math.max(16, cellSize - 8);

  const estimatedCols = Math.max(1, Math.ceil(Math.sqrt(glyphCount)));
  const estimatedRows = Math.max(1, Math.ceil(glyphCount / estimatedCols));

  const widthCap = usable / (estimatedCols * 0.95);
  const heightCap = usable / (estimatedRows * 1.08);
  return Math.min(widthCap, heightCap);
}

function computeTileFontSize(tile: Tile, cellSize: number): number {
  const glyphCount = Math.max(1, Array.from(tile.symbol).length);

  const baseline = computeFontSizeBaseline(glyphCount);
  const fitCap = computeFontSizeFitCap(cellSize, glyphCount);

  const rawCellScale = Math.pow(cellSize / FONT_SIZE_CELL_REFERENCE, FONT_SIZE_CELL_EXPONENT);
  const cellScale = Math.min(1, Math.max(0.62, rawCellScale));
  const computed = Math.min(baseline, fitCap) * FONT_SIZE_SCALE * cellScale;

  const minSize = Math.max(9, Math.min(12, cellSize * 0.16));
  const maxSize = 26;
  return Math.max(minSize, Math.min(maxSize, computed));
}

function getDisplayedBestScore(state: GameState): number {
  if (!state.bestScoreStats.hasSample) {
    return 0;
  }

  return state.bestScoreDisplayMode === "highest" ? state.bestScoreStats.highest : state.bestScoreStats.lowest;
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
  sequenceLengthMap: Map<string, number>,
  hiddenTileIds: ReadonlySet<number>
): void {
  const fragment = document.createDocumentFragment();
  const columnCount = getBoardColumnCount(board);
  boardElement.style.setProperty("--board-cols", String(Math.max(1, columnCount)));

  const cellSize = estimateCellSize(boardElement, columnCount);

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const tile = board[row][col];
      if (tile) {
        const tileElement = document.createElement("div");
        tileElement.className = tileClass(tile, sequenceLengthMap);
        tileElement.dataset.tileId = String(tile.id);
        tileElement.style.setProperty("--tile-font-size", `${computeTileFontSize(tile, cellSize)}px`);

        const shouldHideText = hiddenTileIds.has(tile.id);
        tileElement.textContent = shouldHideText ? "" : tile.symbol;
        if (shouldHideText) {
          tileElement.setAttribute("aria-label", tile.symbol);
        }

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
  const showingHighest = state.bestScoreDisplayMode === "highest";

  ui.scoreElement.textContent = String(state.score);
  ui.bestScoreLabelElement.textContent = showingHighest ? "Best" : "Worst";
  ui.bestScoreButton.textContent = String(getDisplayedBestScore(state));
  ui.movesElement.textContent = String(state.moves);
  ui.statusElement.textContent = state.status;
  ui.eventsElement.textContent = state.eventLines.join("\n");

  const sequenceLengthMap = buildSequenceLengthMap(configs);
  renderCompletedCounts(ui.completedCountsElement, state.completedCounts, configs);
  renderBoard(state.board, ui.boardElement, sequenceLengthMap, state.hiddenTileIds);
  updateGameOverUI(ui, state.gameOver);
}
