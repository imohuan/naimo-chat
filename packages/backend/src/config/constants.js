/**
 * 统一配置文件，管理所有路径常量
 * 参考 claude-code-router-main/src/constants.ts
 */
const { join } = require("path");
const { homedir, tmpdir } = require("os");

/* 主目录：存储所有配置、日志等文件的根目录 */
const HOME_DIR = join(homedir(), ".claude-llm");
// const HOME_DIR = join(process.cwd(), ".claude-llm");
/* 配置文件：存储路由器和提供者配置的主配置文件 */
const CONFIG_FILE = join(HOME_DIR, "config.json");
/* MCP 服务器目录：存储 MCP 服务器文件的目录 */
const MCP_SERVER_DIR = join(HOME_DIR, "mcp-server");
/* 项目保存目录 */
const PROJECT_DIR = join(HOME_DIR, "projects");
/* PID 文件：存储后台服务进程 ID 的文件 */
const PID_FILE = join(HOME_DIR, ".claude-llm.pid");
/* 剪贴板监听任务 PID 文件 */
const CLIPBOARD_WATCH_PID_FILE = join(HOME_DIR, ".watch-clipboard.pid");
/* 重启信号文件：用于通知主进程重启子进程的信号文件 */
const RESTART_SIGNAL_FILE = join(HOME_DIR, ".restart");
/* 插件目录：存储自定义插件的位置 */
const PLUGINS_DIR = join(HOME_DIR, "plugins");
/* 日志目录：存储日志文件的位置 */
const LOGS_DIR = join(HOME_DIR, "logs");
/* 日志目录：存储日志文件的位置 */
const CLIPBOARD_IMAGES_DIR = join(HOME_DIR, "clipboard_images");
/* 引用计数文件：用于跟踪服务引用次数的临时文件 */
const REFERENCE_COUNT_FILE = join(tmpdir(), "claude-llm-reference-count.txt");
/* Claude 主目录：Claude 编辑器的主配置目录 */
const CLAUDE_DIR = join(homedir(), ".claude");
/* Claude 项目目录：Claude 编辑器存储项目数据的目录 */
const CLAUDE_PROJECTS_DIR = join(CLAUDE_DIR, "projects");
/* Claude settings.json 文件路径 */
const CLAUDE_SETTINGS_PATH = join(CLAUDE_DIR, "settings.json");
/* 日志文件：主日志文件路径 */
const LOG_FILE = join(HOME_DIR, "claude-code-router.log");
/* MCP 服务器配置文件：存储 MCP 服务器配置的文件 */
const MCP_SERVERS_CONFIG_FILE = join(HOME_DIR, "mcp-servers.json");

module.exports = {
  HOME_DIR,
  CONFIG_FILE,
  MCP_SERVER_DIR,
  PROJECT_DIR,
  PID_FILE,
  RESTART_SIGNAL_FILE,
  PLUGINS_DIR,
  LOGS_DIR,
  REFERENCE_COUNT_FILE,
  CLAUDE_DIR,
  CLAUDE_PROJECTS_DIR,
  CLAUDE_SETTINGS_PATH,
  CLIPBOARD_IMAGES_DIR,
  CLIPBOARD_WATCH_PID_FILE,
  LOG_FILE,
  MCP_SERVERS_CONFIG_FILE,
};
