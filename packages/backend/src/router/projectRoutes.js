const fs = require("fs").promises;
const path = require("path");
const { PROJECT_DIR } = require("../config/constants");
const { ensureDir } = require("../utils/paths");

/**
 * 对话项目路由
 * 每个对话存储为 ~/.claude-llm/projects/{id}.json 文件
 */
function registerProjectRoutes(server) {
  const app = server.app;

  // 确保项目目录存在
  ensureDir(PROJECT_DIR);

  /**
   * 获取对话文件路径
   */
  function getConversationFilePath(id) {
    // 确保 ID 只包含安全字符，防止路径遍历攻击
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    return path.join(PROJECT_DIR, `${safeId}.json`);
  }

  /**
   * 读取对话文件
   * - 文件不存在：返回 null
   * - JSON 损坏：记录错误并返回 null（避免 500）
   */
  async function readConversationFile(id) {
    const filePath = getConversationFilePath(id);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      // 某些旧文件或意外写入可能不是合法 JSON，避免直接 500
      if (error.name === "SyntaxError") {
        console.error(
          `对话文件 JSON 解析失败，将视为不存在: ${filePath}`,
          error
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * 写入对话文件
   */
  async function writeConversationFile(id, data) {
    const filePath = getConversationFilePath(id);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * 删除对话文件
   */
  async function deleteConversationFile(id) {
    const filePath = getConversationFilePath(id);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * GET /api/projects
   * 获取所有对话列表
   */
  app.get("/api/projects", async (_req, reply) => {
    try {
      const files = await fs.readdir(PROJECT_DIR);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      const conversations = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const filePath = path.join(PROJECT_DIR, file);
            const content = await fs.readFile(filePath, "utf-8");
            const data = JSON.parse(content);
            // 从文件名提取 ID（去掉 .json 后缀）
            const id = file.replace(/\.json$/, "");
            return {
              id,
              ...data,
            };
          } catch (error) {
            console.error(`读取对话文件 ${file} 失败:`, error);
            return null;
          }
        })
      );

      // 过滤掉读取失败的文件
      const validConversations = conversations.filter((c) => c !== null);

      // 按创建时间倒序排序
      validConversations.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA;
      });

      return validConversations;
    } catch (error) {
      console.error("获取对话列表失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/projects/:id
   * 获取单个对话
   */
  app.get("/api/projects/:id", async (req, reply) => {
    try {
      const { id } = req.params;
      const conversation = await readConversationFile(id);
      if (!conversation) {
        reply.code(404).send({ error: "对话未找到" });
        return;
      }
      return { id, ...conversation };
    } catch (error) {
      console.error("获取对话失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/projects
   * 创建新对话
   */
  app.post("/api/projects", async (req, reply) => {
    try {
      const { id, ...conversationData } = req.body;
      if (!id) {
        reply.code(400).send({ error: "缺少对话 ID" });
        return;
      }

      // 检查对话是否已存在
      const existing = await readConversationFile(id);
      if (existing) {
        reply.code(409).send({ error: "对话已存在" });
        return;
      }

      // 创建新对话（移除 id，因为 id 已经在文件名中）
      const { id: _, ...conversationDataWithoutId } = conversationData;
      const newConversation = {
        ...conversationDataWithoutId,
        createdAt: conversationData.createdAt || Date.now(),
      };

      await writeConversationFile(id, newConversation);
      return { id, ...newConversation };
    } catch (error) {
      console.error("创建对话失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * PUT /api/projects/:id
   * 更新对话（如果不存在则创建）
   */
  app.put("/api/projects/:id", async (req, reply) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // 检查对话是否存在
      const existing = await readConversationFile(id);

      // 合并更新数据（移除 id，因为 id 已经在文件名中）
      const { id: _, ...updatesWithoutId } = updates;

      let finalConversation;
      if (!existing) {
        // 如果不存在，则创建新对话
        finalConversation = {
          title: updates.title || "新对话",
          createdAt: updates.createdAt || Date.now(),
          messages: updates.messages || [],
          pending: updates.pending !== undefined ? updates.pending : false,
          ...updatesWithoutId,
        };
      } else {
        // 如果存在，则合并更新
        finalConversation = {
          ...existing,
          ...updatesWithoutId,
        };
      }

      await writeConversationFile(id, finalConversation);
      return { id, ...finalConversation };
    } catch (error) {
      console.error("更新对话失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * DELETE /api/projects/:id
   * 删除对话
   */
  app.delete("/api/projects/:id", async (req, reply) => {
    try {
      const { id } = req.params;

      // 检查对话是否存在
      const existing = await readConversationFile(id);
      if (!existing) {
        reply.code(404).send({ error: "对话未找到" });
        return;
      }

      await deleteConversationFile(id);
      return { success: true };
    } catch (error) {
      console.error("删除对话失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });
}

module.exports = { registerProjectRoutes };
