// 简单无依赖示例服务器：提供静态 UI，并通过本地 Claude Code CLI 通讯
const http = require("http");
const { readFile } = require("fs/promises");
const path = require("path");
const { handleChatRoutes } = require("./router.js");

// ============================================
// 配置区域
// ============================================

const hostname = "127.0.0.1";
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
const indexPath = path.join(__dirname, "chat.html");

// ============================================
// 静态文件处理
// ============================================

async function handleStatic(req, res) {
  try {
    const html = await readFile(indexPath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("无法读取前端文件");
  }
}

// ============================================
// 创建服务器
// ============================================

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end();
    return;
  }

  // 尝试处理聊天路由
  const handled = await handleChatRoutes(req, res);

  // 如果路由未处理，返回静态页面
  if (!handled) {
    await handleStatic(req, res);
  }
});

// 启动服务器
server.listen(port, hostname, () => {
  console.log(`Demo server running at http://${hostname}:${port}`);
  console.log(`使用 CLI: ${process.platform === 'win32' ? 'claude.exe' : 'claude'}`);
});
