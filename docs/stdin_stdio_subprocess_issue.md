# Node.js 子进程 stdin/stdio 问题分析与解决方案

## 问题描述

在将 `router.js` 从独立 HTTP 服务器迁移到 Fastify 框架后，`spawn()` 创建的子进程一直卡住，无法启动。而相同的代码在 `server.js`（独立 HTTP 服务器）中运行正常。

### 症状

- ✅ 手动执行命令：正常工作
- ✅ `server.js` 中执行：正常工作  
- ❌ `router.js` (Fastify) 中执行：卡住，无日志输出

### 原始代码

```javascript
// router.js - 卡住
const child = spawn(claudePath, args, {
  cwd,
  stdio: ['inherit', 'pipe', 'pipe'],  // ❌ 问题所在
  env: {
    API_TIMEOUT_MS: config.API_TIMEOUT_MS,
    ANTHROPIC_BASE_URL: `http://${config.HOST}:${config.PORT}/`,
    ANTHROPIC_AUTH_TOKEN: config.APIKEY,
    MCP_STREAMING_ID: streamingId,
  },
});
```

---

## 根本原因分析

### 1. stdin/stdout/stderr 基础知识

每个进程都有三个标准流（文件描述符）：

| 流 | 文件描述符 | 用途 | 方向 |
|---|-----------|------|------|
| **stdin** | 0 | 标准输入 | 进程 ← 外部 |
| **stdout** | 1 | 标准输出 | 进程 → 外部 |
| **stderr** | 2 | 标准错误 | 进程 → 外部 |

### 2. `stdio` 参数详解

在 `child_process.spawn()` 中，`stdio` 参数控制子进程如何处理这三个流：

```javascript
spawn(command, args, {
  stdio: [stdin_mode, stdout_mode, stderr_mode]
})
```

#### 可用模式

| 模式 | 说明 | 使用场景 |
|------|------|---------|
| `'pipe'` | 创建父子进程间的管道 | 需要读取子进程输出 |
| `'inherit'` | 子进程继承父进程的流 | 子进程输出直接显示在终端 |
| `'ignore'` | 忽略该流（重定向到 /dev/null） | 不需要该流的数据 |
| `'ipc'` | 创建 IPC 通道 | 父子进程需要通信 |
| Stream 对象 | 使用自定义流 | 高级场景 |

### 3. 为什么 `'inherit'` 在 Web 框架中会失败？

#### 场景 A：独立 HTTP 服务器（正常工作）

```
Terminal (TTY)
    ↓
  stdin (打开状态，连接到终端)
    ↓
Node.js 进程 (server.js)
    ↓
  spawn(..., { stdio: ['inherit', ...] })
    ↓
子进程 (claude.exe) ✅ 成功继承 stdin
```

**特点：**
- 直接在终端运行：`node server.js`
- `process.stdin.isTTY === true`
- `process.stdin.readable === true`
- stdin 处于打开状态，可以被继承

#### 场景 B：Web 框架/后台服务（失败）

```
后台服务（无终端）
    ↓
  stdin (关闭或重定向到 /dev/null)
    ↓
Node.js 进程 (Fastify 服务)
    ↓
  spawn(..., { stdio: ['inherit', ...] })
    ↓
