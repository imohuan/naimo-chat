const { spawn } = require("child_process");

// 在这里自定义你想在新 PowerShell 窗口里执行的命令
// 示例：执行当前目录下的 run_base.ps1
const customCommand =
  'echo "Hello from new PowerShell window"; Read-Host "Press Enter to exit"';
// 也可以改成任意指令，比如：
// const customCommand = 'echo "Hello from new PowerShell window"; Read-Host "Press Enter to exit"';

// 使用 cmd 的 start 命令打开一个新的 PowerShell 窗口并执行上面的指令
spawn("cmd.exe", ["/c", "start", "powershell", "-NoExit", "-Command", customCommand], {
  detached: true,
  stdio: "ignore", // 不占用当前终端的 stdin/stdout/stderr
});

console.log("已启动新的 PowerShell 窗口并执行自定义指令。");
