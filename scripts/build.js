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
const readline = require("readline");

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
const webDir = path.join(rootDir, "packages", "web");
const backendDir = path.join(rootDir, "packages", "backend");
const frontendDistDir = path.join(frontendDir, "dist");
const webDistDir = path.join(webDir, "dist");
const backendPublicDir = path.join(backendDir, "internal-public");
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

// 检查前端资源是否存在
function checkFrontendResources() {
  const hasFrontendDist =
    fs.existsSync(frontendDistDir) &&
    fs.readdirSync(frontendDistDir).length > 0;
  const hasWebDist =
    fs.existsSync(webDistDir) &&
    fs.readdirSync(webDistDir).length > 0;
  const hasBackendPublic =
    fs.existsSync(backendPublicDir) &&
    fs.readdirSync(backendPublicDir).length > 0;

  return hasFrontendDist || hasWebDist || hasBackendPublic;
}

// 显示交互式菜单并获取用户选择
function showMenu() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("");
    colorLog("yellow", "INFO", "检测到前端资源已存在");
    console.log("─".repeat(60));
    console.log(`${colors.cyan}请选择操作：${colors.reset}`);
    console.log(`${colors.green}  1.${colors.reset} 重新编译前端（推荐）`);
    console.log(`${colors.green}  2.${colors.reset} 跳过前端编译，使用现有资源`);
    console.log(`${colors.yellow}  3.${colors.reset} 取消打包`);
    console.log("─".repeat(60));

    rl.question(`${colors.cyan}请输入选项 (1/2/3): ${colors.reset}`, (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === "1") {
        resolve("build");
      } else if (choice === "2") {
        resolve("skip");
      } else if (choice === "3") {
        resolve("cancel");
      } else {
        colorLog("red", "ERROR", "无效选项，默认选择重新编译");
        resolve("build");
      }
    });
  });
}

// 步骤 1: 打包前端
async function buildFrontend() {
  colorLog("bright", "STEP 1/5", "📦 打包前端 HTML...");
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

    colorLog("green", "STEP 1/5", "✅ 前端打包完成");
    console.log("");
  } catch (error) {
    colorLog("red", "STEP 1/5", `❌ 前端打包失败: ${error.message}`);
    throw error;
  }
}

// 步骤 1.5: 打包 Web 页面
async function buildWeb() {
  colorLog("bright", "STEP 2/5", "📦 打包 Web 页面...");
  console.log("─".repeat(60));

  try {
    // 检查 web 目录是否存在
    if (!fs.existsSync(webDir)) {
      throw new Error(`Web 目录不存在: ${webDir}`);
    }

    await execCommand("pnpm build", webDir, "构建 Web 页面");

    // 验证 dist 目录是否生成
    if (!fs.existsSync(webDistDir)) {
      throw new Error(`Web 构建失败，dist 目录不存在: ${webDistDir}`);
    }

    colorLog("green", "STEP 2/5", "✅ Web 页面打包完成");
    console.log("");
  } catch (error) {
    colorLog("red", "STEP 2/5", `❌ Web 页面打包失败: ${error.message}`);
    throw error;
  }
}

// 步骤 2: 复制资源到 backend/public
async function copyToBackendPublic() {
  colorLog("bright", "STEP 3/5", "📋 复制资源到 backend/public...");
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

    // 复制 web dist 到 backend/public，并将 index.html 重命名为 chat.html
    if (fs.existsSync(webDistDir)) {
      colorLog(
        "cyan",
        "COPY",
        `正在复制 ${webDistDir} -> ${backendPublicDir} (index.html -> chat.html)`
      );

      const entries = await fs.promises.readdir(webDistDir, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(webDistDir, entry.name);
        let destPath = path.join(backendPublicDir, entry.name);

        // 如果是 index.html，重命名为 chat.html
        if (entry.name === 'index.html') {
          destPath = path.join(backendPublicDir, 'chat.html');
          colorLog("cyan", "RENAME", `index.html -> chat.html`);
        }

        if (entry.isDirectory()) {
          await copyDirectory(srcPath, destPath);
        } else {
          await fs.promises.copyFile(srcPath, destPath);
        }
      }
    }

    colorLog("green", "STEP 3/5", "✅ 资源复制完成");
    console.log("");
  } catch (error) {
    colorLog("red", "STEP 3/5", `❌ 资源复制失败: ${error.message}`);
    throw error;
  }
}

// 步骤 3: 打包后端 exe
async function buildBackend() {
  colorLog("bright", "STEP 4/5", "🚀 打包后端 EXE...");
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

    colorLog("green", "STEP 4/5", "✅ 后端打包完成");
    console.log("");
  } catch (error) {
    colorLog("red", "STEP 4/5", `❌ 后端打包失败: ${error.message}`);
    throw error;
  }
}

// 步骤 4: 复制 exe 到根目录 dist
async function copyExeToRoot() {
  colorLog("bright", "STEP 5/5", "📦 复制 EXE 到根目录 dist...");
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

    colorLog("green", "STEP 5/5", "✅ EXE 复制完成");
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
    colorLog("red", "STEP 5/5", `❌ EXE 复制失败: ${error.message}`);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    colorLog("bright", "BUILD", "🚀 开始完整打包流程...\n");

    // 检查前端资源是否存在，如果存在则显示菜单
    let shouldBuildFrontend = true;
    if (checkFrontendResources()) {
      const choice = await showMenu();
      if (choice === "cancel") {
        colorLog("yellow", "CANCEL", "用户取消打包");
        process.exit(0);
      } else if (choice === "skip") {
        shouldBuildFrontend = false;
        colorLog("yellow", "SKIP", "跳过前端编译，使用现有资源");
        console.log("");
      }
    }

    // 根据用户选择决定是否编译前端
    if (shouldBuildFrontend) {
      await buildFrontend();
      await buildWeb();
    } else {
      // 如果跳过前端编译，需要确保 frontendDistDir 存在
      // 如果 frontendDistDir 不存在但 backendPublicDir 存在，则从 backendPublicDir 复制回去
      if (!fs.existsSync(frontendDistDir) && fs.existsSync(backendPublicDir)) {
        colorLog("yellow", "INFO", "从 backend/public 恢复前端资源...");
        await copyDirectory(backendPublicDir, frontendDistDir);
      }
    }

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
