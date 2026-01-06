# LLM 接口中断请求支持技术报告

## 1. 问题分析：为什么原 LLM 接口不支持中断？

在对 `@musistudio/llms`（位于 `links/llm`）的源码分析中发现，该库在设计上虽然考虑了超时（Timeout），但并未将**客户端连接的生命周期**与**上游服务商（Upstream Provider）的请求生命周期**挂钩。

### 核心原因：

1.  **信号未透传**：在 `links/llm/src/api/routes.ts` 的 `handleTransformerEndpoint` 函数中，虽然接收到了 Fastify 的 `req` 对象，但并没有将 `req.raw.signal`（客户端的中断信号）传递给后续执行的 `sendRequestToProvider`。
2.  **统一请求封装未合并信号**：在 `links/llm/src/utils/request.ts` 的 `sendUnifiedRequest` 中，系统内部通过 `AbortSignal.timeout` 创建了一个超时信号，但它代码逻辑上忽略了外部传入自定义 `AbortSignal` 的可能性，导致即使客户端断开连接，服务器依然会继续等待直到超时或响应完成。
3.  **库代码限制**：用户明确要求**不能修改库代码**，而上述两个关键点恰恰都在库的核心逻辑中。

---

## 2. 解决方案：非侵入式 Hook 与 Fetch 劫持

为了在不修改 `links/llm` 源码的前提下解决问题，我们采用了 **Node.js 异步上下文（AsyncLocalStorage）** 配合 **全局 Fetch 劫持** 的方案。

### 技术实现方案：

#### 1. 异步上下文存储 (AsyncLocalStorage)

利用 `node:async_hooks` 中的 `AsyncLocalStorage`，我们可以在一个请求的整个处理链条中共享数据。

- **操作**：在 Fastify 层面添加一个 `onRequest` 钩子，将当前请求的 `req.raw.signal` 存入异步存储空间。

#### 2. 全局 Fetch 劫持 (Fetch Hijacking)

`links/llm` 库内部使用 `fetch`（或 `undici` 的实现）发出 HTTP 请求。通过劫持全局 `fetch` 函数，我们可以在请求发出的最后一刻植入逻辑。

- **逻辑**：
  1.  从 `AsyncLocalStorage` 中取出当前活跃请求的 `AbortSignal`（即客户端信号）。
  2.  如果发现 `fetch` 调用本身也带了信号（如库内部的超时信号），则使用 `AbortSignal.any()`（Node.js 20+）或手动封装一个 `AbortController` 将两个信号合并。
  3.  这样，无论是**超时时间到**还是**客户端主动断开**，底层的 `fetch` 都会立即中止，从而节省服务器资源并响应前端的操作。

#### 3. 结果验证

我们开发了一个测试页面 `packages/backend/public/test_interrupt.html`。该页面通过 `fetch` 的 `AbortController` 模拟前端中断。

- **验证点**：当点击“中断请求”时，前端 `fetch` 停止，由于我们的劫持逻辑，后端此时也会收到中断信号并立即停止与 OpenAI/Anthropic 等供应商的通信。

---

## 3. 文件变更汇总

- **`packages/backend/src/index_llm.js`**:
  - 新增了 `AsyncLocalStorage` 逻辑。
  - 注入了全局 `fetch` 劫持代码。
  - 添加了 Fastify `onRequest` 钩子。
- **`packages/backend/public/test_interrupt.html`**:
  - 新建的对话测试页面，支持流式输出和一键中断。

---

## 4. 总结

通过这种“侧切面”注入的方式，我们成功在不改变原有 `@musistudio/llms` 稳定代码的基础上，实现了全链路的请求中断透传。这种方案具有极高的兼容性，能够在任何基于 Node.js 原生 API 调用的场景下生效。
