import type { MoveDirection } from "../core";

type KeyboardHandlers = {
  executeMove: (dir: MoveDirection) => void;
  restartGame: () => void;
};

const KEY_TO_DIRECTION: Record<string, MoveDirection> = {
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  a: "Left",
  A: "Left",
  d: "Right",
  D: "Right",
  w: "Up",
  W: "Up",
  s: "Down",
  S: "Down",
  KeyA: "Left",
  KeyD: "Right",
  KeyW: "Up",
  KeyS: "Down"
};

function isRestartKey(event: KeyboardEvent): boolean {
  return event.key === "n" || event.key === "N" || event.code === "KeyN";
}

export function attachKeyboardHandlers(handlers: KeyboardHandlers): void {
  document.addEventListener("keydown", (event) => {
    if (isRestartKey(event)) {
      event.preventDefault();
      handlers.restartGame();
      return;
    }

    const dir = KEY_TO_DIRECTION[event.key] ?? KEY_TO_DIRECTION[event.code];
    if (!dir) {
      return;
    }

    event.preventDefault();
    handlers.executeMove(dir);
  });
}