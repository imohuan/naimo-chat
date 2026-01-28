# Chat Composables

这个目录包含聊天模块的可组合函数（Composables）。

## 已实现的 Composables

### useSmartScroll

智能滚动 Hook，提供智能滚动功能，只在用户接近底部时自动滚动。

**功能特性**:
- 智能判断是否需要自动滚动（基于距离阈值）
- 提供强制滚动到顶部/底部的方法
- 实时监听滚动位置和距离
- 响应式状态导出（isNearBottom、distanceFromBottom、distanceFromTop）
- 完整的 TypeScript 类型支持

**使用示例**:

```typescript
import { ref } from 'vue'
import { useSmartScroll } from './useSmartScroll'

const container = ref<HTMLElement>()
const { 
  smartScrollToBottom, 
  scrollToBottom, 
  scrollToTop,
  isNearBottom,
  distanceFromBottom 
} = useSmartScroll(container, {
  threshold: 100, // 距离底部 100px 内认为"接近底部"
  smooth: true    // 使用平滑滚动
})

// 添加新消息时智能滚动
const addMessage = (message) => {
  messages.value.push(message)
  smartScrollToBottom() // 只有在接近底部时才滚动
}

// 强制滚动到底部
const forceScrollToBottom = () => {
  scrollToBottom(true) // 平滑滚动
}
```

**API**:

```typescript
interface SmartScrollOptions {
  threshold?: number  // 默认 100
  smooth?: boolean    // 默认 true
}

interface SmartScrollReturn {
  smartScrollToBottom: (smooth?: boolean, threshold?: number) => void
  scrollToBottom: (smooth?: boolean) => void
  scrollToTop: (smooth?: boolean) => void
  isNearBottom: Ref<boolean>
  distanceFromBottom: Ref<number>
  distanceFromTop: Ref<number>
}
```

### useChatMessages

管理聊天消息列表。

### useChatState

管理聊天状态。

### useStreamHandler

处理 SSE 流事件。

## 开发指南

### 创建新的 Composable

1. 在此目录创建新文件，命名格式：`use[功能名].ts`
2. 使用 TypeScript 编写，提供完整的类型定义
3. 导出接口和函数
4. 添加 JSDoc 注释
5. 在此 README 中添加文档

### 最佳实践

1. **单一职责**：每个 composable 只负责一个功能领域
2. **可组合性**：composables 之间可以相互调用
3. **类型安全**：提供完整的 TypeScript 类型
4. **响应式**：返回响应式的 ref 或 computed
5. **清理资源**：在 onBeforeUnmount 中清理事件监听器等资源
6. **使用 VueUse**：优先使用 VueUse 提供的工具函数

### 测试

每个 composable 都应该有对应的测试文件：

```
useSmartScroll.ts
useSmartScroll.spec.ts
```

## 依赖

- Vue 3
- VueUse
- TypeScript
