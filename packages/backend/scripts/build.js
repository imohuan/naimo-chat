/**
 * Bun 打包脚本
 * 使用 Bun 将项目打包成单文件可执行程序
 * 在打包前会自动生成嵌入的静态资源
 */
const { mkdir } = require("fs/promises");
const { join } = require("path");
const { execSync } = require("child_process");

const distDir = join(__dirname, "..", "dist");
const entryFile = join(__dirname, "..", "src", "index_llm.js");
const generateResourcesScript = join(__dirname, "generate-resources.js");

// 根据平台确定输出文件名
const platform = process.platform;
let outputFile;
if (platform === "win32") {
  outputFile = join(distDir, "llm-server.exe");
} else {
  outputFile = join(distDir, "llm-server");
}

async function build() {
  try {
    // 确保 dist 目录存在
    await mkdir(distDir, { recursive: true });

    console.log("📦 步骤 1/2: 生成嵌入的静态资源...");
    console.log("─".repeat(50));

    // 生成嵌入资源
    try {
      const { generateResources } = require(generateResourcesScript);
      await generateResources();
    } catch (error) {
      console.error("❌ 生成资源失败:", error.message);
      process.exit(1);
    }

    console.log("\n🚀 步骤 2/2: 使用 Bun 打包...");
    console.log("─".repeat(50));
    console.log(`📦 入口文件: ${entryFile}`);
    console.log(`📤 输出文件: ${outputFile}`);
    console.log(`🖥️  目标平台: ${platform}`);

    // 执行 Bun 打包命令
    const command = `bun build "${entryFile}" --compile --outfile "${outputFile}"`;
    console.log(`\n执行命令: ${command}\n`);

    execSync(command, {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });

    console.log(`\n✅ 打包完成！`);
    console.log(`📦 可执行文件: ${outputFile}`);
    console.log(
      `\n💡 提示: 静态资源已嵌入到可执行文件中，无需额外的 public 目录`
    );
  } catch (error) {
    console.error("❌ 打包失败:", error.message);
    process.exit(1);
  }
}

build();
