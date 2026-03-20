import { GAME_OVER_TEXT, RETRY_TEXT } from "./constants";

export type UiElements = {
  boardElement: HTMLDivElement;
  scoreElement: HTMLElement;
  movesElement: HTMLElement;
  statusElement: HTMLElement;
  eventsElement: HTMLElement;
  completedCountsElement: HTMLUListElement;
  restartButton: HTMLButtonElement;
  gameMessageElement: HTMLDivElement;
  retryButtonElement: HTMLButtonElement;
};

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`UI mount failed: missing required element: ${selector}`);
  }

  return element;
}

export function mountUi(): UiElements {
  const boardElement = requireElement<HTMLDivElement>("#board");
  const scoreElement = requireElement<HTMLElement>("#score");
  const movesElement = requireElement<HTMLElement>("#moves");
  const statusElement = requireElement<HTMLElement>("#status");
  const eventsElement = requireElement<HTMLElement>("#events");
  const completedCountsElement = requireElement<HTMLUListElement>("#completed-counts");
  const restartButton = requireElement<HTMLButtonElement>("#restart");
  const gamePanelElement = requireElement<HTMLElement>(".game-panel");

  const gameMessageElement = document.createElement("div");
  gameMessageElement.className = "game-message";
  gameMessageElement.setAttribute("aria-live", "assertive");

  const gameMessageTextElement = document.createElement("p");
  gameMessageTextElement.className = "game-message-text";
  gameMessageTextElement.textContent = GAME_OVER_TEXT;

  const retryButtonElement = document.createElement("button");
  retryButtonElement.type = "button";
  retryButtonElement.className = "retry-button";
  retryButtonElement.textContent = RETRY_TEXT;

  gameMessageElement.append(gameMessageTextElement, retryButtonElement);
  gamePanelElement.appendChild(gameMessageElement);

  return {
    boardElement,
    scoreElement,
    movesElement,
    statusElement,
    eventsElement,
    completedCountsElement,
    restartButton,
    gameMessageElement,
    retryButtonElement
  };
}

export function updateGameOverUI(ui: UiElements, gameOver: boolean): void {
  ui.gameMessageElement.classList.toggle("visible", gameOver);
  ui.retryButtonElement.disabled = !gameOver;
}