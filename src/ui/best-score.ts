import { BEST_SCORE_STORAGE_KEY } from "./constants";

function sanitizeScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) {
      return 0;
    }

    return sanitizeScore(Number(raw));
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(sanitizeScore(score)));
  } catch {
    // Ignore storage failures (private mode, blocked storage, etc.)
  }
}