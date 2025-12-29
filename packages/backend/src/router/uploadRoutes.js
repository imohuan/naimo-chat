const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { STATIC_DIR, FILE_HASH_INDEX_FILE } = require("../config/constants");
const { ensureDir } = require("../utils/paths");

/**
 * 根据文件扩展名判断文件类型
 * @param {string} filename - 文件名
 * @returns {string} 文件类型分类目录名
 */
function getFileCategory(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1); // 去掉点号

  // 图片类型
  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"];
  if (imageExts.includes(ext)) {
    return "images";
  }

  // 文档类型
  const documentExts = [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "md", "rtf", "odt", "ods", "odp"
  ];
  if (documentExts.includes(ext)) {
    return "documents";
  }

  // 视频类型
  const videoExts = ["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm", "m4v", "3gp"];
  if (videoExts.includes(ext)) {
    return "videos";
  }

  // 音频类型
  const audioExts = ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a", "opus"];
  if (audioExts.includes(ext)) {
    return "audio";
  }

  // 压缩包类型
  const archiveExts = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "z"];
  if (archiveExts.includes(ext)) {
    return "archives";
  }

  // 代码文件类型
  const codeExts = [
    "js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "hpp",
    "html", "css", "scss", "sass", "less", "json", "xml", "yaml", "yml",
    "sh", "bat", "ps1", "go", "rs", "php", "rb", "swift", "kt", "dart",
    "vue", "svelte", "sql", "lua", "r", "m", "mm"
  ];
  if (codeExts.includes(ext)) {
    return "code";
  }

  // 其他类型
  return "others";
}

/**
 * 生成UUID v4
 * @returns {string} UUID字符串
 */
function generateUUID() {
  // 使用 Node.js 内置的 crypto.randomUUID（Node.js 14.17.0+）
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 降级方案：手动生成 UUID v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 从文件名提取扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（包含点号，如果没有扩展名则返回空字符串）
 */
function getFileExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext || "";
}

/**
 * 生成UUID文件名（保留原始扩展名）
 * @param {string} originalFilename - 原始文件名
 * @returns {string} UUID文件名
 */
function generateUUIDFilename(originalFilename) {
  const ext = getFileExtension(originalFilename);
  const uuid = generateUUID();
  return ext ? `${uuid}${ext}` : uuid;
}

/**
 * 确保文件保存目录存在
 * @param {string} category - 文件分类
 * @returns {Promise<string>} 目录路径
 */
async function ensureCategoryDir(category) {
  const categoryDir = path.join(STATIC_DIR, category);
  ensureDir(categoryDir);
  return categoryDir;
}

/**
 * 计算文件的SHA256 hash值
 * @param {Buffer} buffer - 文件内容缓冲区
 * @returns {string} hash值（hex格式）
 */
function calculateFileHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * 加载hash索引文件
 * @returns {Promise<Object>} hash索引对象 {hash: {path, category, filename, size, uploadedAt}}
 */
async function loadHashIndex() {
  try {
    const content = await fs.readFile(FILE_HASH_INDEX_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      // 文件不存在，返回空对象
      return {};
    }
    console.error("加载hash索引文件失败:", error);
    return {};
  }
}

/**
 * 保存hash索引文件
 * @param {Object} hashIndex - hash索引对象
 * @returns {Promise<void>}
 */
async function saveHashIndex(hashIndex) {
  try {
    // 确保目录存在
    const dir = path.dirname(FILE_HASH_INDEX_FILE);
    ensureDir(dir);
    await fs.writeFile(FILE_HASH_INDEX_FILE, JSON.stringify(hashIndex, null, 2), "utf-8");
  } catch (error) {
    console.error("保存hash索引文件失败:", error);
  }
}

/**
 * 检查hash是否存在
 * @param {string} hash - 文件hash值
 * @returns {Promise<Object|null>} 如果存在返回文件信息，否则返回null
 */
async function checkHashExists(hash) {
  const hashIndex = await loadHashIndex();
  return hashIndex[hash] || null;
}

/**
 * 添加hash到索引
 * @param {string} hash - 文件hash值
 * @param {Object} fileInfo - 文件信息 {path, category, filename, size, uploadedAt}
 * @returns {Promise<void>}
 */
async function addHashToIndex(hash, fileInfo) {
  const hashIndex = await loadHashIndex();
  hashIndex[hash] = fileInfo;
  await saveHashIndex(hashIndex);
}

/**
 * 文件上传路由
 */
