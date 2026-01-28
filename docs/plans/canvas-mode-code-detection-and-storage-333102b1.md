<!-- 333102b1-0b8d-4bb2-b9a1-e5e0743f97ea 7a82c8e0-fca4-4898-aa9c-d3bc1de4f365 -->

# Canvas 模式代码识别与存储实现

## 目标

在 `canvasMode.js` 中实现类似 `canvas.ts` 的代码识别逻辑，将识别的代码保存到独立的 `-canvas.json` 文件，支持流式显示和对话切换恢复。

## 架构设计

### 文件结构

- 对话文件: `chat_{id}.json` (现有)
- Canvas 代码文件: `chat_{id}-canvas.json` (新增)
- Canvas 文件结构:
  ```json
  {
    "conversationId": "chat_xxx",
    "codeHistory": {
      "versions": [
        {
          "id": "version_xxx",
          "timestamp": 1234567890,
          "label": "版本标签",
          "records": [
            {
              "id": "record_xxx",
              "code": "完整代码（应用diff后的结果）",
              "diff": "LLM返回的diff内容（SEARCH/REPLACE格式）",
              "originalCode": "用户编辑的原始代码（发送请求时的editorCode）",
              "timestamp": 1234567890
            }
          ],
          "currentIndex": 0
        }
      ],
      "currentVersionIndex": 0
    },
    "updatedAt": 1234567890
  }
  ```

### 代码历史记录字段说明

- `id`: 记录的唯一标识符
- `code`: 完整代码（应用 diff 后的结果）
  - 完整代码模式: 保存完整代码，`diff` 和 `originalCode` 为空
  - Diff 模式: 初始为空，前端应用 diff 后通过 API 保存
- `diff`: LLM 返回的 diff 内容（SEARCH/REPLACE 格式）
  - 仅当 LLM 返回 diff 格式时保存
  - 前端需要确认后才能应用
- `originalCode`: 用户编辑的原始代码（editorCode）
  - 直接保存发送请求时的 `editorCode`（用户当前编辑的代码）
  - 如果用户编辑过代码，无论 LLM 返回完整代码还是 diff，都保存此字段
  - 用于记录请求时的代码状态，前端可以基于此代码应用 `diff` 或对比变化

### 数据流

#### 完整代码模式

```
流式响应 → 识别完整HTML代码 → SSE事件通知前端 → 流式写入编辑器 → 流式完成后保存到canvas文件（code字段）
```

#### Diff 模式

```
流式响应 → 识别diff格式 → SSE事件通知前端 → 显示diff编辑器 → 流式完成后保存到canvas文件（diff字段，code为空）
前端确认应用 → 应用diff生成完整代码 → 通过API保存（更新code字段，保留diff）
```

#### 用户编辑后的 Diff 模式

```
用户编辑代码 → 发送请求（携带editorCode） → LLM返回diff →
保存diff和originalCode（originalCode = editorCode，原始代码） →
前端应用diff（基于originalCode） → 通过API保存最终代码
```

## 实现步骤

### 1. 创建 Canvas 文件工具函数

**文件**: `packages/backend/src/conversations/utils/canvasFileManager.js`

- `getCanvasFilePath(conversationId)` - 获取 canvas 文件路径
- `readCanvasFile(conversationId)` - 读取 canvas 文件
- `writeCanvasFile(conversationId, data)` - 写入 canvas 文件
- `updateCanvasCodeHistory(conversationId, codeHistory)` - 更新代码历史

### 2. 创建代码识别工具

**文件**: `packages/backend/src/conversations/utils/canvasCodeParser.js`

- 复用 `streamParser.ts` 的逻辑（转换为 JS）
- `extractHtmlCodeIncremental(content)` - 增量提取 HTML 代码
- `extractDiffBlocks(content)` - 提取 diff 代码块
- `hasDiffFormat(content)` - 检测是否包含 diff 格式

