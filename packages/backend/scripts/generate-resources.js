/**
 * 资源生成脚本
 * 在打包时读取 public 目录的所有文件，生成嵌入资源文件
 */
const { readdir, readFile, stat } = require("fs/promises");
const { join, relative, sep } = require("path");
const { writeFileSync } = require("fs");

const publicDir = join(__dirname, "..", "public");
const outputFile = join(
  __dirname,
  "..",
  "src",
  "utils",
  "embedded-resources.js"
);

/**
 * 递归读取目录中的所有文件
 */
async function readDirectory(dir, baseDir = dir) {
  const files = {};
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(baseDir, fullPath).replace(/\\/g, "/"); // 统一使用正斜杠

    if (entry.isDirectory()) {
      const subFiles = await readDirectory(fullPath, baseDir);
      Object.assign(files, subFiles);
    } else if (entry.isFile()) {
      const content = await readFile(fullPath);
      // 对于文本文件，直接存储为字符串；对于二进制文件，存储为 base64
      const isText = isTextFile(entry.name);
      files[relativePath] = {
        content: isText
          ? content.toString("utf-8")
          : content.toString("base64"),
        isBinary: !isText,
        size: content.length,
      };
    }
  }

  return files;
}

/**
 * 判断是否为文本文件
 */
function isTextFile(filename) {
  const textExtensions = [
    ".html",
    ".htm",
    ".css",
    ".js",
    ".json",
    ".txt",
    ".xml",
    ".svg",
    ".md",
    ".yml",
    ".yaml",
  ];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return textExtensions.includes(ext);
}

/**
 * 生成资源文件
 */
async function generateResources() {
  try {
    console.log("📦 开始生成嵌入资源...");
    console.log(`📂 读取目录: ${publicDir}`);

    const files = await readDirectory(publicDir);
    const fileCount = Object.keys(files).length;
    const totalSize = Object.values(files).reduce(
      (sum, file) => sum + file.size,
      0
    );

    console.log(
      `✅ 读取了 ${fileCount} 个文件，总大小: ${(
        totalSize /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    // 生成资源文件内容
    const resourceContent = `/**
 * 嵌入的静态资源
 * 此文件由 scripts/generate-resources.js 自动生成
 * 包含 public 目录中的所有文件内容
 */

const embeddedResources = ${JSON.stringify(files, null, 2)};

/**
 * 获取嵌入的资源内容
 * @param {string} path - 资源路径（相对于 public 目录）
 * @returns {{content: string, isBinary: boolean} | null}
 */
function getResource(path) {
  // 标准化路径：移除前导斜杠，统一使用正斜杠
  const normalizedPath = path.replace(/^\\//, "").replace(/\\\\/g, "/");
  
  const resource = embeddedResources[normalizedPath];
  if (!resource) {
    return null;
  }

  return {
    content: resource.content,
    isBinary: resource.isBinary,
    size: resource.size,
  };
}

/**
 * 检查资源是否存在
 */
function hasResource(path) {
  const normalizedPath = path.replace(/^\\//, "").replace(/\\\\/g, "/");
  return normalizedPath in embeddedResources;
}

/**
 * 列出所有可用的资源路径
 */
function listResources() {
  return Object.keys(embeddedResources);
}

module.exports = {
  getResource,
  hasResource,
  listResources,
  embeddedResources,
};
`;

    // 写入文件
    writeFileSync(outputFile, resourceContent, "utf-8");
    console.log(`✅ 资源文件已生成: ${outputFile}`);
    console.log(`📊 资源统计:`);
    console.log(`   - 文件数量: ${fileCount}`);
    console.log(`   - 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(
      `   - 文本文件: ${Object.values(files).filter((f) => !f.isBinary).length}`
    );
    console.log(
      `   - 二进制文件: ${
        Object.values(files).filter((f) => f.isBinary).length
      }`
    );
  } catch (error) {
    console.error("❌ 生成资源失败:", error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  generateResources();
}

module.exports = { generateResources };
