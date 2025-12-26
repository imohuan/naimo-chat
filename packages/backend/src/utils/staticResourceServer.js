/**
 * 静态资源服务器
 * 从嵌入的资源中提供静态文件服务，而不是从文件系统
 */
const { getResource, hasResource } = require("./embedded-resources");

/**
 * 注册嵌入的静态资源路由
 */
function registerEmbeddedStatic(app, prefix = "/ui/") {
  // 移除尾随斜杠
  const normalizedPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;

  // 处理所有静态资源请求
  app.get(`${normalizedPrefix}/*`, async (request, reply) => {
    try {
      // 获取请求路径（移除前缀）
      let requestPath = request.url;
      
      // 移除查询参数
      const queryIndex = requestPath.indexOf("?");
      if (queryIndex !== -1) {
        requestPath = requestPath.substring(0, queryIndex);
      }

      // 移除前缀
      if (requestPath.startsWith(normalizedPrefix)) {
        requestPath = requestPath.substring(normalizedPrefix.length);
      }

      // 移除前导斜杠
      requestPath = requestPath.replace(/^\/+/, "");

      // 如果路径为空，默认为 index.html
      if (!requestPath || requestPath === "") {
        requestPath = "index.html";
      }

      // 从嵌入资源中获取文件
      const resource = getResource(requestPath);

      if (!resource) {
        // 如果找不到文件，尝试 index.html（用于 SPA 路由）
        if (requestPath !== "index.html") {
          const indexResource = getResource("index.html");
          if (indexResource) {
            return sendResource(reply, indexResource, "text/html");
          }
        }
        return reply.code(404).send({ error: "File not found" });
      }

      // 确定 MIME 类型
      const mimeType = getMimeType(requestPath);

      // 发送资源
      return sendResource(reply, resource, mimeType);
    } catch (error) {
      console.error("提供静态资源时出错:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // 处理根路径重定向
  app.get(normalizedPrefix, async (_, reply) => {
    return reply.redirect(`${normalizedPrefix}/`);
  });
}

/**
 * 发送资源内容
 */
function sendResource(reply, resource, mimeType) {
  // 设置内容类型
  reply.type(mimeType);

  // 设置缓存头
  reply.header("Cache-Control", "public, max-age=3600");

  // 如果是二进制文件，需要从 base64 解码
  if (resource.isBinary) {
    const buffer = Buffer.from(resource.content, "base64");
    return reply.send(buffer);
  } else {
    return reply.send(resource.content);
  }
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
function getMimeType(filename) {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  const mimeTypes = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".otf": "font/otf",
    ".txt": "text/plain",
    ".xml": "application/xml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

module.exports = {
  registerEmbeddedStatic,
  hasResource,
  getResource,
};