### 3. 修改 canvasMode.js

**文件**: `packages/backend/src/conversations/mode/canvasMode.js`

- 在 `onStreamEvent` 回调中累积内容
- 流式过程中:
  - 增量识别 HTML 代码块，实时发送 `canvas:code_delta` 事件
  - 检测到 diff 格式的开始标记时，停止流式写入，但不发送 diff_detected 事件（等待完整代码块）
- 流式响应完成后：
  - 完整识别 diff 代码块（确保是完整的代码块）
  - 如果是完整的 diff 代码块，发送 `canvas:diff_detected` 事件（包含完整 diff 内容）
  - 如果是完整代码: 保存到 `code` 字段
  - 如果是 diff: 保存到 `diff` 字段，`code` 为空
  - 如果用户编辑过（有 editorCode）: 保存 `originalCode = editorCode`（原始代码）
- 生成记录 ID 用于前端 API 调用

### 4. 添加 SSE 事件类型

**新增事件类型**:

- `canvas:code_delta` - 代码块增量更新（包含代码片段）
- `canvas:diff_detected` - 检测到完整的 diff 代码块（仅在流式完成后确认是完整 diff 时发送，包含完整 diff 内容和记录 ID）
- `canvas:show_editor` - 通知前端显示编辑器
- `canvas:code_complete` - 代码块完成（包含记录 ID 和类型：full/diff）
- `canvas:record_created` - 记录已创建（包含记录 ID，用于前端后续 API 调用）

### 5. 修改前端事件处理

**文件**: `packages/frontend/src/views/LlmDashboard/Chat/hooks/useConversation.ts`

- 监听 `canvas:*` 事件
- 调用 `canvasPanelRef` 的方法更新代码
- 处理 `canvas:record_created` 事件，保存记录 ID 用于后续 API 调用

**文件**: `packages/frontend/src/views/LlmDashboard/Chat/ChatPanel.vue`

- 监听 diff 应用完成事件
- 调用 API 保存应用后的完整代码

### 6. 添加 Canvas 文件 API

**文件**: `packages/backend/src/conversations/router.js`

- `GET /api/ai_chat/conversations/:id/canvas` - 获取 canvas 代码历史
- `PUT /api/ai_chat/conversations/:id/canvas` - 更新整个 canvas 代码历史
- `POST /api/ai_chat/conversations/:id/canvas/records/:recordId/apply` - 应用 diff 并保存最终代码
  - 请求体: `{ code: "应用diff后的完整代码" }`
  - 响应: 更新记录中的 `code` 字段，保留 `diff` 和 `originalCode`

### 7. 前端加载 Canvas 数据

**文件**: `packages/frontend/src/views/LlmDashboard/Chat/ChatPanel.vue`

- 切换对话时加载对应的 canvas 文件
- 恢复代码历史到编辑器

## 关键技术点

### 代码识别时机

- 流式过程中:
  - 增量识别 HTML 代码块，实时发送给前端
  - 检测到 diff 格式的开始标记时，停止流式写入，等待完整响应（但不立即发送 diff_detected 事件）
- 流式完成后:
  - 完整识别 diff 代码块（确保是完整的代码块）
  - 判断是完整代码还是 diff
  - 如果是完整的 diff 代码块，发送 `canvas:diff_detected` 事件（包含完整 diff 内容）
  - 保存 `originalCode = editorCode`（如果用户编辑过，直接保存原始代码）
  - 保存到 canvas 文件，生成记录 ID

### 文件同步策略

- 流式过程中: 不频繁写入文件（性能考虑），只通过 SSE 发送给前端
- 流式完成后: 一次性保存代码历史到 canvas 文件
  - 完整代码: 保存到 `code` 字段
  - Diff 代码: 保存到 `diff` 字段，`code` 为空，等待前端确认
- 前端应用 diff 后: 通过 API 保存最终代码到 `code` 字段

### Diff 处理逻辑

