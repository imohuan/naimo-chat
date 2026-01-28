<!-- 285033da-115d-448b-a10e-f393a7d4b0f7 447d9bf4-811c-4b69-a173-904cc6468e9a -->

# ChatPanel 对话错误提示与 Tag 字符串解析方案

### 目标

- **错误提示**：当 CanvasPanel 触发错误事件时，在左侧对话中追加一条“错误提示消息”；点击该提示，可将对应错误内容以 Tag 形式插入输入框（最终以纯字符串发送）。
- **Tag 重构**：简化浏览器选择/代码引用等 Tag 的结构，统一通过字符串格式（`@index.html(22,22)`、`<error_message>…</error_message>` 等）在消息 content 中表达，并支持双向解析（字符串 ↔ Tag 节点）。
- **解析控制**：支持“普通输入/粘贴”时自动解析为 Tag，“Ctrl+Shift+V 粘贴原始数据”时不解析，保证内容按纯文本保留。

### 拟议实现步骤

1. **设计统一的 Tag 字符串协议与解析工具**

- 在 `Chat` 相关目录中新建一个轻量工具模块，例如 `stringTags.ts`：
- 定义几种逻辑类型：`"code_ref"`（代码引用），`"error_message"`（错误消息），`"browser_selector"`（浏览器选中元素）。
- 约定字符串格式：
- 代码引用：`@index.html(22)` 或 `@index.html(22,30)`。
- 错误消息：`<error_message>这里是错误文本</error_message>`。
- 浏览器选择：`<browser_selector>div .title</browser_selector>` 或类似命名。
- 提供函数：
- `parseStringToLogicalTags(text: string): ParsedSegment[]`：扫描整段文本，按顺序返回“纯文本片段 + 逻辑 Tag 片段”的数组。
- `serializeLogicalTagToString(tag: LogicalTag): string`：将逻辑 Tag 再转回字符串（用于发送到后端 / 存储）。
- 该模块只关心**字符串协议**和逻辑数据结构，不直接依赖 ProseMirror 或 Vue 组件。

2. **重构 PromptInput 编辑器与 Tag 节点映射**

- 在 `PromptInputEditor`（和 `prosemirrorSetup.ts`）中，引入上一步的解析函数，实现：
- **字符串 → 编辑器内容**：
- 在 `createDocFromText` 或初始化/外部 setText 时：
- 调用 `parseStringToLogicalTags`，将逻辑 Tag 片段转为 `tag` 节点，其余保持为普通文本节点/换行。
- `tag` 节点的 attrs 简化为：`{ id, label, icon?, tagType, data?: { type: 'code_ref' | 'error_message' | 'browser_selector', raw: string, ...extra } }`，去掉浏览器选择中不必要的大量字段（如 classList、styles 等，只保留 selector 及必要展示文案）。
- **编辑器内容 → 字符串**：
- 在 `getEditorTextContent` 或等价导出方法中：
- 遍历文档节点：普通文本按原样拼接，Tag 节点通过 `serializeLogicalTagToString` 转回协议字符串，保证往返一致。
- `ChatPanel.vue` 中现有的 `handleElementSelected` / `handleCtrlIPressed` 将不再关心复杂 data 结构，只需：
- 构造逻辑 Tag 对象（如 `{ type: 'browser_selector', selector, label }` 或 `{ type: 'code_ref', fileName, startLine, endLine }`）。
- 调用一个帮助函数 `insertLogicalTagToEditor(logicalTag)`，在内部：
- 使用 `serializeLogicalTagToString` 得到字符串片段。
- 调用 `editorRef.insertTag` 创建 `tag` 节点，`attrs.data.raw` 为该字符串，以便后续序列化使用。

3. **在 Canvas 错误时向左侧对话追加“错误提示消息”**

- 在 `ChatPanel.vue` 中监听 CanvasPanel 的 `@error`（当前仅 toast）：
- 在 handler 中：
- 生成一个逻辑错误 Tag 的字符串：`const tagStr = serializeLogicalTagToString({ type: 'error_message', message })`。
- 构造一条新的“系统/助手错误提示消息”（可视需求选择 `from: 'assistant'` 或新增类型，当前结构建议用 `assistant`）：
- `content` 可以是可读提示，如：`Canvas 出错: ${message}` 或更具体说明。
- 在 message 中额外存储 `errorTagString: tagStr` 或放到 `tools`、`reasoning` 等扩展字段（需要在 `MessageType`/`MessageVersion` 中加一个可选字段，例如 `meta?: { errorTag?: string }`）。
- 通过 `conversationStore` 的更新方法（如 `updateConversationMessage` 或新增 `addSystemMessage`）将该错误提示插入当前对话。
- 在 `ChatMessages.vue` 中，为带有 `errorTagString` / meta 的消息增加一个小的“附加到输入框”按钮：
- 点击时通过事件往上抛 `append-error-tag`，包含该 tag 字符串。
- 在 `ChatPanel.vue` 中监听这个新事件，调用 `insertLogicalTagToEditor` 将错误 Tag 插入到输入框（行为和代码引用 Tag 一致）。

