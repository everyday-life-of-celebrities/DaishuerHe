import { ElPsyCongroo } from "./constants";
import { mountUi } from "./dom";
import { createGameController } from "./game-controller";
import { attachBoardClickToggle, attachDirectionButtons } from "./input-buttons";
import { attachKeyboardHandlers } from "./input-keyboard";
import { attachTouchHandlers } from "./input-touch";
import { configs } from "./seq-data";

const ui = mountUi();
const controller = createGameController(ui, configs);

attachKeyboardHandlers({
  executeMove: controller.executeMove,
  restartGame: controller.restartGame
});

attachDirectionButtons(controller.executeMove);
attachBoardClickToggle(ui.boardElement, controller.toggleTileTextVisibility);
attachTouchHandlers(ui.boardElement, controller.executeMove);

ui.bestScoreButton.addEventListener("click", controller.toggleBestScoreDisplay);
ui.restartButton.addEventListener("click", controller.restartGame);
ui.retryButtonElement.addEventListener("click", () => {
  window.open(
    ElPsyCongroo([104, 116, 116, 112, 115, 58, 47, 47, 116, 105, 97, 110, 46, 98, 105, 99, 109, 114, 46, 112, 107, 117, 46, 101, 100, 117, 46, 99, 110]),
    "_blank",
    "noopener,noreferrer"
  );
});

controller.initialize();