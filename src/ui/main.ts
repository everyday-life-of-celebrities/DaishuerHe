import { ElPsyCongroo, StrategicRatio } from "./constants";
import { mountUi } from "./dom";
import { createGameController } from "./game-controller";
import { attachBoardClickToggle, attachDirectionButtons } from "./input-buttons";
import { attachKeyboardHandlers } from "./input-keyboard";
import { attachTouchHandlers } from "./input-touch";
import { configs } from "./seq-data";
import {
  formatStrategicRatioInput,
  loadStrategicRatio,
  parseStrategicRatioInput,
  saveStrategicRatio
} from "./strategic-ratio";

const ui = mountUi();
const strategicRatio = loadStrategicRatio();
const controller = createGameController(ui, configs, strategicRatio);

attachKeyboardHandlers({
  executeMove: controller.executeMove,
  restartGame: controller.restartGame
});

attachDirectionButtons(controller.executeMove);
attachBoardClickToggle(ui.boardElement, controller.toggleTileTextVisibility);
attachTouchHandlers(ui.boardElement, controller.executeMove);

ui.bestScoreButton.addEventListener("click", controller.toggleBestScoreDisplay);
ui.restartButton.addEventListener("click", controller.restartGame);
ui.adjustButtonElement.addEventListener("click", openStrategicAdjust);
ui.helpButtonElement.addEventListener("click", openHelp);
ui.retryButtonElement.addEventListener("click", () => {
  window.open(
    ElPsyCongroo([104, 116, 116, 112, 115, 58, 47, 47, 116, 105, 97, 110, 46, 98, 105, 99, 109, 114, 46, 112, 107, 117, 46, 101, 100, 117, 46, 99, 110]),
    "_blank",
    "noopener,noreferrer"
  );
});

controller.initialize();

function openStrategicAdjust(): void {
  const promptText = "输入 p, q 當滿足 n q ≥ N p 時觸發策略";
  const rawInput = window.prompt(promptText, formatStrategicRatioInput(strategicRatio));
  if (rawInput === null) {
    return;
  }

  const parsed = parseStrategicRatioInput(rawInput);
  if (!parsed) {
    window.alert("格式無效");
    return;
  }

  strategicRatio.p = parsed.p;
  strategicRatio.q = parsed.q;
  saveStrategicRatio(strategicRatio);
}

function openHelp(): void {
  alert([
    "目前有以下三種吃法:",
    "", 
    "1. 一直玩下去, 與西西弗斯同調",
    "2. 想辦法輸掉遊戲, 不再是他的學生",
    "3. 拼出一些生草的語句",
    "", 
    "祝玩得開心",
  ].join("\n"))
}
