#!/usr/bin/env node

/**
 * 完整打包脚本
 * 1. 打包前端 HTML（在 frontend 中 dist 会生成资源文件）
 * 2. 复制资源到 backend/public（删除之前的内容）
 * 3. 打包 exe（backend，执行 pnpm build）
 * 4. 将 exe 复制到根目录下的 dist 中
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// 颜色输出工具
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function colorLog(color, label, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `${colors[color]}[${timestamp}] [${label}]${colors.reset} ${message}`
  );
}

// 获取路径
const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "packages", "frontend");
const backendDir = path.join(rootDir, "packages", "backend");
const frontendDistDir = path.join(frontendDir, "dist");
const backendPublicDir = path.join(backendDir, "public");
const backendDistDir = path.join(backendDir, "dist");
const rootDistDir = path.join(rootDir, "dist");

// 复制目录的辅助函数
async function copyDirectory(src, dest) {
  // 确保目标目录存在
  await fs.promises.mkdir(dest, { recursive: true });

  // 读取源目录内容
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

// 删除目录的辅助函数
async function removeDirectory(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeDirectory(fullPath);
    } else {
      await fs.promises.unlink(fullPath);
    }
  }

  await fs.promises.rmdir(dir);
}

// 清空目录内容（保留目录本身）
async function clearDirectory(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeDirectory(fullPath);
    } else {
      await fs.promises.unlink(fullPath);
    }
  }
}

// 执行命令的辅助函数
function execCommand(command, cwd, description) {
  return new Promise((resolve, reject) => {
    colorLog("cyan", "EXEC", `${description}...`);
    colorLog("cyan", "CMD", `执行: ${command}`);

    const process = spawn(command, [], {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    process.on("close", (code) => {
      if (code === 0) {
        colorLog("green", "SUCCESS", `${description}完成`);
        resolve();
      } else {
        colorLog("red", "ERROR", `${description}失败，退出代码: ${code}`);
        reject(new Error(`${description}失败，退出代码: ${code}`));
      }
    });

    process.on("error", (error) => {
      colorLog("red", "ERROR", `${description}出错: ${error.message}`);
      reject(error);
    });
  });
}

// 步骤 1: 打包前端
async function buildFrontend() {
  colorLog("bright", "STEP 1/4", "📦 打包前端 HTML...");
  console.log("─".repeat(60));

  try {
    // 检查前端目录是否存在
    if (!fs.existsSync(frontendDir)) {
      throw new Error(`前端目录不存在: ${frontendDir}`);
    }

    await execCommand("pnpm build", frontendDir, "构建前端");

    // 验证 dist 目录是否生成
    if (!fs.existsSync(frontendDistDir)) {
      throw new Error(`前端构建失败，dist 目录不存在: ${frontendDistDir}`);
    }

    colorLog("green", "STEP 1/4", "✅ 前端打包完成");
    console.log("");
  } catch (error) {
    colorLog("red", "STEP 1/4", `❌ 前端打包失败: ${error.message}`);
    throw error;
  }
}

// 步骤 2: 复制资源到 backend/public
async function copyToBackendPublic() {
  colorLog("bright", "STEP 2/4", "📋 复制资源到 backend/public...");
  console.log("─".repeat(60));

  try {
    // 检查前端 dist 是否存在
    if (!fs.existsSync(frontendDistDir)) {
      throw new Error(`前端 dist 目录不存在: ${frontendDistDir}`);
    }

    // 清空 backend/public 目录
    colorLog("yellow", "CLEAN", "正在清空 backend/public 目录...");
    await clearDirectory(backendPublicDir);

    // 复制前端 dist 到 backend/public
    colorLog(
      "cyan",
      "COPY",
      `正在复制 ${frontendDistDir} -> ${backendPublicDir}`
    );
    await copyDirectory(frontendDistDir, backendPublicDir);

    colorLog("green", "STEP 2/4", "✅ 资源复制完成");
    console.log("");
  } catch (error) {
    colorLog("red", "STEP 2/4", `❌ 资源复制失败: ${error.message}`);
    throw error;
  }
}

// 步骤 3: 打包后端 exe
async function buildBackend() {
  colorLog("bright", "STEP 3/4", "🚀 打包后端 EXE...");
  console.log("─".repeat(60));

  try {
    // 检查后端目录是否存在
    if (!fs.existsSync(backendDir)) {
      throw new Error(`后端目录不存在: ${backendDir}`);
    }

    await execCommand("pnpm build", backendDir, "构建后端 EXE");

    // 根据平台检查生成的文件
    const platform = process.platform;
    const exeName = platform === "win32" ? "llm-server.exe" : "llm-server";
    const exePath = path.join(backendDistDir, exeName);

    if (!fs.existsSync(exePath)) {
      throw new Error(`后端构建失败，可执行文件不存在: ${exePath}`);
    }

    colorLog("green", "STEP 3/4", "✅ 后端打包完成");
    console.log("");
  } catch (error) {
    colorLog("red", "STEP 3/4", `❌ 后端打包失败: ${error.message}`);
    throw error;
  }
}

// 步骤 4: 复制 exe 到根目录 dist
async function copyExeToRoot() {
  colorLog("bright", "STEP 4/4", "📦 复制 EXE 到根目录 dist...");
  console.log("─".repeat(60));

  try {
    // 检查后端 dist 中的 exe
    const platform = process.platform;
    const exeName = platform === "win32" ? "llm-server.exe" : "llm-server";
    const sourceExePath = path.join(backendDistDir, exeName);

    if (!fs.existsSync(sourceExePath)) {
      throw new Error(`源可执行文件不存在: ${sourceExePath}`);
    }

    // 确保根目录 dist 存在
    await fs.promises.mkdir(rootDistDir, { recursive: true });

    // 复制 exe 到根目录 dist
    const destExePath = path.join(rootDistDir, exeName);
    colorLog("cyan", "COPY", `正在复制 ${sourceExePath} -> ${destExePath}`);
    await fs.promises.copyFile(sourceExePath, destExePath);

    colorLog("green", "STEP 4/4", "✅ EXE 复制完成");
    console.log("");

    // 显示文件大小
    const stats = await fs.promises.stat(destExePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    colorLog("cyan", "INFO", `文件大小: ${fileSizeMB} MB`);
    colorLog(
      "green",
      "SUCCESS",
      `\n✨ 打包完成！可执行文件位于: ${destExePath}`
    );
  } catch (error) {
    colorLog("red", "STEP 4/4", `❌ EXE 复制失败: ${error.message}`);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    colorLog("bright", "BUILD", "🚀 开始完整打包流程...\n");

    await buildFrontend();
    await copyToBackendPublic();
    await buildBackend();
    await copyExeToRoot();

    colorLog("bright", "COMPLETE", "\n🎉 所有步骤完成！\n");
  } catch (error) {
    colorLog("red", "FATAL", `\n❌ 打包失败: ${error.message}\n`);
    process.exit(1);
  }
}

// 运行主函数
main();