子进程 (claude.exe) ❌ 尝试继承已关闭的 stdin → 卡住
```

**特点：**
- 通过 pm2/systemd/docker 启动
- `process.stdin.isTTY === false`
- `process.stdin.readable === false` 或 `closed === true`
- stdin 不可用，子进程等待一个永远不会到来的流

### 4. 验证 stdin 状态

可以通过以下代码检查当前进程的 stdin 状态：

```javascript
console.log('stdin 状态检查：');
console.log('  isTTY:', process.stdin.isTTY);
console.log('  readable:', process.stdin.readable);
console.log('  closed:', process.stdin.closed);
console.log('  destroyed:', process.stdin.destroyed);
```

**不同环境的输出：**

| 运行方式 | isTTY | readable | closed | 结果 |
|---------|-------|----------|--------|------|
| `node app.js` | true | true | false | ✅ inherit 可用 |
| `node app.js < /dev/null` | false | false | true | ❌ inherit 失败 |
| `pm2 start app.js` | false | false | true | ❌ inherit 失败 |
| Docker 容器 | false | false | true | ❌ inherit 失败 |
| systemd 服务 | false | false | true | ❌ inherit 失败 |

---

## 解决方案

### 修复 1：将 stdin 改为 `'ignore'`

```javascript
const child = spawn(claudePath, args, {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],  // ✅ 修复
  env: {
    ...process.env,  // 继承系统环境变量
    API_TIMEOUT_MS: config.API_TIMEOUT_MS,
    ANTHROPIC_BASE_URL: `http://${config.HOST}:${config.PORT}/`,
    ANTHROPIC_AUTH_TOKEN: config.APIKEY,
    MCP_STREAMING_ID: streamingId,
    CLAUDE_CODE_ENABLE_TELEMETRY: '0',
  },
});
```

**为什么这样修复？**

1. **`claude.exe` 不需要 stdin 输入**
   - 所有参数通过命令行传递
   - 不需要交互式输入
   - 忽略 stdin 不影响功能

2. **`'ignore'` 更安全**
   - 不依赖父进程的 stdin 状态
   - 在任何环境下都能正常工作
   - 避免资源泄漏

### 修复 2：继承系统环境变量

```javascript
env: {
  ...process.env,  // ✅ 重要：继承 PATH 等系统变量
  // 自定义变量
}
```

**为什么需要继承 `process.env`？**

- 子进程需要 `PATH` 来查找可执行文件
- 可能需要其他系统变量（如 `TEMP`, `HOME` 等）
- 不继承会导致子进程找不到依赖

---

## 最佳实践

### 1. Web 服务中创建子进程的标准配置

```javascript
const child = spawn(command, args, {
  // 工作目录
  cwd: workingDirectory,
  
  // stdio 配置
  stdio: [
    'ignore',  // stdin: 子进程不需要输入
    'pipe',    // stdout: 父进程需要读取输出
    'pipe'     // stderr: 父进程需要读取错误
  ],
  
  // 环境变量
  env: {
    ...process.env,  // 继承系统环境
    // 添加自定义变量
    CUSTOM_VAR: 'value',
  },
  
  // 其他选项
  detached: false,  // 不分离，随父进程退出
  windowsHide: true,  // Windows 下隐藏窗口
});

// 错误处理
child.on('error', (error) => {
  console.error('进程启动失败:', error);
});

// 监听输出
child.stdout.on('data', (data) => {
  console.log('stdout:', data.toString());
});

child.stderr.on('data', (data) => {
  console.error('stderr:', data.toString());
});

// 监听退出
child.on('close', (code, signal) => {
  console.log('进程退出:', { code, signal });
});
```

### 2. 不同场景的 stdio 配置

#### 场景 1：需要读取子进程输出（最常见）

```javascript
stdio: ['ignore', 'pipe', 'pipe']

child.stdout.on('data', (data) => {
  // 处理输出
});
```

#### 场景 2：子进程输出直接显示在终端（调试）

```javascript
stdio: ['ignore', 'inherit', 'inherit']

// 输出会直接显示在终端，无需监听
```

#### 场景 3：完全忽略子进程输出

```javascript
stdio: ['ignore', 'ignore', 'ignore']

// 所有输出都被丢弃
```

#### 场景 4：需要向子进程发送数据

```javascript
stdio: ['pipe', 'pipe', 'pipe']

child.stdin.write('input data\n');
child.stdin.end();
```

### 3. 环境变量管理

```javascript
// ❌ 错误：只设置自定义变量
env: {
  CUSTOM_VAR: 'value'
}

// ✅ 正确：继承 + 自定义
env: {
  ...process.env,
  CUSTOM_VAR: 'value'
}

// ✅ 更好：选择性继承
env: {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TEMP: process.env.TEMP,
  CUSTOM_VAR: 'value'
}
```

---

## 调试技巧

### 1. 检查进程是否启动

```javascript
const child = spawn(command, args, options);

// 立即检查
console.log('子进程 PID:', child.pid);  // undefined 表示启动失败

