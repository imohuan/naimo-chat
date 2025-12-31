const { spawn } = require('child_process');
// /c 表示执行完后关闭窗口；/k 表示执行完后保留窗口（方便调试）

// 基于当前进程的环境变量，只添加或覆盖需要的变量
const env = {
  ...process.env, // 保留所有现有的环境变量
  // 如果需要覆盖特定变量，在这里添加
  ANTHROPIC_BASE_URL: "http://127.0.0.1:3457",
  ANTHROPIC_AUTH_TOKEN: "sk-123456",
};

// spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', 'claude'], {
spawn('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-Command', 'claude'], {
  cwd: "G:\\ClaudeCode",
  shell: true,
  detached: true, // 使子进程独立于父进程运行
  stdio: 'ignore',
  env,
}).unref(); 