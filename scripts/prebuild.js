#!/usr/bin/env node

/**
 * Prebuild 脚本
 * 将 mcp-server.js 文件的内容读取并生成为一个包含字符串常量的导出文件
 */

const fs = require("fs");
const path = require("path");

// 源文件路径
const sourceFile = path.join(__dirname, "../packages/backend/src/chat/mcp-server.js");
// 输出文件路径
const outputFile = path.join(__dirname, "../packages/backend/src/chat/mcp-server-text.js");

try {
  // 读取 mcp-server.js 的内容
  const mcpServerContent = fs.readFileSync(sourceFile, "utf-8");

  // 生成导出文件内容
  // 使用模板字符串，需要对反引号、反斜杠和 ${ 表达式进行转义
  // 转义顺序很重要：先转义反斜杠，再转义 ${，最后转义反引号
  const escapedContent = mcpServerContent
    .replace(/\\/g, "\\\\")   // 先转义反斜杠
    .replace(/\${/g, "\\${")  // 转义 ${ 表达式开始
    .replace(/`/g, "\\`");    // 最后转义反引号

  const outputContent = `/**
 * 此文件由 scripts/prebuild.js 自动生成
 * 请勿手动编辑此文件
 * 
 * 包含 mcp-server.js 的完整源代码作为字符串
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
  process.exit(1);
}