4. **自动解析字符串为 Tag 与 Ctrl+Shift+V 原样粘贴的区分**

- 在 `PromptInputEditor` 中统一字符串解析开关：
- 增加一个内部状态 `shouldParseTagsOnNextInput = true`。
- 默认情况下（普通输入 / 粘贴），保持 `true`：调用 `createDocFromText` / setText 时会自动把协议字符串转为 Tag 节点。
- **捕获粘贴事件**：
- 在编辑器初始化后（`initEditor` 内），对 `editorView.dom` 监听 `paste` 事件：
- 如果检测到 `event.shiftKey`（即用户使用了 Ctrl+Shift+V 或 Shift+Insert 等组合）：
- 阻止默认行为，自行从剪贴板读取纯文本。
- 设置 `shouldParseTagsOnNextInput = false`，调用一个“插入纯文本内容”的 helper（绕过 `parseStringToLogicalTags`），这样 `<error_message>…</error_message>` 等标记会被当成普通文本插入。
- 若无 shift，保持现有行为（允许解析）：`shouldParseTagsOnNextInput = true`，走正常的 `createDocFromText` 流程。
- 在 `setTextInput` / `createDocFromText` 路径中：
- 根据 `shouldParseTagsOnNextInput` 决定是否调用 `parseStringToLogicalTags`：
- `true` → 正常解析，生成 Tag 节点。
- `false` → 直接生成纯文本/换行节点，不创建 Tag，并在一次性使用后重置为 `true`（避免影响后续正常输入解析）。
- 如此即可实现：
- 用户平时输入/普通粘贴时：字符串自动被解析成 Tag。
- 用户希望保留原始协议字符串（如调试、复制外部带标记文本）：使用 Ctrl+Shift+V 即可禁止本次解析。

5. **重构浏览器选择 Tag 结构**

- 在 `ChatPanel.vue` 的 `handleElementSelected` 中将 Tag attrs 简化：
- 由原来携带大量 DOM 信息（`id/classList/styles/attributes/...`）改为：
- `label`: 优先用 `data?.tagName || 'Element'`。
- `tagType`: `'browser'`。
- `data`: `{ type: 'browser_selector', selector, raw: serializeLogicalTagToString(...), tagName?: data?.tagName }`。
- `handleTagClick` 中对浏览器 Tag 的判定改为基于 `data.type === 'browser_selector'` 或 `tagType === 'browser'`，减少对 `icon` 字符串内容的硬编码检测。

6. **测试与兼容性校验**

- 手动验证以下场景：
- 代码引用：按 Ctrl+I 生成 `@index.html(10,20)`，在输入框中显示为 Tag；发送后 content 中仍为字符串格式；点击 Tag 能在 Canvas 里跳转到正确行。
- 浏览器选择：从 Canvas 选中元素插入浏览器 Tag，发送后服务器只看到带 `<browser_selector>…</browser_selector>` 的字符串；从历史消息中重新加载时自动渲染为 Tag 并支持点击预览。
- 错误提示：Canvas 报错 → 左侧出现错误提示消息 → 点击“附加到输入框”按钮 → 输入框出现一个错误 Tag，最终以 `<error_message>…</error_message>` 字符串发送。
- 粘贴行为：
- 普通 Ctrl+V：带协议字符串的文本自动渲染为 Tag。
- Ctrl+Shift+V：完全不解析，字符串按原样显示，随后普通键入仍会按规则解析。

### 关键文件

- `packages/frontend/src/views/LlmDashboard/Chat/ChatPanel.vue`
- `packages/frontend/src/views/LlmDashboard/Chat/components/ChatMessages.vue`
- `packages/frontend/src/views/LlmDashboard/Chat/types.ts`
- `packages/frontend/src/components/prompt-input/PromptInputEditor.vue`
- `packages/frontend/src/components/prompt-input/editor/prosemirrorSetup.ts`
- 新增：`packages/frontend/src/views/LlmDashboard/Chat/stringTags.ts`（或等价工具文件）

7. **输入指令 `/` 与长文本粘贴行为规范**

- **长文本粘贴 → 自动转 Tag**

  - 在 `PromptInputEditor` 中，拦截粘贴事件：
    - 若剪贴板中包含文件：保持现有逻辑，作为附件处理。
    - 若仅包含纯文本：
      - 当文本长度 **> 100 字符** 时，不直接插入为纯文本，而是：
        - 使用统一 Tag 协议构造一个逻辑标签（如 `{ type: 'long_text', text, preview: text.slice(0, 30) }`）。
        - 通过统一入口 `insertLogicalTagToEditor` 或直接调用 `editorRef.insertTag` 插入一个 `tag` 节点：
          - `label`: 文本前 30 字符 + 省略号（如 `text.slice(0, 30) + '…'`）。
          - `tagType`: `"text"`（或 `"long_text"`，用于样式区分）。
          - `data`: `{ type: 'long_text', text }`，其中 `text` 保留完整原文。
      - 长文本 Tag 在最终发送时，可以按协议序列化为例如：`<long_text>原文……</long_text>`，或直接内联在 `data.raw` 中，具体可在实现阶段细化。

