/**
 * LLM StatusLine 工具模块
 * 根据配置文件中的 StatusLine 配置渲染状态栏
 *
 * 使用方式：
 * echo '{}' | node index_llm.js --statusline
 */

const { existsSync, readFileSync } = require("fs");
const { readFile } = require("fs/promises");
const { execSync } = require("child_process");
const { CONFIG_FILE } = require("../config/constants");

/**
 * 读取配置文件
 */
async function readConfigFile() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const content = readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Failed to read config file:", error.message);
  }
  return null;
}

/**
 * 将 RGBA/RGB 值转换为 ANSI 24 位颜色代码。
 * 忽略 Alpha (A) 值，因为 ANSI 24 位颜色不支持透明度。
 *
 * @param {number} r 红色分量 (0-255)
 * @param {number} g 绿色分量 (0-255)
 * @param {number} b 蓝色分量 (0-255)
 * @param {'fg'|'bg'} type 颜色类型：'fg' (前景色) 或 'bg' (背景色)
 * @returns {string} 对应的 ANSI 颜色转义序列
 */
function rgbaToAnsi(r, g, b, type = "fg") {
  // 确保 R, G, B 在 0-255 范围内
  r = Math.min(255, Math.max(0, Math.round(r)));
  g = Math.min(255, Math.max(0, Math.round(g)));
  b = Math.min(255, Math.max(0, Math.round(b)));

  // 选择前景色 (38) 或背景色 (48)
  const colorCode = type === "bg" ? 48 : 38;

  // 构造 ANSI 24 位颜色序列
  return `\u001b[${colorCode};2;${r};${g};${b}m`;
}

/**
 * ANSI 样式代码映射
 * 只包含广泛支持的样式（大多数终端都支持）
 */
const ANSI_STYLES = {
  bold: 1,
  dim: 2,
  normal: 22,
  underline: 4,
  noUnderline: 24,
  reverse: 7,
  noReverse: 27,
};

/**
 * 解析 RGB 颜色字符串
 * 支持格式：rgb(255, 255, 255) 或 rgb(6, 182, 212)
 */
function parseRgbColor(colorStr) {
  if (!colorStr || typeof colorStr !== "string") return null;

  const match = colorStr.match(
    /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i
  );
  if (match) {
    return [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
    ];
  }
  return null;
}

/**
 * 获取颜色代码（仅支持 RGB 格式）
 */
function getColorCode(colorStr) {
  if (!colorStr) return "";

  // 解析 RGB 格式
  const rgb = parseRgbColor(colorStr);
  if (rgb) {
    return rgbaToAnsi(rgb[0], rgb[1], rgb[2], "fg");
  }

  return "";
}

/**
 * 获取背景颜色代码（仅支持 RGB 格式）
 */
function getBackgroundColorCode(colorStr) {
  if (!colorStr) return "";

  // 解析 RGB 格式
  const rgb = parseRgbColor(colorStr);
  if (rgb) {
    return rgbaToAnsi(rgb[0], rgb[1], rgb[2], "bg");
  }

  return "";
}

/**
 * 解析样式字符串（可能是 JSON 字符串格式）
 */
function parseStyle(styleStr) {
  if (!styleStr) return [];

  // 如果已经是数组，直接返回
  if (Array.isArray(styleStr)) {
    return styleStr;
  }

  // 如果是字符串，尝试解析 JSON
  if (typeof styleStr === "string") {
    try {
      const parsed = JSON.parse(styleStr);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // 如果不是 JSON，当作单个样式名
      return [styleStr];
    }
  }

  return [];
}

/**
 * 应用 ANSI 样式
 */
function applyStyle(styles) {
  if (!styles) return "";

  const styleArray = parseStyle(styles);
  const codes = styleArray
    .map((style) => ANSI_STYLES[style])
    .filter((code) => code !== undefined);

  if (codes.length === 0) return "";

  return `\u001b[${codes.join(";")}m`;
}

/**
 * 变量替换函数，支持 {{var}} 格式的变量替换
 */
function replaceVariables(text, variables) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    return variables[varName] || "";
  });
}

