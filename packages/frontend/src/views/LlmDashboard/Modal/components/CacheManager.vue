<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useToasts } from "@/hooks/useToasts";
import { DeleteOutlined, RefreshOutlined, FolderOutlined } from "@vicons/material";

interface CacheDirectory {
  key: string;
  name: string;
  path: string;
  description: string;
  exists: boolean;
  size: number;
  sizeFormatted: string;
  fileCount: number;
  folderCount: number;
}

interface CacheInfo {
  directories: CacheDirectory[];
  total: {
    size: number;
    sizeFormatted: string;
    fileCount: number;
    folderCount: number;
  };
}

const { pushToast } = useToasts();
const loading = ref(false);
const cacheInfo = ref<CacheInfo | null>(null);
const selectedDirectories = ref<Set<string>>(new Set());
const showConfirmDialog = ref(false);
const clearingDirectories = ref<string[]>([]);

const baseUrl = computed(() => {
  return localStorage.getItem("baseUrl") || "http://127.0.0.1:3457";
});

const allSelected = computed(() => {
  if (!cacheInfo.value) return false;
  return cacheInfo.value.directories.every((dir) =>
    selectedDirectories.value.has(dir.key)
  );
});

const hasSelection = computed(() => selectedDirectories.value.size > 0);

onMounted(() => {
  fetchCacheInfo();
});

async function fetchCacheInfo() {
  loading.value = true;
  try {
    const response = await fetch(`${baseUrl.value}/api/cache/info`);
    const result = await response.json();
    if (result.success) {
      cacheInfo.value = result.data;
    } else {
      pushToast("获取缓存信息失败", "error");
    }
  } catch (error) {
    console.error("获取缓存信息失败:", error);
    pushToast("获取缓存信息失败", "error");
  } finally {
    loading.value = false;
  }
}

function toggleSelection(key: string) {
  if (selectedDirectories.value.has(key)) {
    selectedDirectories.value.delete(key);
  } else {
    selectedDirectories.value.add(key);
  }
}

function toggleAll() {
  if (allSelected.value) {
    selectedDirectories.value.clear();
  } else {
    cacheInfo.value?.directories.forEach((dir) => {
      selectedDirectories.value.add(dir.key);
    });
  }
}

function openConfirmDialog() {
  if (!hasSelection.value) {
    pushToast("请先选择要清空的目录", "info");
    return;
  }
  clearingDirectories.value = Array.from(selectedDirectories.value);
  showConfirmDialog.value = true;
}

function closeConfirmDialog() {
  showConfirmDialog.value = false;
  clearingDirectories.value = [];
}

async function confirmClear() {
  const directories = Array.from(selectedDirectories.value);
  loading.value = true;
  showConfirmDialog.value = false;

  try {
    const response = await fetch(`${baseUrl.value}/api/cache/clear-batch`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ directories }),
    });

    const result = await response.json();

    if (result.success) {
      const successCount = result.data.filter((r: any) => r.success).length;
      pushToast(`成功清空 ${successCount} 个目录`, "success");
      selectedDirectories.value.clear();
      await fetchCacheInfo();
    } else {
      pushToast("清空缓存失败", "error");
    }
  } catch (error) {
    console.error("清空缓存失败:", error);
    pushToast("清空缓存失败", "error");
  } finally {
    loading.value = false;
  }
}

function getDirectoryName(key: string): string {
  return cacheInfo.value?.directories.find((d) => d.key === key)?.name || key;
}
</script>