- **`/` 指令输入 → 下拉选择与自动 Tag 化**

  - 目标行为：
    - 当用户在输入框中键入 `/` 时，弹出一个 **指令下拉框**（使用现有 `PromptInputCommand` 相关 UI 组件）。
    - 选择某一条指令或继续输入 `/xxxx` 形式的内容后，在合适时机自动转换为一个 Tag。
  - 推荐实现思路（前端编辑器层）：
    - 在 `PromptInputEditor` 的 `keydown` 逻辑中，对 `/` 开头的 token 做特殊处理：
      - 监听按键，当按下空格或 Enter 时：
        - 回溯光标前一段文本，匹配形如 `/xxxx` 或单独 `/` 的 token。
        - 若命中：
          - 单独 `/`：**允许用户通过某个快捷键/按钮“手动转为标签”**（详见下节约束）。
          - `/xxxx`：直接将该 token 删除，替换为一个 `tag` 节点：
            - `label`: 去掉 `/` 后的部分，如 `"xxxx"`。
            - `tagType`: `"command"`。
            - `data`: `{ type: 'slash_command', text: '/xxxx' }`。
    - `/` 弹出下拉可以在外层（如 `ChatInput`）结合 `PromptInputCommand`、`PromptInputCommandList` 等 UI 组件实现，监听输入中的 `/` 触发命令面板，选择后将对应 `/xxxx` 文本插入，再由上面的规则转 Tag。

- **`/` 仅此一个可手动转 Tag，其它标签只能通过粘贴/插入生成**

  - 行为约束：
    - **仅** 当输入内容是**单独一个 `/`**（或者 `/` 后只含空白）时，提供“转为标签”的显式交互（例如点击某个按钮/菜单项）。
    - 其他 Tag（如代码引用、浏览器选择、长文本等）必须通过：
      - 粘贴（长文本自动 Tag）。
      - 插入动作（如 `handleCtrlIPressed`、`handleElementSelected` 等调用 `insertTag`）。
    - 不支持通过任意普通文本选中后“一键转 Tag”，以减少隐式解析带来的混淆。
  - 实现建议：
    - 在 `PromptInputEditor` 的指令处理逻辑中：
      - 对检测到的 `/` token：
        - 若为单独 `/`，不自动转 Tag，仅记录一个可供 UI 使用的状态（例如 `slashPending = true`），由外层提供“转为标签”的按钮/菜单，点击后调用 `insertTag`。
        - 若为 `/xxxx`，直接自动转 Tag（如上一节），不再要求手动确认。

- **标签 Hover 悬浮框展示详情**
  - Tag 悬浮需求：
    - 所有 Tag（代码引用、浏览器元素、错误消息、长文本、指令等）在 hover 时，展示一个悬浮卡片展示其详细内容。
  - 推荐实现方式：
    - 在渲染 Tag 时（`TagNodeView` 或 `PromptInputEditor`）：
      - 将 Tag 视图包裹在 `PromptInputHoverCard` + `PromptInputHoverCardTrigger` 中，或在外层 `ChatMessages`/`ChatInput` 渲染消息 Tag 时统一包裹：
        - `Trigger`: Tag 本身。
        - `Content`: 根据 `tagType` / `data.type` 渲染详细内容：
          - 代码引用：显示文件名 + 行号范围 + 预览片段（若可用）。
          - 浏览器元素：显示 selector / tagName / 部分属性。
          - 错误消息：完整错误文本。
          - 长文本：完整原文（可考虑限制高度 + 滚动）。
          - 指令：指令说明、示例等。
    - 悬浮卡片只读，不修改 Tag 本身；点击 Tag 仍按照原有行为触发代码跳转 / 预览等操作。

### To-dos

- [ ] 设计并实现统一的字符串 Tag 协议与解析/序列化工具（代码引用、错误消息、浏览器选择）
- [ ] 在 PromptInput 编辑器中接入字符串 Tag 解析和序列化逻辑，实现字符串与 Tag 节点互转
- [ ] 在 CanvasPanel 报错时，在对话中插入可点错误提示消息并向上抛出“附加到输入框”的事件
- [ ] 重构 ChatPanel 中浏览器选择与代码引用的 Tag 插入逻辑，使用统一的逻辑 Tag 与 insert helper
- [ ] 在 PromptInput 编辑器中增加 Ctrl+Shift+V 原样粘贴（不解析 Tag）逻辑
- [ ] 手动验证代码引用、浏览器选择、错误提示和各种粘贴方式在输入框/对话中的表现是否符合预期