/**
 * 解析 token 字符串（如 "2.11k", "1.5M", "500"）为数字
 * @param {string} tokenStr - token 字符串
 * @returns {number} 解析后的数字
 */
function parseTokenString(tokenStr) {
  if (!tokenStr || typeof tokenStr !== "string") return 0;

  // 移除空格并转换为小写
  const cleaned = tokenStr.trim().toLowerCase();

  // 匹配数字和单位
  const match = cleaned.match(/^([\d.]+)\s*([kmg]?)$/);
  if (!match) {
    // 如果没有匹配到，尝试直接解析为数字
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  const value = parseFloat(match[1]);
  const unit = match[2] || "";

  // 根据单位转换
  switch (unit) {
    case "k":
      return value * 1000;
    case "m":
      return value * 1000000;
    case "g":
      return value * 1000000000;
    default:
      return value;
  }
}

/**
 * 生成进度条字符
 * @param {number} percentage - 百分比 (0-100)
 * @param {number} length - 进度条长度
 * @param {string} style - 样式风格：block, thin, smooth, bar, dot
 * @returns {string} 进度条字符串
 */
function generateProgressBar(percentage, length, style = "block") {
  if (length <= 0) return "";
  if (percentage < 0) percentage = 0;
  if (percentage > 100) percentage = 100;

  const filled = Math.floor((percentage / 100) * length);
  const empty = length - filled;

  // 计算部分填充（用于平滑过渡）
  const partial = (percentage / 100) * length - filled;

  switch (style) {
    case "block":
      // 实心块：█
      return "█".repeat(filled) + "░".repeat(empty);

    case "thin":
      // 细块：▏▎▍▌▋▊▉
      const thinChars = ["▏", "▎", "▍", "▌", "▋", "▊", "▉"];
      const thinIndex = Math.floor(partial * 7);
      const thinChar = thinIndex < 7 ? thinChars[thinIndex] : "█";
      return "█".repeat(filled) + (filled < length ? thinChar : "") + "░".repeat(Math.max(0, empty - 1));

    case "smooth":
      // 平滑：▁▂▃▄▅▆▇█
      const smoothChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
      const smoothIndex = Math.floor(partial * 8);
      const smoothChar = smoothIndex < 8 ? smoothChars[smoothIndex] : "█";
      return "█".repeat(filled) + (filled < length ? smoothChar : "") + "░".repeat(Math.max(0, empty - 1));

    case "bar":
      // 条形：=
      return "=".repeat(filled) + "-".repeat(empty);

    case "dot":
      // 点状：●
      return "●".repeat(filled) + "○".repeat(empty);

    default:
      // 默认使用 block
      return "█".repeat(filled) + "░".repeat(empty);
  }
}

/**
 * 渲染进度条模块
 * @param {Object} module - 模块配置
 * @param {Object} variables - 变量对象
 * @returns {string} 渲染后的进度条字符串
 */
function renderProgressModule(module, variables) {
  const {
    progressInput = "",
    progressOutput = "",
    progressLength = 20,
    progressBgColor = "",
    progressColor = "",
    progressStyle = "block",
  } = module;

  // 替换变量
  const inputStr = replaceVariables(progressInput, variables);
  const outputStr = replaceVariables(progressOutput, variables);

  // 解析输入和输出值
  const inputValue = parseTokenString(inputStr);
  const outputValue = parseTokenString(outputStr);

  // 计算百分比
  let percentage = 0;
  if (outputValue > 0) {
    percentage = (inputValue / outputValue) * 100;
  }

  // 生成进度条
  const progressBar = generateProgressBar(percentage, progressLength, progressStyle);

  if (!progressBar) {
    return "";
  }

  // 应用样式
  const bgCode = progressBgColor
    ? getBackgroundColorCode(progressBgColor)
    : "";
  const fgCode = progressColor ? getColorCode(progressColor) : "";

  // 组合样式代码
  const styleCodes = [bgCode, fgCode].filter(Boolean).join("");

  return `${styleCodes}${progressBar}${RESET}`;
}

/**
 * 创建文本样式（组合颜色、背景色和样式）
 */
function createTextStyle(options = {}) {
  const { color, background, style } = options;
  const codes = [];

  // 前景色
  if (color) {
    const colorCode = getColorCode(color);
    if (colorCode) codes.push(colorCode);
  }

  // 背景色
  if (background) {
    const bgCode = getBackgroundColorCode(background);
    if (bgCode) codes.push(bgCode);
  }

  // 样式
  if (style) {
    const styleCode = applyStyle(style);
    if (styleCode) codes.push(styleCode);
  }

  return codes.join("");
}

// ANSI 重置代码
const RESET = "\u001b[0m";

/**
 * 渲染状态行模块
 * @param {Object} module - 模块配置
 * @param {Object} variables - 变量对象
 * @param {boolean} showIcon - 是否显示图标，默认为 true
 */
function renderModule(module, variables, showIcon = true) {
  // 如果是进度条类型，使用专门的渲染函数
  if (module.type === "progress") {
    return renderProgressModule(module, variables);
  }

  const { icon = "", text = "", color, background, style } = module;

  // 替换变量
  const displayText = replaceVariables(text, variables);

  // 构建完整文本（图标 + 文本）
  let fullText = "";
  if (showIcon && icon) {
    fullText += `${icon} `;
  }
  fullText += displayText;

  // 如果文本为空，返回空字符串
  if (!fullText.trim()) {
    return "";
  }

  // 创建样式
  const styleCode = createTextStyle({ color, background, style });

  return `${styleCode}${fullText}${RESET}`;
}

/**
 * 渲染状态行
 */
function renderStatusLine(config, variables) {
  const statusLineConfig = config.StatusLine;
  if (!statusLineConfig || !statusLineConfig.enabled) {
    return "";
  }

  const currentStyle = statusLineConfig.currentStyle || "default";
  const themeConfig = statusLineConfig[currentStyle];

  if (
    !themeConfig ||
    !themeConfig.modules ||
    themeConfig.modules.length === 0
  ) {
    return "";
  }

  // 获取 showIcon 配置，默认为 true（向后兼容）
  const showIcon =
    statusLineConfig.showIcon !== undefined ? statusLineConfig.showIcon : true;

  const modules = themeConfig.modules;
  const parts = [];

  for (const module of modules) {
    const rendered = renderModule(module, variables, showIcon);
    if (rendered) {
      parts.push(rendered);
    }
  }

  return parts.join(" ");
}

/**
 * 主函数：运行 StatusLine
 */
async function runStatusLine() {
  // 从 stdin 读取 JSON 输入
  let inputData = "";
  process.stdin.setEncoding("utf-8");

  process.stdin.on("readable", () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
      inputData += chunk;
    }
  });

  process.stdin.on("end", async () => {
    try {
      // 读取配置文件
      const config = await readConfigFile();
      if (!config || !config.StatusLine) {
        return;
      }

      // 解析输入数据（可能包含实际变量，否则使用预览变量）
      let input = {};
      try {
        input = JSON.parse(inputData || "{}");
      } catch {
        // 忽略解析错误
      }

      // 获取工作目录
      const workDir =
        input.workspace?.current_dir || input.cwd || process.cwd();
      const workDirName = require("path").basename(workDir) || "";

      // 获取 Git 分支
      let gitBranch = "";
      try {
        gitBranch = execSync("git branch --show-current", {
          cwd: workDir,
          stdio: ["pipe", "pipe", "ignore"],
          encoding: "utf-8",
        })
          .toString()
          .trim();
      } catch {
        // 如果不是 Git 仓库或获取失败，则忽略错误
      }

      // 从 transcript_path 文件中读取最后一条 assistant 消息
      let model = "";
      let inputTokens = 0;
      let outputTokens = 0;

      if (input.transcript_path && existsSync(input.transcript_path)) {
        try {
          const transcriptContent = await readFile(
            input.transcript_path,
            "utf-8"
          );
          const lines = transcriptContent.trim().split("\n");

          // 反向遍历寻找最后一条 assistant 消息
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const message = JSON.parse(lines[i]);
              if (message.type === "assistant" && message.message?.model) {
                model = message.message.model;
                if (message.message.usage) {
                  inputTokens = message.message.usage.input_tokens || 0;
                  outputTokens = message.message.usage.output_tokens || 0;
                }
                break;
              }
            } catch {
              continue;
            }
          }
        } catch {
          // 忽略错误
        }
      }

      // 如果还没有获取到模型名称，则使用传入的 JSON 数据中的 model 字段
      if (!model && input.model) {
        model = input.model.display_name || input.model.id || "";
      }

      // 如果仍然没有获取到模型名称，则尝试从配置文件中获取
      if (!model && config.Router && config.Router.default) {
        const [, defaultModel] = config.Router.default.split(",");
        if (defaultModel) {
          model = defaultModel.trim();
        }
      }

      // 格式化 usage 信息
      const formatToken = (tokens) => {
        if (tokens > 1000) {
          return `${(tokens / 1000).toFixed(1)}k`;
        }
        return `${tokens}`;
      };

      // 格式化成本（美元）
      const formatCost = (cost) => {
        if (cost === 0) return "0";
        if (cost < 0.01) {
          return `$${cost.toFixed(4)}`;
        }
        return `$${cost.toFixed(2)}`;
      };

      // 格式化时间（毫秒转秒）
      const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        const seconds = ms / 1000;
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(0);
        return `${minutes}m${secs}s`;
      };

      // 获取变量（优先使用实际数据，否则使用预览变量）
      const previewVars = config.StatusLine.previewVariables || {};
      const variables = {
        workDirName: workDirName || previewVars.workDirName || "",
        gitBranch: gitBranch || previewVars.gitBranch || "",
        model: model || previewVars.model || "",
        inputTokens:
          inputTokens > 0
            ? formatToken(inputTokens)
            : input.context_window?.total_input_tokens
              ? formatToken(input.context_window.total_input_tokens)
              : input.usage?.input_tokens
                ? formatToken(input.usage.input_tokens)
                : previewVars.inputTokens || "",
        outputTokens:
          outputTokens > 0
            ? formatToken(outputTokens)
            : input.context_window?.total_output_tokens
              ? formatToken(input.context_window.total_output_tokens)
              : input.usage?.output_tokens
                ? formatToken(input.usage.output_tokens)
                : previewVars.outputTokens || "",
        // Cost 相关变量
        totalCost:
          input.cost?.total_cost_usd !== undefined
            ? formatCost(input.cost.total_cost_usd)
            : previewVars.totalCost || "",
        totalDuration:
          input.cost?.total_duration_ms !== undefined
            ? formatDuration(input.cost.total_duration_ms)
            : previewVars.totalDuration || "",
        totalApiDuration:
          input.cost?.total_api_duration_ms !== undefined
            ? formatDuration(input.cost.total_api_duration_ms)
            : previewVars.totalApiDuration || "",
        totalLinesAdded:
          input.cost?.total_lines_added !== undefined
            ? `${input.cost.total_lines_added}`
            : previewVars.totalLinesAdded || "",
        totalLinesRemoved:
          input.cost?.total_lines_removed !== undefined
            ? `${input.cost.total_lines_removed}`
            : previewVars.totalLinesRemoved || "",
        // Context Window 相关变量
        totalInputTokens:
          input.context_window?.total_input_tokens !== undefined
            ? formatToken(input.context_window.total_input_tokens)
            : previewVars.totalInputTokens || "",
        totalOutputTokens:
          input.context_window?.total_output_tokens !== undefined
            ? formatToken(input.context_window.total_output_tokens)
            : previewVars.totalOutputTokens || "",
        contextWindowSize:
          input.context_window?.context_window_size !== undefined
            ? formatToken(input.context_window.context_window_size)
            : previewVars.contextWindowSize || "",
      };

      // 渲染状态行
      const statusLine = renderStatusLine(config, variables);
      if (statusLine) {
        console.log(statusLine);
      }
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });
}

module.exports = {
  runStatusLine,
};

