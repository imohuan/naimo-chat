# 开发文档

> 文档入口，按需查阅

## 沟通语言

**全程使用中文进行沟通**，技术术语保留英文（如 Vue、TypeScript、Pinia）。

## 文档路由: 请查询对应的所有文档

| 任务       | 文档                              |
| ---------- | --------------------------------- |
| 新功能开发 | [项目规范](/docs/project-spec.md) |
| 遇到报错   | [问题速查](/docs/issues.md)       |
| 运行命令   | [常用命令](/docs/commands.md)     |

## 环境

- 操作系统：Windows 10
- 命令行：PowerShell（禁止使用 Linux 命令）
- 包管理器：pnpm

## 技术栈

```
Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS v4
```

## 核心目录

```
src/
├── modules/        # 业务模块（search、library、extractor）
├── components/     # 全局组件（layout、modal、feedback）
├── composables/    # 全局 Hooks
├── services/       # 业务服务层
├── stores/         # Pinia 状态
└── types/          # 类型定义
```

## 核心规范

- 路径别名：`@` → `src/`
- 类型定义：`src/types/index.ts`
- 测试并置：`xxx.test.ts` 放在 `xxx.ts` 旁边
- 组件超 200 行需拆分
- 代码注释使用中文

## 第三方库优先

**避免重复造轮子**，开发功能前先考虑是否有现成方案。

已安装的工具库：

- `@vueuse/core` - Vue 组合式工具集（优先使用）
- `lodash-es` - 实用函数库
- `mitt` - 事件发射器

开发时：

1. 先查找 VueUse 是否有对应 Hook
2. 再查找 lodash 是否有对应函数
3. 没有合适的再考虑自己实现
4. 需要新库可直接安装使用

## Tailwind CSS v4

`<style scoped>` 中使用 `@apply` 必须添加：

```vue
<style scoped>
@reference "@/style.css";
</style>
```

## 图标

使用 `@vicons/material`，大小用 `size-*`：

```vue
<SearchOutlined class="size-5 text-gray-600" />
```
