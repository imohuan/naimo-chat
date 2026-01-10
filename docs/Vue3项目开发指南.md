# Vue 3 项目开发指南

## 🏗️ 项目架构设计原则

### 目录结构决策树
```
当新增功能时，先问：
1. 这属于哪个业务域？ → modules/业务域/
2. 是跨业务的通用组件？ → components/
3. 是跨业务的通用逻辑？ → composables/
4. 是通用工具函数？ → utils/
```

### 推荐目录结构
```
src/
├── modules/           # 业务模块（核心）
│   ├── user/         # 用户相关一切
│   │   ├── components/  # 模块内组件
│   │   ├── pages/      # 模块内页面
│   │   ├── user.service.ts  # API封装
│   │   ├── useUser.ts        # 业务逻辑
│   │   └── index.ts          # 统一导出
│   └── order/        # 订单模块
├── components/       # 真正通用的基础组件
├── composables/      # 跨业务通用hooks
├── services/         # 通用服务（HTTP实例等）
└── stores/           # 全局状态管理
```

## 📝 代码编写规范

### Vue组件编写顺序
```vue
<script setup lang="ts">
// 1. 外部依赖导入
// 2. 组件导入
// 3. Props/Emits定义
// 4. 响应式状态
// 5. Composables/Stores
// 6. 纯函数/事件处理
// 7. 生命周期
</script>
```

### 何时抽取Composable
- 组件超过200行
- 逻辑块超过3个
- 相同逻辑在多处使用

### 状态管理原则
```
判断流程：
本地状态 → 组件内ref/reactive
跨组件共享 → 考虑Pinia store
跨页面共享 → 使用Pinia store
```

## 🎯 开发决策Checklist

### 新功能开发前必问
1. [ ] 这个功能属于哪个业务模块？
2. [ ] 应该放在modules/xxx下吗？
3. [ ] 是否需要抽取为composable？
4. [ ] 状态应该放在哪里（本地/Pinia）？
5. [ ] API调用是否封装在service中？

### 代码提交前必查
1. [ ] 组件是否超过200行？
2. [ ] 是否有重复逻辑可以抽取？
3. [ ] 命名是否符合规范？
4. [ ] ESLint检查是否通过？
5. [ ] 是否有未使用的依赖？

## 📋 命名规范速查

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 组件文件 | PascalCase | UserList.vue |
| Composable | useXxx.ts | useUserForm.ts |
| Service | xxx.service.ts | order.service.ts |
| Store | xxx.store.ts | user.store.ts |
| 目录 | 小写+复数 | components/, modules/ |

## 🔧 工程化配置要求

### 必装工具
```json
{
  "eslint": "^8.0.0",
  "prettier": "^2.0.0",
  "husky": "^8.0.0",
  "lint-staged": "^13.0.0"
}
```

### VSCode设置
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 🚀 重构优先级

### 渐进式重构顺序
1. **第一优先级**：配置ESLint + Prettier
2. **第二优先级**：按业务迁移文件到modules/
3. **第三优先级**：抽取高频使用的composables
4. **第四优先级**：拆分大型组件（>200行）

### 重构原则
- 一次只改一个模块
- 保持功能不变
- 每次重构都要测试
- 不要过度抽象

## 💡 最佳实践提醒

### Do's（推荐做法）
✅ 按业务模块组织代码
✅ 使用组合式API
✅ 统一使用`<script setup>`
✅ API调用封装在service中
✅ 组件只负责UI和事件调用

### Don'ts（避免做法）
❌ 在组件中直接调用API
❌ 把所有状态都放Pinia
❌ 组件超过200行不拆分
❌ 命名不规范
❌ 忽略ESLint警告

---

## 📚 详细实施指南

### 一、项目初始化配置

#### 1. 创建项目结构
```bash
# 创建标准目录结构
mkdir -p src/modules/{user,order,product}
mkdir -p src/components/base
mkdir -p src/composables
mkdir -p src/services
mkdir -p src/stores
mkdir -p src/utils
```

#### 2. 配置ESLint (.eslintrc.js)
```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier',
    'plugin:vue/vue3-recommended'
  ],
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/no-unused-vars': 'error',
    '@typescript-eslint/no-unused-vars': 'error'
  }
}
```

#### 3. 配置Prettier (.prettierrc)
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none"
}
```

### 二、业务模块开发示例

#### 1. 用户模块结构 (src/modules/user/)
```
user/
├── components/
│   ├── UserForm.vue
│   └── UserList.vue
├── pages/
│   ├── UserDetail.vue
│   └── UserManagement.vue
├── user.service.ts
├── useUser.ts
└── index.ts
```

#### 2. Service层实现 (user.service.ts)
```typescript
import http from '@/services/http'

