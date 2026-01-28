# Chat 模块

本模块是从 `packages/backend/public/chat.html` 拆分而来的 Vue 3 + TypeScript 实现。

## 目录结构

```
chat/
├── components/          # 组件
│   ├── ChatSidebar.vue     # 侧边栏（对话历史）
│   ├── ChatHeader.vue      # 顶部导航栏
│   ├── ChatInput.vue       # 输入区域
│   └── MessageRenderer.vue # 消息渲染组件
├── composables/         # 组合式函数
│   ├── useChatState.ts     # 聊天状态管理
│   ├── useChatMessages.ts  # 消息管理
│   └── useStreamHandler.ts # SSE 流处理
├── services/            # 服务层
│   └── chat.service.ts     # API 调用服务
├── pages/               # 页面
│   └── ChatPage.vue        # 主聊天页面
└── index.ts             # 模块导出
```

## 组件说明

### ChatPage.vue
主聊天页面，整合所有子组件和业务逻辑。

### ChatSidebar.vue
侧边栏组件，显示对话历史列表，支持：
- 新建对话
- 加载历史对话
- 删除会话

### ChatHeader.vue
顶部导航栏，包含：
- 测试场景选择器
- Session ID 显示
- 自动刷新控制
- 全部折叠/展开
- 清空对话

### ChatInput.vue
输入区域组件，支持：
- 文本输入
- 图片上传
- 工作目录选择
- 发送/中断按钮

### MessageRenderer.vue
消息渲染组件，支持：
- 用户消息
- AI 消息
- 工具调用卡片
- 权限请求
- TODO 列表

## Composables 说明

### useChatState
管理聊天应用的全局状态，包括：
- 消息输入状态
- 会话状态
- UI 状态（下拉框、模态框等）
- 自动刷新状态

### useChatMessages
管理聊天消息列表，提供：
- 消息分组逻辑
- 消息添加/清空
- 折叠状态管理

### useStreamHandler
处理 SSE 流事件，支持：
- 建立/关闭 SSE 连接
- 解析各种事件类型
- 更新消息内容

## Services 说明

### chat.service.ts
封装所有 API 调用，包括：
- 启动/中断会话
- 权限审批
- 事件管理
- 项目/会话管理

## 技术栈

- Vue 3 Composition API
- TypeScript
- Tailwind CSS v4
- marked (Markdown 解析)
- EventSource (SSE)

## 与原 HTML 的对应关系

| 原 HTML 部分 | Vue 组件/文件 |
|-------------|--------------|
| 侧边栏 HTML | ChatSidebar.vue |
| 顶部导航 HTML | ChatHeader.vue |
| 输入区域 HTML | ChatInput.vue |
| 消息渲染模板 | MessageRenderer.vue |
| Vue setup() 状态 | useChatState.ts |
| 消息管理逻辑 | useChatMessages.ts |
| SSE 流处理 | useStreamHandler.ts |
| API 调用 | chat.service.ts |
| 主应用逻辑 | ChatPage.vue |

## 使用方式

```typescript
import { ChatPage } from '@/modules/chat';

// 在路由中使用
{
  path: '/',
  component: ChatPage
}
```
