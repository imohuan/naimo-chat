# 流保存功能实现总结

## 概述
为 ChatPage.vue 添加了完整的流事件保存功能，参考 `packages/backend/public/chat.html` 的实现。

## 实现的功能

### 1. 流事件收集
- 在 `useStreamHandler.ts` 中添加了对所有 SSE 事件的收集
- 每个接收到的事件都会被保存到 `state.allEvents` 数组中
- 在流开始时重置事件列表

### 2. 状态管理
在 `useChatState.ts` 中添加了以下状态：
- `conversationEnded`: 标记对话是否结束
- `showSaveModal`: 控制保存模态框的显示
- `saveEventName`: 保存事件的名称
- `isSaving`: 保存过程中的加载状态
- `allEvents`: 存储所有流事件的数组

### 3. UI 组件更新

#### MessageRenderer.vue
- 已有 `actions` slot，位于时间戳右侧
- 用于显示额外的操作按钮

#### ChatPage.vue
- 在最后一条消息的 `actions` slot 中添加保存按钮
- 仅在对话结束且有事件时显示（`showSaveButton && index === groupedMessages.length - 1`）
- 添加了保存模态框 UI
- 实现了以下方法：
  - `openSaveModal()`: 打开保存模态框
  - `closeSaveModal()`: 关闭保存模态框
  - `saveEvents()`: 调用 API 保存事件
- 添加了 `.save-icon-btn` 样式

### 4. 服务层
`chat.service.ts` 已经包含了 `saveEvents` 方法，用于发送保存请求到后端。

## 工作流程

1. **流开始**：
   - 用户发送消息
   - `startStream` 被调用
   - `state.allEvents` 被重置为空数组
   - `state.conversationEnded` 设置为 false

2. **流进行中**：
   - 每个 SSE 事件被接收
   - 事件被推送到 `state.allEvents`
   - 事件被处理并显示在 UI 中

3. **流结束**：
   - 接收到 `process_end` 或 `aborted` 事件
   - `state.conversationEnded` 设置为 true
   - 保存按钮在最后一条消息的时间戳右侧显示

4. **保存事件**：
   - 用户点击保存按钮（磁盘图标）
   - 模态框打开，要求输入事件名称
   - 用户输入名称并确认
   - 调用 `chatService.saveEvents(name, state.allEvents)`
   - 保存成功后：
     - 关闭模态框
     - 重新加载事件列表
     - 自动选中刚保存的事件

## 关键代码位置

### useStreamHandler.ts
```typescript
// 在 startStream 中重置事件
if (state) {
  state.allEvents = [];
  state.conversationEnded = false;
}

// 在 onmessage 中保存事件
if (state) {
  state.allEvents.push(data);
}

// 在 handleEnd 中标记结束
if (state) {
  state.conversationEnded = true;
}
```

### ChatPage.vue - 保存按钮位置
```vue
<template v-if="groupedMessages.length > 0">
  <div v-for="(group, index) in groupedMessages" :key="group.id" class="mb-4">
    <MessageRenderer :group="group" :is-subagent="false" :is-collapsed="isCollapsed"
      :is-loading="isStreaming && index === groupedMessages.length - 1 && group.role === 'assistant'"
      @toggle-collapse="(item) => toggleToolCollapse(item.id)" 
      @approve-permission="approvePermission"
      @deny-permission="denyPermission" 
      @open-subagent="openSubagent">
      <!-- 保存按钮：仅在最后一条消息且对话结束时显示 -->
      <template #actions v-if="showSaveButton && index === groupedMessages.length - 1">
        <button @click="openSaveModal"
          class="save-icon-btn text-slate-400 hover:text-blue-600 transition-colors" 
          title="保存对话事件">
          <i class="fa-solid fa-floppy-disk text-xs"></i>
        </button>
      </template>
    </MessageRenderer>
  </div>
</template>
```

### ChatPage.vue - 保存方法
```typescript
const saveEvents = async () => {
  const name = state.saveEventName.trim();
  if (!name) return;

  state.isSaving = true;
  try {
    await chatService.saveEvents(name, state.allEvents);
    state.status = `✓ 事件已保存: ${name}`;
    closeSaveModal();
    await loadEventsList();
    state.selectedEvent = name;
    setTimeout(() => {
      state.status = '';
    }, 2000);
  } catch (e: any) {
    console.error('保存失败:', e);
    state.status = `✗ 保存失败: ${e.message}`;
    alert(`保存失败: ${e.message}`);
  } finally {
    state.isSaving = false;
  }
};
```

## 与 chat.html 的对应关系

| chat.html | ChatPage.vue |
|-----------|--------------|
| `state.allEvents` | `state.allEvents` |
| `state.conversationEnded` | `state.conversationEnded` |
| `state.showSaveModal` | `state.showSaveModal` |
| `saveEvents()` | `saveEvents()` |
| `openSaveModal()` | `openSaveModal()` |
| `closeSaveModal()` | `closeSaveModal()` |
| `<template #actions>` 在消息中 | `<template #actions>` 在 MessageRenderer 中 |

## UI 位置

保存按钮显示在：
- **最后一条消息**的时间戳右侧
- 仅在**对话结束**（`conversationEnded = true`）时显示
- 仅在**有事件数据**（`allEvents.length > 0`）时显示

示例：
```
[助手消息内容...]
15:23 💾  ← 保存按钮在这里
```

## 测试建议

1. 发送一条消息并等待完整响应
2. 验证保存按钮（磁盘图标）在最后一条消息的时间戳右侧出现
3. 点击按钮，输入事件名称
4. 确认保存成功
5. 在测试场景下拉框中验证新事件出现
6. 选择保存的事件并运行测试，验证事件可以正确重放

## 注意事项

- 保存按钮只在最后一条消息中显示
- 只有在对话结束（`conversationEnded = true`）且有事件（`allEvents.length > 0`）时，按钮才会显示
- 保存的事件包含完整的 SSE 流数据，可用于后续的测试场景重放
- 事件名称不能为空
- 保存成功后会自动刷新事件列表并选中新保存的事件
- 按钮样式与 chat.html 保持一致，hover 时有蓝色背景高亮效果
