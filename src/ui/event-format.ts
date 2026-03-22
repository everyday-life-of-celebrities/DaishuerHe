import type { MoveEvent } from "../core";

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