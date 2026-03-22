import type { MoveDirection } from "../core";

type TouchPoint = {
  x: number;
  y: number;
};

const SWIPE_MIN_DISTANCE_PX = 28;

function toSwipeDirection(start: TouchPoint, end: TouchPoint): MoveDirection | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_DISTANCE_PX) {
    return null;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "Right" : "Left";
  }

  return dy >= 0 ? "Down" : "Up";
}

export function attachTouchHandlers(
  boardElement: HTMLElement,
  executeMove: (direction: MoveDirection) => void
): void {
  let touchStartPoint: TouchPoint | null = null;

  boardElement.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) {
        touchStartPoint = null;
        return;
      }

      const touch = event.touches[0];
      touchStartPoint = { x: touch.clientX, y: touch.clientY };
    },
    { passive: true }
  );

  boardElement.addEventListener(
    "touchend",
    (event) => {
      if (!touchStartPoint) {
        return;
      }

      if (event.changedTouches.length < 1) {
        touchStartPoint = null;
        return;
      }

      const touch = event.changedTouches[0];
      const direction = toSwipeDirection(touchStartPoint, { x: touch.clientX, y: touch.clientY });
      touchStartPoint = null;

      if (!direction) {
        return;
      }

      event.preventDefault();
      executeMove(direction);
    },
    { passive: false }
  );

  boardElement.addEventListener("touchcancel", () => {
    touchStartPoint = null;
  });
}