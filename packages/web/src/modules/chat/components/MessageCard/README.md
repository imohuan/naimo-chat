# MessageCard 组件

这个文件夹包含了从 `MessageRenderer.vue` 中拆分出来的各种消息卡片组件。

## 组件列表

### TextCard.vue
显示文本消息内容。

**功能：**
- 使用 `marked` 库将 Markdown 格式的 `rawText` 转换为 HTML
- 如果已有 `html` 属性，则直接使用
- 包含代码块和内联代码的样式

**Props：**
- `item: ChatMessage` - 聊天消息对象

### ToolCard.vue
显示工具调用卡片。

**功能：**
- 显示工具名称、输入参数和执行结果
- 支持折叠/展开
- 显示错误状态
- 特殊处理 Bash 命令和文件路径
- 支持 diff 显示

**Props：**
- `item: ChatMessage` - 聊天消息对象
- `isCollapsed: boolean` - 是否折叠
- `isSubagent?: boolean` - 是否为子代理

**Events：**
- `toggle-collapse` - 切换折叠状态

### PermissionCard.vue
显示权限请求卡片。

**功能：**
- 显示需要用户批准的操作
- 显示工具名称和输入参数
- 提供批准/拒绝按钮

**Props：**
- `item: ChatMessage` - 聊天消息对象

**Events：**
- `approve` - 批准权限请求
- `deny` - 拒绝权限请求

### SubagentCard.vue
显示子代理卡片。

**功能：**
- 显示子代理的描述、类型和提示
- 显示子代理消息数量
- 提供打开子代理对话的按钮
- 显示执行结果和错误状态

**Props：**
- `item: ChatMessage` - 聊天消息对象
- `isCollapsed: boolean` - 是否折叠
- `isSubagent?: boolean` - 是否为子代理

**Events：**
- `toggle-collapse` - 切换折叠状态
- `open-subagent` - 打开子代理对话

### TodoListCard.vue
显示任务列表卡片。

**功能：**
- 显示任务列表
- 显示任务状态（完成、进行中、待处理）
- 支持折叠/展开

**Props：**
- `item: ChatMessage` - 聊天消息对象
- `isCollapsed: boolean` - 是否折叠
- `isSubagent?: boolean` - 是否为子代理

**Events：**
- `toggle-collapse` - 切换折叠状态

## 使用方式

```vue
<script setup lang="ts">
import { TextCard, ToolCard, PermissionCard, SubagentCard, TodoListCard } from './MessageCard';
</script>

<template>
  <TextCard v-if="item.kind === 'text'" :item="item" />
  
  <ToolCard 
    v-else-if="item.kind === 'tool'" 
    :item="item" 
    :is-collapsed="isCollapsed(item.id)"
    @toggle-collapse="handleToggle(item)" 
  />
  
  <PermissionCard 
    v-else-if="item.kind === 'permission_request'" 
    :item="item"
    @approve="handleApprove(item)" 
    @deny="handleDeny(item)" 
  />
  
  <SubagentCard 
    v-else-if="item.kind === 'subagent'" 
    :item="item"
    :is-collapsed="isCollapsed(item.id)"
    @toggle-collapse="handleToggle(item)"
    @open-subagent="handleOpenSubagent(item)" 
  />
  
  <TodoListCard 
    v-else-if="item.kind === 'todo_list'" 
    :item="item"
    :is-collapsed="isCollapsed(item.id)"
    @toggle-collapse="handleToggle(item)" 
  />
</template>
```

## 依赖

- `marked` - 用于 Markdown 转 HTML（已安装在 package.json 中）
- `@/types` - 类型定义

## 样式

所有组件使用 Tailwind CSS 进行样式设置，并遵循项目的设计系统。
