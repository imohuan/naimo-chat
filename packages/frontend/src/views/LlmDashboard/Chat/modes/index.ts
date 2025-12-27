import type { ConversationModeHandler } from "./types";
import { chatModeHandler } from "./chatMode";
import { agentModeHandler } from "./agentMode";
import { canvasModeHandler } from "./canvasMode";
import { imageModeHandler } from "./imageMode";
import { videoModeHandler } from "./videoMode";

/**
 * 模式处理器注册表
 */
const modeHandlers = new Map<string, ConversationModeHandler>([
  ["chat", chatModeHandler],
  ["agent", agentModeHandler],
  ["canvas", canvasModeHandler],
  ["图片", imageModeHandler],
  ["视频", videoModeHandler],
]);

/**
 * 获取指定模式的处理器
 * @param mode 模式标识符
 * @returns 模式处理器，如果未找到则返回默认的 chat 模式处理器
 */
export function getModeHandler(mode: string): ConversationModeHandler {
  return modeHandlers.get(mode) || chatModeHandler;
}

/**
 * 获取所有可用的模式标识符
 * @returns 模式标识符数组
 */
export function getAvailableModes(): string[] {
  return Array.from(modeHandlers.keys());
}

/**
 * 导出所有模式处理器（用于测试或特殊用途）
 */
export {
  chatModeHandler,
  agentModeHandler,
  canvasModeHandler,
  imageModeHandler,
  videoModeHandler,
};

