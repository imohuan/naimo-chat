@echo off
REM 创建符号链接
REM 注意：此命令需要管理员权限

REM 文件的符号链接
@REM powershell -Command "New-Item -ItemType SymbolicLink -Path 'main.log' -Target 'C:\Users\IMOHUAN\AppData\Roaming\Electron\logs\main.log' -Force"

@REM 在编辑器中快捷的访问Electron的数据目录
powershell -Command "New-Item -ItemType SymbolicLink -Path links/claude-llm -Target 'C:\Users\IMOHUAN\.claude-llm' -Force"
powershell -Command "New-Item -ItemType SymbolicLink -Path links/claude -Target 'C:\Users\IMOHUAN\.claude' -Force"
powershell -Command "New-Item -ItemType SymbolicLink -Path links/llm -Target 'G:\ClaudeCode\llms' -Force"
powershell -Command "New-Item -ItemType SymbolicLink -Path links/claude-router -Target 'G:\ClaudeCode\claude-code-router-main' -Force"

echo 符号链接创建完成！
pause

