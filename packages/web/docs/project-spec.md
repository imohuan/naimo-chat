# 项目规范

## 目录结构

```
src/
├── modules/                 # 业务模块
│   └── [module]/
│       ├── components/      # 模块组件
│       ├── composables/     # 模块 Hooks
│       ├── pages/           # 路由页面
│       └── index.ts         # 模块导出
├── components/              # 全局组件
│   ├── layout/              # 布局组件
│   ├── modal/               # 弹窗组件
│   └── feedback/            # 反馈组件
├── composables/             # 全局 Hooks
├── services/                # 服务层（*.service.ts）
├── stores/                  # Pinia Store（*.store.ts）
└── types/                   # 类型定义
```

### 放置决策

```
新功能 → 属于哪个业务域？ → modules/[domain]/
       → 跨业务通用组件？ → components/
       → 跨业务通用逻辑？ → composables/
       → 数据/API 操作？  → services/
```

## 命名规范

| 类型       | 规则           | 示例                 |
| ---------- | -------------- | -------------------- |
| 组件       | PascalCase.vue | `SearchBar.vue`      |
| Composable | use\*.ts       | `useSearch.ts`       |
| Service    | \*.service.ts  | `db.service.ts`      |
| Store      | \*.store.ts    | `document.store.ts`  |
| 类型       | PascalCase     | `SearchResult`       |
| 测试       | \*.test.ts     | `db.service.test.ts` |

## Vue 组件结构

```vue
<script setup lang="ts">
// 1. 外部依赖
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";

// 2. 内部导入
import { useToast } from "@/composables/useToast";
import type { Document } from "@/types";

// 3. Props/Emits
const props = defineProps<{ id: number }>();
const emit = defineEmits<{ update: [value: string] }>();

// 4. 响应式状态
const loading = ref(false);

// 5. Composables/Stores
const { success } = useToast();

// 6. 计算属性
const isValid = computed(() => props.id > 0);

// 7. 方法
function handleClick() {
  // ...
}

// 8. 生命周期
onMounted(() => {
  // ...
});
</script>

<template>
  <!-- 模板 -->
</template>

<style scoped>
@reference "@/style.css";
/* Tailwind @apply 需要 @reference */
</style>
```

## Service 模式

```typescript
// xxx.service.ts
class XxxService {
  async getData(): Promise<Data[]> {
    // 业务逻辑
  }
}

export const xxxService = new XxxService();
```

## Store 模式

```typescript
// xxx.store.ts
export const useXxxStore = defineStore("xxx", () => {
  // 状态
  const items = ref<Item[]>([]);
  const loading = ref(false);

  // 计算属性
  const count = computed(() => items.value.length);

  // 方法
  async function load() {
    loading.value = true;
    try {
      items.value = await xxxService.getData();
    } finally {
      loading.value = false;
    }
  }

  return { items, loading, count, load };
});
```

## Composable 模式

```typescript
// useXxx.ts
export function useXxx(options?: Options) {
  const state = ref<State>(initialState);

  function action() {
    // ...
  }

  return { state: readonly(state), action };
}
```

## mitt 事件总线

1. 在 `src/types/index.ts` 中声明事件类型：

```typescript
// ============ Event Types ============

export type Events = {
  "document:added": Document;
  "document:deleted": number;
  "search:complete": SearchResult[];
};
```

2. 创建事件总线实例 `src/services/emitter.ts`：

```typescript
import mitt from "mitt";
import type { Events } from "@/types";

export const emitter = mitt<Events>();
```

3. 使用：

```typescript
import { emitter } from "@/services/emitter";

// 发送事件
emitter.emit("document:added", newDoc);

// 监听事件
emitter.on("document:added", (doc) => {
  console.log("新文档:", doc.fileName);
});

// 移除监听
emitter.off("document:added", handler);
```

## 样式规范

- 优先使用 Tailwind 类，直接写在元素属性上
- 避免使用 `<style scoped>` 标签，保持组件简洁
- 如必须使用 `<style scoped>` 中的 `@apply`，需添加 `@reference "@/style.css";`
- 图标使用 `@vicons/material`，大小用 `size-*` 或 `w-* h-*`

### 样式写法示例

```vue
<!-- ✅ 推荐：直接写在元素上 -->
<div class="flex items-center gap-2 rounded-lg bg-white p-4">
  <span class="text-sm text-gray-600">内容</span>
</div>

<!-- ❌ 避免：使用 style 标签 -->
<div class="container">
  <span class="label">内容</span>
</div>

<style scoped>
.container {
  @apply flex items-center gap-2 rounded-lg bg-white p-4;
}
.label {
  @apply text-sm text-gray-600;
}
</style>
```

### 动态样式处理

```vue
<!-- 条件样式使用 :class 绑定 -->
<button
  class="rounded px-4 py-2 transition-colors"
  :class="isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'"
>
  按钮
</button>

<!-- 复杂的 grid 布局可用 style 属性 -->
<div class="grid gap-2 p-4" style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))">
  <!-- 内容 -->
</div>
```

## 代码质量

- 组件超过 200 行考虑拆分
- 相同逻辑出现 2+ 次考虑抽取
- 禁用 `any` 类型
- 注释使用中文

## Git 提交

```
feat: 添加xxx功能
fix: 修复xxx问题
refactor: 重构xxx
docs: 更新文档
test: 添加测试
```
