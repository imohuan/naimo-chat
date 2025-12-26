const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const clipboardyImport = require("clipboardy");
const clipboardy = clipboardyImport.default || clipboardyImport;
const ClipboardModule = require("@crosscopy/clipboard");
const Clipboard = ClipboardModule.default || ClipboardModule;
const { ensureDir } = require("./paths");
const { CLIPBOARD_IMAGES_DIR } = require("../config/constants");

// --- 配置部分 ---
const CHECK_INTERVAL = 1000; // 监听的间隔时间（毫秒）

/** 生成时间戳文件名 */
function getTimestamp() {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const DD = String(now.getDate()).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const SS = String(now.getSeconds()).padStart(2, "0");
  return `${YYYY}${MM}${DD}_${HH}${mm}${SS}`;
}

/** 核心逻辑：检测、保存并复制路径 */
async function checkAndSave() {
  ensureDir(CLIPBOARD_IMAGES_DIR);

  let finalPath = null;
  try {
    const hasImage = await Clipboard.hasImage();
    if (!hasImage) {
      throw new Error("clipboard-empty");
    }

    const base64 = await Clipboard.getImageBase64();
    if (!base64) {
      throw new Error("clipboard-empty");
    }

    // 简单去重：对当前剪贴板图片做哈希，若与上一张相同则跳过保存
    const currentHash = crypto.createHash("md5").update(base64).digest("hex");
    if (checkAndSave.lastHash && checkAndSave.lastHash === currentHash) {
      return;
    }
    checkAndSave.lastHash = currentHash;

    const buffer = Buffer.from(base64, "base64");
    const finalFileName = `IMG_${getTimestamp()}.png`;
    finalPath = path.join(CLIPBOARD_IMAGES_DIR, finalFileName);

    fs.writeFileSync(finalPath, buffer);
    const absolutePath = path.resolve(finalPath);

    console.log("\n" + "=".repeat(30));
    console.log("检测到剪切板中有图片！");
    console.log(`已保存: ${finalFileName}`);

    // 如不需要自动回写路径到剪贴板，直接注释掉写入动作
    await clipboardy.write(absolutePath);
    console.log(`路径已复制到剪切板: ${absolutePath}`);
    console.log("=".repeat(30));
  } catch (error) {
    if (error?.message !== "clipboard-empty") {
      console.log(error);
    }
    if (finalPath && fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
  }
}

/**
 * 启动剪贴板监听
 */
function startClipboardWatch() {
  console.log(`正在监听剪切板... (间隔 ${CHECK_INTERVAL / 1000} 秒)`);
  console.log("按 Ctrl+C 停止。");
  console.log(`图片将保存至: ${path.resolve(CLIPBOARD_IMAGES_DIR)}`);

  // 使用 setInterval 启动循环监听
  const intervalId = setInterval(checkAndSave, CHECK_INTERVAL);

  // 处理进程退出
  process.on("SIGINT", () => {
    console.log("\n正在停止剪贴板监听...");
    clearInterval(intervalId);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    clearInterval(intervalId);
    process.exit(0);
  });

  return intervalId;
}

// 如果直接运行此文件（非打包模式），则启动监听
// 打包后，将通过 index_llm.js 的 --clipboard-watch 参数来启动
if (require.main === module) {
  startClipboardWatch();
}

module.exports = { startClipboardWatch, checkAndSave };
