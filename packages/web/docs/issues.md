# 问题速查

## Tailwind CSS v4 @apply 报错

**错误**: `Cannot apply unknown utility class. Are you using CSS modules or similar and missing @reference?`

**解决**: 在 `<style scoped>` 开头添加 `@reference`

```vue
<style scoped>
@reference "@/style.css";

.my-class {
  @apply flex items-center;
}
</style>
```

---

## 图标大小控制

**错误**: 使用 `text-xl` 控制图标大小

**正确**: 使用 `size-*` 或 `w-* h-*`

```vue
<!-- ❌ 错误 -->
<SearchOutlined class="text-xl" />

<!-- ✅ 正确 -->
<SearchOutlined class="size-5" />
```

| 场景   | 大小 | 类名     |
| ------ | ---- | -------- |
| 小图标 | 16px | `size-4` |
| 常规   | 20px | `size-5` |
| 中等   | 24px | `size-6` |
| 大图标 | 32px | `size-8` |

---

## 图标库统一

**规范**: 只使用 `@vicons/material`

```typescript
// ✅ 正确
import { SearchOutlined } from '@vicons/material'

// ❌ 禁止使用字体图标
<i class="ph ph-search"></i>
```

---

## 类型导入

**规范**: 类型使用 `import type`

```typescript
// ✅ 正确
import type { Document, SearchResult } from "@/types";

// ❌ 避免
import { Document } from "@/types";
```
