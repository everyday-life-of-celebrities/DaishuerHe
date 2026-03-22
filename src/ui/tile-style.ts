import type { Tile } from "../core";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type TileColorStop = {
  background: string;
  color: string;
};

const TILE_COLOR_STOPS: TileColorStop[] = [
  { background: "#eee4da", color: "#776e65" },
  { background: "#ede0c8", color: "#776e65" },
  { background: "#f2b179", color: "#f9f6f2" },
  { background: "#f59563", color: "#f9f6f2" },
  { background: "#f67c5f", color: "#f9f6f2" },
  { background: "#f65e3b", color: "#f9f6f2" },
  { background: "#edcf72", color: "#f9f6f2" },
  { background: "#edcc61", color: "#f9f6f2" },
  { background: "#edc850", color: "#f9f6f2" },
  { background: "#edc53f", color: "#f9f6f2" },
  { background: "#edc22e", color: "#f9f6f2" },
  { background: "#3c3a32", color: "#f9f6f2" }
];

const COMPLETED_TILE_INDEX = TILE_COLOR_STOPS.length - 1;
const INCOMPLETE_TILE_STOPS = TILE_COLOR_STOPS.slice(0, COMPLETED_TILE_INDEX);

type TilePalette = {
  background: string;
  color: string;
  shadow: string;
};

function computeTileLevel(tile: Tile): number {
  return Math.max(1, tile.end - tile.start + 1);
}

function computeTilePalette(level: number, isCompleted: boolean): TilePalette {
  const safeLevel = Math.max(1, level);

  if (isCompleted) {
    const completedStop = TILE_COLOR_STOPS[COMPLETED_TILE_INDEX];
    return {
      background: completedStop.background,
      color: completedStop.color,
      shadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.22), 0 0 24px 8px rgba(60, 58, 50, 0.26)"
    };
  }

  const tierIndex = Math.min(safeLevel - 1, INCOMPLETE_TILE_STOPS.length - 1);
  const stop = INCOMPLETE_TILE_STOPS[tierIndex];
  const warmTierStart = 6;
  const glowProgress = tierIndex >= warmTierStart ? (tierIndex - warmTierStart + 1) / Math.max(1, INCOMPLETE_TILE_STOPS.length - warmTierStart) : 0;

  const glowAlpha = clamp(glowProgress * 0.56, 0, 0.56);
  const insetAlpha = clamp(glowProgress * 0.33, 0, 0.33);

  return {
    background: stop.background,
    color: stop.color,
    shadow: `0 0 30px 10px rgba(243, 215, 116, ${glowAlpha.toFixed(5)}), inset 0 0 0 1px rgba(255, 255, 255, ${insetAlpha.toFixed(5)})`
  };
}

export function applyTileVisualStyle(tileElement: HTMLDivElement, tile: Tile, isCompleted: boolean): void {
  const level = computeTileLevel(tile);
  const palette = computeTilePalette(level, isCompleted);
  tileElement.dataset.tileLevel = String(level);
  tileElement.style.setProperty("--tile-bg", palette.background);
  tileElement.style.setProperty("--tile-color", palette.color);
  tileElement.style.setProperty("--tile-shadow", palette.shadow);
}

const FONT_SIZE_SCALE = 0.9;
const FONT_SIZE_CELL_REFERENCE = 96;
const FONT_SIZE_CELL_EXPONENT = 0.9;
const SMALL_SCREEN_CELL_MAX = 78;
const LONG_TEXT_GLYPH_THRESHOLD = 30;
const LONG_TEXT_SMALL_SCREEN_MAX_SIZE = 10;

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

export function computeTileFontSize(tile: Tile, cellSize: number): number {
  const glyphCount = Math.max(1, Array.from(tile.symbol).length);

  const baseline = computeFontSizeBaseline(glyphCount);
  const fitCap = computeFontSizeFitCap(cellSize, glyphCount);

  const rawCellScale = Math.pow(cellSize / FONT_SIZE_CELL_REFERENCE, FONT_SIZE_CELL_EXPONENT);
  const cellScale = Math.min(1, Math.max(0.62, rawCellScale));
  const computed = Math.min(baseline, fitCap) * FONT_SIZE_SCALE * cellScale;

  const isSmallScreenCell = cellSize <= SMALL_SCREEN_CELL_MAX;
  const isLongText = glyphCount >= LONG_TEXT_GLYPH_THRESHOLD;

  const minSize = isSmallScreenCell && isLongText ? 9 : Math.max(9, Math.min(12, cellSize * 0.16));
  const maxSize = isSmallScreenCell && isLongText ? LONG_TEXT_SMALL_SCREEN_MAX_SIZE : 26;
  return Math.max(minSize, Math.min(maxSize, computed));
}
