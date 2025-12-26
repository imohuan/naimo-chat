<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import {
  AddOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@vicons/material";

type Mode = "add" | "edit";

const props = withDefaults(
  defineProps<{
    mode: Mode;
    name?: string;
    isCurrent?: boolean;
    placeholder?: string;
  }>(),
  {
    isCurrent: false,
    placeholder: "输入主题名称",
  }
);

const emit = defineEmits<{
  (e: "confirm", value: string): void;
  (e: "cancel"): void;
  (e: "click"): void;
  (e: "delete"): void;
  (e: "edit"): void;
}>();

const isEditing = ref(false);
const inputValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

// 初始化输入值
if (props.mode === "edit" && props.name) {
  inputValue.value = props.name;
}

// 监听编辑状态变化，自动聚焦
watch(isEditing, () => {
  if (isEditing.value) {
    nextTick(() => {
      inputRef.value?.focus();
      // 选中所有文本
      inputRef.value?.select();
    });
  }
});

// 监听 props.name 变化，同步到 inputValue（编辑模式下）
watch(
  () => props.name,
  (newName) => {
    if (props.mode === "edit" && !isEditing.value && newName) {
      inputValue.value = newName;
    }
  }
);

function handleClick() {
  if (props.mode === "add" && !isEditing.value) {
    isEditing.value = true;
    inputValue.value = "";
  } else if (props.mode === "edit" && !isEditing.value) {
    emit("click");
  }
}

function handleConfirm() {
  if (inputValue.value.trim()) {
    emit("confirm", inputValue.value.trim());
    if (props.mode === "add") {
      isEditing.value = false;
      inputValue.value = "";
    }
    // 编辑模式下，确认后由父组件控制关闭编辑状态
  }
}

function handleCancel() {
  if (props.mode === "add") {
    isEditing.value = false;
    inputValue.value = "";
  } else if (props.mode === "edit") {
    isEditing.value = false;
    inputValue.value = props.name || "";
  }
  emit("cancel");
}

function handleDelete() {
  if (confirm(`确定要删除主题模板 "${props.name}" 吗？`)) {
    emit("delete");
  }
}

function handleEdit() {
  isEditing.value = true;
  inputValue.value = props.name || "";
  emit("edit");
}

// 暴露方法供父组件调用
defineExpose({
  startEdit: () => {
    isEditing.value = true;
    inputValue.value = props.name || "";
  },
  cancelEdit: () => {
    isEditing.value = false;
    if (props.mode === "edit" && props.name) {
      inputValue.value = props.name;
    }
  },
});
</script>

<template>
  <div
    v-if="mode === 'add'"
    class="group relative flex items-center gap-2 px-3 py-2 bg-white border border-dashed rounded-lg transition-all cursor-pointer h-[38px]"
    :class="
      isEditing
        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
        : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
    "
    @click.stop="handleClick"
  >
    <template v-if="isEditing">
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        :placeholder="placeholder"
        class="flex-1 h-6 px-2 text-sm bg-transparent focus:outline-none"
        @keyup.enter="handleConfirm"
        @keyup.esc="handleCancel"
        @click.stop
      />
      <button
        class="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors shrink-0"
        @click.stop="handleConfirm"
        title="确认"
      >
        <CheckOutlined class="w-4 h-4" />
      </button>
      <button
        class="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors shrink-0"
        @click.stop="handleCancel"
        title="取消"
      >
        <CloseOutlined class="w-4 h-4" />
      </button>
    </template>
    <template v-else>
      <AddOutlined class="w-4 h-4 text-slate-500" />
      <span class="text-sm font-medium text-slate-600">添加主题</span>
    </template>
  </div>

  <div
    v-else
    class="group relative flex items-center gap-2 px-3 py-2 bg-white border rounded-lg transition-all cursor-pointer h-[38px]"
    :class="
      isCurrent
        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
    "
    @click.stop="!isEditing && handleClick()"
  >
    <template v-if="isEditing">
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        class="flex-1 h-6 px-2 text-sm bg-transparent focus:outline-none"
        @keyup.enter="handleConfirm"
        @keyup.esc="handleCancel"
        @click.stop
      />
      <button
        class="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors shrink-0"
        @click.stop="handleConfirm"
        title="确认"
      >
        <CheckOutlined class="w-4 h-4" />
      </button>
      <button
        class="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors shrink-0"
        @click.stop="handleCancel"
        title="取消"
      >
        <CloseOutlined class="w-4 h-4" />
      </button>
    </template>
    <template v-else>
      <span
        class="text-sm font-medium"
        :class="isCurrent ? 'text-indigo-700' : 'text-slate-700'"
      >
        {{ name }}
      </span>
      <span
        v-if="isCurrent"
        class="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded"
      >
        当前
      </span>
      <div
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          class="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
          @click.stop="handleEdit"
          title="重命名"
        >
          <EditOutlined class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="!isCurrent"
          class="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          @click.stop="handleDelete"
          title="删除"
        >
          <DeleteOutlined class="w-3.5 h-3.5" />
        </button>
      </div>
    </template>
  </div>
</template>