1. **完整代码模式**:

   - LLM 返回完整 HTML 代码
   - 保存: `{ id, code: "完整代码", diff: null, originalCode: null }`

2. **Diff 模式（首次生成）**:

   - LLM 返回 diff 格式
   - 保存: `{ id, code: "", diff: "diff内容", originalCode: null }`
   - 前端显示 diff 编辑器，用户确认后应用

3. **Diff 模式（用户编辑后）**:
   - 用户编辑了代码，发送请求时携带 `editorCode`（用户当前编辑的代码）
   - LLM 返回 diff 格式（相对于 `editorCode` 的修改）
   - 保存 `originalCode = editorCode`（直接保存原始代码，不计算 diff）
     - 目的: 保存用户编辑的原始代码，作为应用 diff 的基础
     - 优势: 避免在代码差异很大时计算 diff 的复杂性，直接保存原始代码更可靠
   - 保存: `{ id, code: "", diff: "LLM返回的diff", originalCode: "用户编辑的原始代码" }`
   - 前端应用流程:
     1. 使用 `originalCode` 作为基础代码（用户编辑的原始代码）
     2. 在 `originalCode` 基础上应用 `diff`（LLM 返回的修改）
     3. 生成最终代码，通过 API 保存到 `code` 字段

### 对话切换处理

- 切换前: 保存当前代码历史（如果正在流式写入，先结束流式）
- 切换后: 加载新对话的 canvas 文件，恢复代码历史

## 注意事项

1. 保持与现有 `canvas.ts` 逻辑的一致性
2. 处理流式写入过程中的对话切换
3. 确保文件读写操作的原子性
4. 前端需要处理编辑器组件未挂载的情况
5. **记录 ID 管理**: 每个记录必须有唯一 ID，用于前端 API 调用
6. **Diff 应用流程**: 前端应用 diff 后必须通过 API 保存，不能只在前端保存
7. **originalCode 保存**:
   - 需要在发送请求时保存 `editorCode`（用户当前编辑的代码）
   - 直接保存 `originalCode = editorCode`（原始代码），不计算 diff
   - 如果用户没有编辑（`editorCode` 为空或与上一个版本相同），则 `originalCode` 为空
   - 优势: 避免在代码差异很大时计算 diff 的复杂性，直接保存原始代码更简单可靠
8. **版本管理**: 每个对话执行结束后添加一个历史记录，包含完整的版本信息

### To-dos

- [ ] 创建 canvasFileManager.js 工具函数，实现 canvas 文件的读写操作
- [ ] 创建 canvasCodeParser.js，将 streamParser.ts 的逻辑转换为 JS，实现代码识别功能
- [ ] 修改 canvasMode.js:
  - [ ] 在 onStreamEvent 中识别代码块和 diff，通过 SSE 发送事件
  - [ ] 流式完成后判断是完整代码还是 diff
  - [ ] 保存 originalCode = editorCode（如果用户编辑过，直接保存原始代码）
  - [ ] 保存代码历史到 canvas 文件，生成记录 ID
- [ ] 在 router.js 中添加 canvas 相关的 SSE 事件类型支持
- [ ] 在 router.js 中添加 Canvas API 端点:
  - [ ] GET /api/ai_chat/conversations/:id/canvas
  - [ ] PUT /api/ai_chat/conversations/:id/canvas
  - [ ] POST /api/ai_chat/conversations/:id/canvas/records/:recordId/apply
- [ ] 更新前端类型定义（types.ts），添加新的代码历史结构
- [ ] 修改前端 useConversation.ts，监听 canvas 事件并更新编辑器
- [ ] 修改 ChatPanel.vue:
  - [ ] 在切换对话时加载 canvas 文件并恢复代码历史
  - [ ] 监听 diff 应用完成事件，调用 API 保存最终代码
- [ ] 修改 ImmersiveCode 组件，支持通过 API 保存应用后的代码
