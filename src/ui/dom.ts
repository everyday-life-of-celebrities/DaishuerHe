import { GAME_OVER_TEXT, RETRY_TEXT } from "./constants";

export type UiElements = {
  boardElement: HTMLDivElement;
  scoreElement: HTMLElement;
  bestScoreLabelElement: HTMLElement;
  bestScoreButton: HTMLButtonElement;
  movesElement: HTMLElement;
  statusElement: HTMLElement;
  eventsElement: HTMLElement;
  completedCountsElement: HTMLUListElement;
  restartButton: HTMLButtonElement;
  gameMessageElement: HTMLDivElement;
  retryButtonElement: HTMLButtonElement;
  adjustButtonElement: HTMLElement;
  helpButtonElement: HTMLElement;
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
  const bestScoreLabelElement = requireElement<HTMLElement>("#best-score-label");
  const bestScoreButton = requireElement<HTMLButtonElement>("#best-score");
  const movesElement = requireElement<HTMLElement>("#moves");
  const statusElement = requireElement<HTMLElement>("#status");
  const eventsElement = requireElement<HTMLElement>("#events");
  const completedCountsElement = requireElement<HTMLUListElement>("#completed-counts");
  const restartButton = requireElement<HTMLButtonElement>("#restart");
  const adjustButtonElement = requireElement<HTMLElement>("#adjust-button");
  const helpButtonElement = requireElement<HTMLElement>("#help-button");
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
    bestScoreLabelElement,
    bestScoreButton,
    movesElement,
    statusElement,
    eventsElement,
    completedCountsElement,
    restartButton,
    gameMessageElement,
    retryButtonElement,
    adjustButtonElement, 
    helpButtonElement, 
  };
}

export function updateGameOverUI(ui: UiElements, gameOver: boolean): void {
  ui.gameMessageElement.classList.toggle("visible", gameOver);
  ui.retryButtonElement.disabled = !gameOver;
}