<template>
  <div class="space-y-4">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between">
      <label class="label-base flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-slate-600">
          <path
            d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        缓存管理
      </label>
      <button
        class="text-xs text-primary hover:text-primary/80 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-primary/5 transition-colors disabled:opacity-50"
        :disabled="loading" @click="fetchCacheInfo">
        <RefreshOutlined class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        刷新
      </button>
    </div>

    <div v-if="loading && !cacheInfo" class="p-8 text-center text-slate-500 text-sm">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
      <div>加载中...</div>
    </div>

    <div v-else-if="cacheInfo" class="space-y-4">
      <!-- 总计信息卡片 -->
      <div class="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs text-slate-600 mb-1">总占用空间</div>
            <div class="text-2xl font-bold text-slate-800">
              {{ cacheInfo.total.sizeFormatted }}
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-600 mb-1">文件统计</div>
            <div class="text-sm font-medium text-slate-700">
              {{ cacheInfo.total.fileCount }} 个文件，{{
                cacheInfo.total.folderCount
              }}
              个文件夹
            </div>
          </div>
        </div>
      </div>

      <!-- 目录列表 -->
      <div class="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <!-- 表头 -->
        <div
          class="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 flex items-center gap-3 border-b border-slate-200">
          <input type="checkbox" :checked="allSelected" @change="toggleAll"
            class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all" />
          <div class="flex-1 text-xs font-semibold text-slate-700 uppercase tracking-wide">
            目录
          </div>
          <div class="w-28 text-right text-xs font-semibold text-slate-700 uppercase tracking-wide">
            大小
          </div>
          <div class="w-24 text-right text-xs font-semibold text-slate-700 uppercase tracking-wide">
            文件数
          </div>
        </div>

        <!-- 目录项 -->
        <div v-for="dir in cacheInfo.directories" :key="dir.key"
          class="px-4 py-3 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-all cursor-pointer group"
          :class="{ 'bg-blue-50/30': selectedDirectories.has(dir.key) }" @click="toggleSelection(dir.key)">
          <input type="checkbox" :checked="selectedDirectories.has(dir.key)" @change.stop="toggleSelection(dir.key)"
            class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <FolderOutlined class="w-4 h-4 shrink-0 transition-colors" :class="selectedDirectories.has(dir.key)
                ? 'text-primary'
                : 'text-slate-400 group-hover:text-slate-500'
                " />
              <span class="text-sm font-medium transition-colors" :class="selectedDirectories.has(dir.key)
                ? 'text-primary'
                : 'text-slate-700'
                ">
                {{ dir.name }}
              </span>
            </div>
            <div class="text-xs text-slate-500 truncate pl-6">
              {{ dir.description }}
            </div>
          </div>
          <div class="w-28 text-right text-sm font-mono font-medium transition-colors" :class="selectedDirectories.has(dir.key)
            ? 'text-primary'
            : 'text-slate-600'
            ">
            {{ dir.sizeFormatted }}
          </div>
          <div class="w-24 text-right text-sm transition-colors" :class="selectedDirectories.has(dir.key)
            ? 'text-primary'
            : 'text-slate-600'
            ">
            {{ dir.fileCount }}
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end">
        <button class="btn-danger text-sm shadow-sm hover:shadow-md" :disabled="!hasSelection || loading"
          @click="openConfirmDialog">
          <DeleteOutlined class="w-4 h-4" />
          清空选中目录
          <span v-if="hasSelection" class="ml-1">({{ selectedDirectories.size }})</span>
        </button>
      </div>
    </div>

    <!-- 确认对话框 -->
    <transition name="fade">
      <div v-if="showConfirmDialog"
        class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" style="z-index: 60;"
        @click.self="closeConfirmDialog">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in">
          <div class="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-red-50 to-orange-50">
            <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-red-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              确认清空缓存
            </h3>
          </div>
          <div class="px-6 py-4 space-y-3">
            <p class="text-sm text-slate-600">
              您确定要清空以下目录吗？<span class="font-semibold text-red-600">此操作不可恢复</span>。
            </p>
            <div class="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <div v-for="key in clearingDirectories" :key="key" class="text-sm text-red-700 flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {{ getDirectoryName(key) }}
              </div>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button class="btn-secondary" @click="closeConfirmDialog">
              取消
            </button>
            <button class="btn-danger" @click="confirmClear">
              <DeleteOutlined class="w-4 h-4" />
              确认清空
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.btn-danger {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background-color: rgb(239 68 68);
  color: white;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-danger:hover:not(:disabled) {
  background-color: rgb(220 38 38);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.animate-in {
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
