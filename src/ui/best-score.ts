import { BEST_SCORE_STORAGE_KEY } from "./constants";

export type BestScoreStats = {
  highest: number;
  lowest: number;
  hasSample: boolean;
};

type PersistedBestScoreStats = {
  highest: number;
  lowest: number;
  samples: number;
};

const EMPTY_BEST_SCORE_STATS: BestScoreStats = {
  highest: 0,
  lowest: 0,
  hasSample: false
};

function sanitizeScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeExtremes(highest: unknown, lowest: unknown): Pick<BestScoreStats, "highest" | "lowest"> {
  const normalizedHighest = sanitizeScore(highest);
  const normalizedLowest = sanitizeScore(lowest);

  return {
    highest: Math.max(normalizedHighest, normalizedLowest),
    lowest: Math.min(normalizedHighest, normalizedLowest)
  };
}

function parseBestScoreStats(raw: string): BestScoreStats | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;

      if ("highest" in record && "lowest" in record) {
        const { highest, lowest } = normalizeExtremes(record.highest, record.lowest);
        const hasSample =
          typeof record.samples === "number" && Number.isFinite(record.samples)
            ? Math.floor(record.samples) > 0
            : true;

        return { highest, lowest, hasSample };
      }
    }
  } catch {
    // Fall through to legacy format.
  }

  const legacyValue = Number(raw);
  if (!Number.isFinite(legacyValue)) {
    return null;
  }

  const normalized = sanitizeScore(legacyValue);
  return {
    highest: normalized,
    lowest: normalized,
    hasSample: true
  };
}

function toPersisted(stats: BestScoreStats): PersistedBestScoreStats {
  return {
    highest: sanitizeScore(stats.highest),
    lowest: sanitizeScore(stats.lowest),
    samples: stats.hasSample ? 1 : 0
  };
}

export function loadBestScore(): BestScoreStats {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) {
      return EMPTY_BEST_SCORE_STATS;
    }

    return parseBestScoreStats(raw) ?? EMPTY_BEST_SCORE_STATS;
  } catch {
    return EMPTY_BEST_SCORE_STATS;
  }
}

export function saveBestScore(score: number): BestScoreStats {
  const normalizedScore = sanitizeScore(score);
  const current = loadBestScore();

  const next: BestScoreStats = current.hasSample
    ? {
        highest: Math.max(current.highest, normalizedScore),
        lowest: Math.min(current.lowest, normalizedScore),
        hasSample: true
      }
    : {
        highest: normalizedScore,
        lowest: normalizedScore,
        hasSample: true
      };

  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, JSON.stringify(toPersisted(next)));
  } catch {
    // Ignore storage failures (private mode, blocked storage, etc.)
  }

  return next;
}