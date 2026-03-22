import type { MoveDirection } from "../core";
import { DIRECTIONS } from "./constants";

function parseDirection(value: string | null): MoveDirection | null {
  if (!value) {
    return null;
  }

  return DIRECTIONS.includes(value as MoveDirection) ? (value as MoveDirection) : null;
}

export function attachDirectionButtons(executeMove: (direction: MoveDirection) => void): void {
  document.querySelectorAll<HTMLButtonElement>("button[data-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      const dir = parseDirection(button.dataset.dir ?? null);
      if (dir) {
        executeMove(dir);
      }
    });
  });
}

export function attachBoardClickToggle(
  boardElement: HTMLElement,
  toggleTileTextVisibility: (tileId: number) => void
): void {
  boardElement.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const tileElement = target.closest<HTMLElement>(".tile[data-tile-id]");
    if (!tileElement || !boardElement.contains(tileElement)) {
      return;
    }

    const tileIdValue = tileElement.dataset.tileId;
    if (!tileIdValue) {
      return;
    }

    const tileId = Number(tileIdValue);
    if (!Number.isInteger(tileId)) {
      return;
    }

    toggleTileTextVisibility(tileId);
  });
}