// 监听错误
child.on('error', (error) => {
  console.error('启动失败:', error.message);
  console.error('错误代码:', error.code);  // ENOENT, EACCES 等
});

// 设置超时检测
const timeout = setTimeout(() => {
  if (!child.pid) {
    console.error('子进程启动超时');
  }
}, 5000);

child.on('spawn', () => {
  clearTimeout(timeout);
  console.log('子进程启动成功');
});
```

### 2. 记录完整的启动信息

```javascript
console.log('启动子进程:', {
  command,
  args,
  cwd,
  env: Object.keys(env),  // 只记录键名，避免泄露敏感信息
  stdio,
});

console.log('完整命令:', `${command} ${args.join(' ')}`);
```

### 3. 测试命令是否可执行

```javascript
const { execSync } = require('child_process');

try {
  // 测试命令是否存在
  execSync(`${command} --version`, { stdio: 'pipe' });
  console.log('命令可执行');
} catch (error) {
  console.error('命令不可执行:', error.message);
}
```

---

## 常见错误及解决方案

### 错误 1：子进程卡住，无输出

**原因：** stdin 使用了 `'inherit'` 但父进程的 stdin 不可用

**解决：** 改为 `'ignore'`

```javascript
// ❌ 错误
stdio: ['inherit', 'pipe', 'pipe']

// ✅ 正确
stdio: ['ignore', 'pipe', 'pipe']
```

### 错误 2：`ENOENT` 错误

**原因：** 找不到可执行文件

**解决：**
1. 检查命令路径是否正确
2. 确保继承了 `PATH` 环境变量
3. 使用绝对路径

```javascript
// ❌ 可能失败
spawn('claude.exe', args, { env: { CUSTOM: 'value' } })

// ✅ 继承 PATH
spawn('claude.exe', args, { env: { ...process.env, CUSTOM: 'value' } })

// ✅ 使用绝对路径
spawn('C:\\path\\to\\claude.exe', args, { env: { ...process.env } })
```

### 错误 3：子进程立即退出

**原因：** 环境变量缺失或配置错误

**解决：** 检查必需的环境变量

```javascript
const requiredEnvVars = ['PATH', 'HOME', 'TEMP'];
const missingVars = requiredEnvVars.filter(v => !env[v]);

if (missingVars.length > 0) {
  console.warn('缺少环境变量:', missingVars);
}
```

### 错误 4：无法读取子进程输出

**原因：** stdout/stderr 使用了 `'inherit'` 或 `'ignore'`

**解决：** 改为 `'pipe'`

```javascript
// ❌ 无法读取
stdio: ['ignore', 'inherit', 'inherit']

// ✅ 可以读取
stdio: ['ignore', 'pipe', 'pipe']

child.stdout.on('data', (data) => {
  console.log(data.toString());
});
```

---

## 对比总结

### server.js vs router.js

| 特性 | server.js | router.js (修复前) | router.js (修复后) |
|------|-----------|-------------------|-------------------|
| 运行环境 | 独立进程 | Fastify 服务 | Fastify 服务 |
| stdin 状态 | 打开 (TTY) | 关闭 | 关闭 |
| stdio 配置 | `['inherit', ...]` | `['inherit', ...]` ❌ | `['ignore', ...]` ✅ |
| 环境变量 | 部分继承 | 不继承 ❌ | 完整继承 ✅ |
| 子进程启动 | ✅ 成功 | ❌ 卡住 | ✅ 成功 |

---

## 参考资料

- [Node.js child_process 文档](https://nodejs.org/api/child_process.html)
- [Node.js process.stdin 文档](https://nodejs.org/api/process.html#processstdin)
- [Unix 标准流](https://en.wikipedia.org/wiki/Standard_streams)

---

## 总结

1. **在 Web 服务中创建子进程，始终使用 `stdio: ['ignore', 'pipe', 'pipe']`**
2. **始终继承 `process.env`，除非有特殊原因**
3. **添加完善的错误处理和日志记录**
4. **测试不同的运行环境（开发、生产、Docker 等）**

这些实践可以避免 99% 的子进程启动问题。
