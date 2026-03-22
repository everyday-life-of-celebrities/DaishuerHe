import type { Board, Tile } from "../core";
import { applyTileVisualStyle, computeTileFontSize } from "./tile-style";

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

function isCompletedTile(tile: Tile, sequenceLengthMap: ReadonlyMap<string, number>): boolean {
  const sequenceLength = sequenceLengthMap.get(tile.sequenceId);
  if (sequenceLength === undefined) {
    return false;
  }

  return tile.start === 0 && tile.end === sequenceLength - 1;
}

export function renderBoard(
  board: Board,
  boardElement: HTMLDivElement,
  hiddenTileIds: ReadonlySet<number>,
  sequenceLengthMap: ReadonlyMap<string, number>
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
        tileElement.className = "tile";
        tileElement.dataset.tileId = String(tile.id);
        tileElement.style.setProperty("--tile-font-size", `${computeTileFontSize(tile, cellSize)}px`);
        applyTileVisualStyle(tileElement, tile, isCompletedTile(tile, sequenceLengthMap));

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
