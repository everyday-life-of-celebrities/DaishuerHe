import { DEFAULT_STRATEGIC_RATIO, STRATEGIC_RATIO_STORAGE_KEY, type StrategicRatio } from "./constants";

function parsePositiveIntegerToken(token: string): number | null {
  if (!/^\d+$/.test(token)) {
    return null;
  }

  const parsed = Number.parseInt(token, 10);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

function parsePersistedStrategicRatio(raw: string): StrategicRatio | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.p !== "number" || typeof record.q !== "number") {
      return null;
    }

    if (!Number.isFinite(record.p) || !Number.isFinite(record.q)) {
      return null;
    }

    const p = Math.floor(record.p);
    const q = Math.floor(record.q);
    if (p <= 0 || q <= 0) {
      return null;
    }

    return { p, q };
  } catch {
    return null;
  }
}

export function formatStrategicRatioInput(ratio: StrategicRatio): string {
  return `${ratio.p},${ratio.q}`;
}

export function parseStrategicRatioInput(raw: string): StrategicRatio | null {
  const parts = raw.split(",");
  if (parts.length !== 2) {
    return null;
  }

  const p = parsePositiveIntegerToken(parts[0].trim());
  const q = parsePositiveIntegerToken(parts[1].trim());
  if (p === null || q === null) {
    return null;
  }

  return { p, q };
}

export function loadStrategicRatio(): StrategicRatio {
  const fallback: StrategicRatio = { ...DEFAULT_STRATEGIC_RATIO };

  try {
    const raw = window.localStorage.getItem(STRATEGIC_RATIO_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    return parsePersistedStrategicRatio(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveStrategicRatio(ratio: StrategicRatio): void {
  try {
    window.localStorage.setItem(
      STRATEGIC_RATIO_STORAGE_KEY,
      JSON.stringify({ p: ratio.p, q: ratio.q })
    );
  } catch {
    // Ignore storage failures (private mode, blocked storage, etc.)
  }
}
