# Bun 打包指南

本项目使用 [Bun](https://bun.sh) 进行单文件打包，生成独立的可执行程序。

## 前置要求

1. 安装 Bun（如果尚未安装）：

   ```bash
   # Windows (PowerShell)
   powershell -c "irm bun.sh/install.ps1 | iex"

   # macOS/Linux
   curl -fsSL https://bun.sh/install | bash
   ```

2. 验证安装：
   ```bash
   bun --version
   ```

## 打包命令

### 方式一：使用 npm 脚本（推荐）

```bash
# 自动检测平台并打包
npm run build

# 或使用 pnpm
pnpm build
```

### 方式二：直接使用 Bun 命令

```bash
# Windows
bun build src/index_llm.js --compile --outfile dist/llm-server.exe

# Linux/macOS
bun build src/index_llm.js --compile --outfile dist/llm-server
```

### 方式三：使用平台特定命令

```bash
# Windows
npm run build:win

# Linux
npm run build:linux

# macOS
npm run build:mac
```

## 输出文件

打包完成后，可执行文件将位于 `dist/` 目录：

- **Windows**: `dist/llm-server.exe`
- **Linux/macOS**: `dist/llm-server`

## 文件大小

使用 Bun 打包后的文件大小通常在 **40-80MB** 左右，相比 Node.js SEA 更小。

## 使用打包后的文件

打包后的可执行文件是独立的，不需要 Node.js 运行时环境，可以直接运行：

```bash
# Windows
.\dist\llm-server.exe

# Linux/macOS
./dist/llm-server
```

所有命令行参数与原程序相同：

```bash
# 启动服务
.\dist\llm-server.exe

# 服务模式（子进程）
.\dist\llm-server.exe --service

# 停止服务
.\dist\llm-server.exe --stop

# 剪贴板监听模式
.\dist\llm-server.exe --clipboard-watch
```

## 静态资源嵌入

打包过程会自动将 `public/` 目录中的所有静态文件（前端页面、CSS、JS 等）嵌入到可执行文件中。

### 工作原理

1. **打包时**：`scripts/generate-resources.js` 会读取 `public/` 目录的所有文件
2. **生成资源文件**：创建 `src/utils/embedded-resources.js`，包含所有文件的 Base64 编码内容
3. **运行时**：程序优先从嵌入的资源中提供静态文件，无需外部 `public/` 目录

### 优势

- ✅ **单文件部署**：只需一个 exe 文件，无需额外的静态文件目录
- ✅ **开发模式兼容**：开发时仍可使用文件系统，自动回退
- ✅ **性能优化**：资源直接从内存提供，无需磁盘 I/O

### 资源统计

当前打包包含约 **212 个文件**，总大小约 **17.65 MB**，已全部嵌入到可执行文件中。

## 注意事项

1. **原生模块兼容性**：如果项目使用了原生 Node.js 模块（如 `clipboardy`），Bun 会尝试自动处理，但某些复杂的原生绑定可能需要额外配置。

2. **动态 require**：确保所有依赖都是静态可分析的，避免使用动态 `require()`。

3. **文件系统路径**：打包后的程序仍然可以正常访问文件系统，配置文件路径保持不变。

4. **跨平台打包**：要在不同平台打包，需要在对应平台上运行打包命令。

5. **静态资源更新**：如果需要更新前端页面，需要重新运行打包命令以重新生成嵌入资源。

## 故障排除

如果打包失败，请检查：

1. Bun 版本是否最新：`bun upgrade`
2. 依赖是否完整安装：`bun install`
3. 查看错误信息，某些原生模块可能需要特殊处理