export const userService = {
  async getUsers(params?: any) {
    return http.get('/api/users', { params })
  },

  async getUserById(id: string) {
    return http.get(`/api/users/${id}`)
  },

  async createUser(data: any) {
    return http.post('/api/users', data)
  },

  async updateUser(id: string, data: any) {
    return http.put(`/api/users/${id}`, data)
  },

  async deleteUser(id: string) {
    return http.delete(`/api/users/${id}`)
  }
}
```

#### 3. Composable实现 (useUser.ts)
```typescript
import { ref, computed } from 'vue'
import { userService } from './user.service'

export function useUser() {
  const users = ref([])
  const loading = ref(false)
  const error = ref(null)

  const fetchUsers = async (params?: any) => {
    loading.value = true
    error.value = null
    try {
      const response = await userService.getUsers(params)
      users.value = response.data
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  const createUser = async (userData: any) => {
    loading.value = true
    try {
      await userService.createUser(userData)
      await fetchUsers() // 刷新列表
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  const userCount = computed(() => users.value.length)

  return {
    users,
    loading,
    error,
    userCount,
    fetchUsers,
    createUser
  }
}
```

#### 4. 组件实现 (UserList.vue)
```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useUser } from '@/modules/user/useUser'
import UserForm from './UserForm.vue'

const { users, loading, error, userCount, fetchUsers, createUser } = useUser()

onMounted(() => {
  fetchUsers()
})

const handleCreateUser = (userData: any) => {
  createUser(userData)
}
</script>

<template>
  <div class="user-list">
    <h1>用户管理 ({{ userCount }})</h1>

    <UserForm @submit="handleCreateUser" />

    <div v-if="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <ul v-else>
      <li v-for="user in users" :key="user.id">
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.error {
  color: red;
}
</style>
```

### 三、通用组件示例

#### 基础按钮组件 (src/components/base/BaseButton.vue)
```vue
<script setup lang="ts">
interface Props {
  type?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'primary',
  size: 'medium',
  disabled: false,
  loading: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    :class="[
      'base-button',
      `base-button--${type}`,
      `base-button--${size}`,
      { 'base-button--disabled': disabled },
      { 'base-button--loading': loading }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading">Loading...</span>
    <slot v-else />
  </button>
</template>

<style scoped>
.base-button {
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.base-button--primary {
  background-color: #007bff;
  color: white;
}

.base-button--secondary {
  background-color: #6c757d;
  color: white;
}

.base-button--danger {
  background-color: #dc3545;
  color: white;
}

.base-button--small {
  padding: 4px 8px;
  font-size: 12px;
}

.base-button--medium {
  padding: 8px 16px;
  font-size: 14px;
}

.base-button--large {
  padding: 12px 24px;
  font-size: 16px;
}

.base-button--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.base-button--loading {
  opacity: 0.8;
}
</style>
```

### 四、通用Composables示例

#### 分页逻辑 (src/composables/usePagination.ts)
```typescript
import { ref, computed } from 'vue'

interface PaginationOptions {
  pageSize?: number
  initialPage?: number
}

export function usePagination(options: PaginationOptions = {}) {
  const pageSize = ref(options.pageSize || 10)
  const currentPage = ref(options.initialPage || 1)
  const total = ref(0)

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

  const hasNextPage = computed(() => currentPage.value < totalPages.value)
  const hasPrevPage = computed(() => currentPage.value > 1)

  const nextPage = () => {
    if (hasNextPage.value) {
      currentPage.value++
    }
  }

  const prevPage = () => {
    if (hasPrevPage.value) {
      currentPage.value--
    }
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  const setTotal = (newTotal: number) => {
    total.value = newTotal
  }

  return {
    pageSize,
    currentPage,
    total,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
    setTotal
  }
}
```

### 五、路由配置示例

#### 用户路由 (src/router/user.ts)
```typescript
const userRoutes = [
  {
    path: '/users',
    name: 'UserList',
    component: () => import('@/modules/user/pages/UserManagement.vue'),
    meta: {
      title: '用户管理'
    }
  },
  {
    path: '/users/:id',
    name: 'UserDetail',
    component: () => import('@/modules/user/pages/UserDetail.vue'),
    meta: {
      title: '用户详情'
    }
  }
]

export default userRoutes
```

#### 主路由配置 (src/router/index.ts)
```typescript
import { createRouter, createWebHistory } from 'vue-router'
import userRoutes from './user'
import orderRoutes from './order'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue')
  },
  ...userRoutes,
  ...orderRoutes
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
```

---

## 📖 使用说明

此文档可作为：
1. **新项目初始化指南** - 按照此结构创建项目
2. **团队开发规范** - 确保代码风格统一
3. **代码审查清单** - PR审查时参考
4. **重构指导手册** - 逐步优化现有项目

**核心原则**：架构清晰、职责分明、易于维护、方便扩展