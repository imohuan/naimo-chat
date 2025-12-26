#!/usr/bin/env node

/**
 * Prebuild 脚本
 * 使用 esbuild 打包 mcp-server.js 及其依赖，然后将打包后的代码生成为一个包含字符串常量的导出文件
 */

const fs = require("fs");
const path = require("path");
const { build } = require("esbuild");

// 源文件路径
const sourceFile = path.join(__dirname, "../packages/backend/src/chat/mcp-server.js");
// 输出文件路径
const outputFile = path.join(__dirname, "../packages/backend/src/chat/mcp-server-text.js");

async function prebuild() {
  try {
    console.log("📦 使用 esbuild 打包 mcp-server.js...");

    // 使用 esbuild 打包文件，将所有依赖内联到单个文件中
    const result = await build({
      entryPoints: [sourceFile],
      bundle: true,                    // 打包所有依赖
      platform: "node",                // Node.js 平台
      format: "cjs",                   // CommonJS 格式
      target: "node18",                // Node.js 18+
      write: false,                    // 不写入文件系统，而是获取内容
      packages: "bundle",              // 打包所有 npm 包，但排除 Node.js 内置模块
      minify: false,                   // 不压缩，保持可读性
      sourcemap: false,                // 不生成 sourcemap
      banner: {
        js: "#!/usr/bin/env node\n",   // 保留 shebang
      },
    });

    // 获取打包后的代码内容
    const bundledContent = result.outputFiles[0].text;

    // 生成导出文件内容
    // 使用模板字符串，需要对反引号、反斜杠和 ${ 表达式进行转义
    // 转义顺序很重要：先转义反斜杠，再转义 ${，最后转义反引号
    const escapedContent = bundledContent
      .replace(/\\/g, "\\\\")   // 先转义反斜杠
      .replace(/\${/g, "\\${")  // 转义 ${ 表达式开始
      .replace(/`/g, "\\`");    // 最后转义反引号

    const outputContent = `/**
 * 此文件由 scripts/prebuild.js 自动生成
 * 请勿手动编辑此文件
 * 
 * 包含 mcp-server.js 及其所有依赖的打包后代码作为字符串
 */

const mcpServerText = \`${escapedContent}\`;

module.exports = { mcpServerText };
`;

    // 确保输出目录存在
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 写入输出文件
    fs.writeFileSync(outputFile, outputContent, "utf-8");

    console.log(`✓ Prebuild completed: ${path.relative(process.cwd(), outputFile)}`);
  } catch (error) {
    console.error("✗ Prebuild failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

prebuild();