function registerUploadRoutes(server) {
  const app = server.app;

  // 注册 multipart 插件
  app.register(require("@fastify/multipart"), {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });

  /**
   * POST /api/upload
   * 文件上传接口（支持hash去重）
   */
  app.post("/api/upload", async (req, reply) => {
    try {
      const data = await req.file();

      if (!data) {
        return reply.code(400).send({ error: "没有上传文件" });
      }

      // 获取文件信息
      const originalFilename = data.filename || "unnamed";

      // 读取文件内容并计算hash
      const buffer = await data.toBuffer();
      const fileHash = calculateFileHash(buffer);

      // 检查hash是否已存在
      const existingFile = await checkHashExists(fileHash);
      if (existingFile) {
        // 文件已存在，返回已有文件信息
        return {
          success: true,
          duplicate: true,
          hash: fileHash,
          filename: existingFile.filename,
          originalFilename: existingFile.originalFilename || originalFilename,
          category: existingFile.category,
          path: existingFile.path,
          size: existingFile.size,
          uploadedAt: existingFile.uploadedAt,
          message: "文件已存在（hash匹配），跳过上传",
        };
      }

      // hash不存在，继续上传
      // 生成UUID文件名（保留原始扩展名）
      const uuidFilename = generateUUIDFilename(originalFilename);

      // 根据文件类型分类（使用原始文件名判断类型）
      const category = getFileCategory(originalFilename);

      // 确保分类目录存在
      const categoryDir = await ensureCategoryDir(category);

      // 生成保存路径（使用UUID文件名）
      const finalPath = path.join(categoryDir, uuidFilename);
      const finalFilename = uuidFilename;

      // 保存文件
      await fs.writeFile(finalPath, buffer);

      // 获取文件信息
      const stats = await fs.stat(finalPath);
      const uploadedAt = new Date().toISOString();

      // 保存文件信息到hash索引
      const fileInfo = {
        path: `/static/${category}/${finalFilename}`,
        category: category,
        filename: finalFilename,
        originalFilename: originalFilename,
        size: stats.size,
        uploadedAt: uploadedAt,
      };
      await addHashToIndex(fileHash, fileInfo);

      return {
        success: true,
        duplicate: false,
        hash: fileHash,
        filename: finalFilename,
        originalFilename: originalFilename,
        category: category,
        path: `/static/${category}/${finalFilename}`,
        size: stats.size,
        uploadedAt: uploadedAt,
      };
    } catch (error) {
      console.error("文件上传失败:", error);
      return reply.code(500).send({
        error: "文件上传失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /api/upload/multiple
   * 多文件上传接口（支持hash去重）
   */
  app.post("/api/upload/multiple", async (req, reply) => {
    try {
      const parts = req.parts();

      const results = [];
      const errors = [];
      let uploadedCount = 0;
      let duplicateCount = 0;

      for await (const part of parts) {
        if (part.file) {
          try {
            const originalFilename = part.filename || "unnamed";

            // 读取文件内容并计算hash
            const buffer = await part.toBuffer();
            const fileHash = calculateFileHash(buffer);

            // 检查hash是否已存在
            const existingFile = await checkHashExists(fileHash);
            if (existingFile) {
              // 文件已存在，返回已有文件信息
              duplicateCount++;
              results.push({
                success: true,
                duplicate: true,
                hash: fileHash,
                filename: existingFile.filename,
                originalFilename: existingFile.originalFilename || originalFilename,
                category: existingFile.category,
                path: existingFile.path,
                size: existingFile.size,
                uploadedAt: existingFile.uploadedAt,
                message: "文件已存在（hash匹配），跳过上传",
              });
              continue;
            }

            // hash不存在，继续上传
            // 生成UUID文件名（保留原始扩展名）
            const uuidFilename = generateUUIDFilename(originalFilename);

            // 根据文件类型分类（使用原始文件名判断类型）
            const category = getFileCategory(originalFilename);
            const categoryDir = await ensureCategoryDir(category);

            // 生成保存路径（使用UUID文件名）
            const finalPath = path.join(categoryDir, uuidFilename);
            const finalFilename = uuidFilename;

            await fs.writeFile(finalPath, buffer);
            const stats = await fs.stat(finalPath);
            const uploadedAt = new Date().toISOString();

            // 保存文件信息到hash索引
            const fileInfo = {
              path: `/static/${category}/${finalFilename}`,
              category: category,
              filename: finalFilename,
              originalFilename: originalFilename,
              size: stats.size,
              uploadedAt: uploadedAt,
            };
            await addHashToIndex(fileHash, fileInfo);

            uploadedCount++;
            results.push({
              success: true,
              duplicate: false,
              hash: fileHash,
              filename: finalFilename,
              originalFilename: originalFilename,
              category: category,
              path: `/static/${category}/${finalFilename}`,
              size: stats.size,
              uploadedAt: uploadedAt,
            });
          } catch (error) {
            errors.push({
              filename: part.filename || "unknown",
              error: error.message,
            });
          }
        }
      }

      return {
        success: true,
        uploaded: uploadedCount,
        duplicate: duplicateCount,
        failed: errors.length,
        files: results,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("多文件上传失败:", error);
      return reply.code(500).send({
        error: "多文件上传失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/upload/hash/:hash
   * 根据hash查询文件信息
   */
  app.get("/api/upload/hash/:hash", async (req, reply) => {
    try {
      const { hash } = req.params;
      const fileInfo = await checkHashExists(hash);

      if (!fileInfo) {
        return reply.code(404).send({
          error: "文件不存在",
          message: "未找到对应hash的文件",
        });
      }

      return {
        success: true,
        hash: hash,
        ...fileInfo,
      };
    } catch (error) {
      console.error("查询hash失败:", error);
      return reply.code(500).send({
        error: "查询hash失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /api/upload/categories
   * 获取所有文件分类列表
   */
  app.get("/api/upload/categories", async (_req, reply) => {
    try {
      const categories = ["images", "documents", "videos", "audio", "archives", "code", "others"];
      const categoryInfo = [];

      for (const category of categories) {
        const categoryDir = path.join(STATIC_DIR, category);
        try {
          const files = await fs.readdir(categoryDir);
          const fileStats = await Promise.all(
            files.map(async (file) => {
              try {
                const filePath = path.join(categoryDir, file);
                const stats = await fs.stat(filePath);
                return {
                  filename: file,
                  size: stats.size,
                  modifiedAt: stats.mtime.toISOString(),
                };
              } catch {
                return null;
              }
            })
          );

          categoryInfo.push({
            category,
            count: fileStats.filter((f) => f !== null).length,
            files: fileStats.filter((f) => f !== null),
          });
        } catch {
          categoryInfo.push({
            category,
            count: 0,
            files: [],
          });
        }
      }

      return categoryInfo;
    } catch (error) {
      console.error("获取文件分类列表失败:", error);
      return reply.code(500).send({
        error: "获取文件分类列表失败",
        message: error.message,
      });
    }
  });
}

module.exports = { registerUploadRoutes };

