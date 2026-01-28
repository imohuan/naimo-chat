<script setup lang="ts">
import { ref } from 'vue';
import type { ImageData } from '@/modules/chat/composables/useChatState';

const props = defineProps<{
  message: string;
  canSend: boolean;
  streamingId: string;
  isStarting: boolean;
  currentCwd: string;
  cwdList: string[];
  cwdDropdownOpen: boolean;
  inputDisabled: boolean;
  projectPathMissing: boolean;
  uploadedImages: ImageData[];
}>();

const emit = defineEmits<{
  'update:message': [value: string];
  'update:currentCwd': [value: string];
  'send': [];
  'abort': [];
  'toggle-cwd-dropdown': [];
  'select-cwd': [cwd: string];
  'remove-cwd': [index: number];
  'file-select': [files: FileList];
  'paste': [event: ClipboardEvent];
  'remove-image': [imageId: string];
}>();

const chatInput = ref<HTMLTextAreaElement>();
const fileInput = ref<HTMLInputElement>();

const handleEnter = (e: KeyboardEvent) => {
  if (!e.shiftKey) {
    e.preventDefault();
    if (props.canSend) {
      emit('send');
    }
  }
};

const autoResize = (e: Event) => {
  const textarea = e.target as HTMLTextAreaElement;
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    emit('file-select', target.files);
    target.value = '';
  }
};
</script>

<template>
  <footer v-show="true" class="p-6 bg-gradient-to-t from-white via-white to-transparent border-t border-slate-100">
    <div class="max-w-4xl mx-auto relative">
      <!-- 项目路径不存在提示 -->
      <div v-if="projectPathMissing"
        class="mb-3 px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm border bg-red-50 border-red-200 text-red-800">
        <i class="fa-solid text-base fa-exclamation-triangle"></i>
        <div class="flex-1">
          <div class="font-semibold mb-0.5">项目路径不存在</div>
          <div class="text-xs opacity-90">项目目录已不存在，无法继续对话。请检查路径或点击"新对话"开始新会话。</div>
        </div>
      </div>

      <div class="input-container-gemini" :class="{ 'opacity-60 pointer-events-none': projectPathMissing }">
        <!-- 图片预览区域 -->
        <div v-if="uploadedImages.length > 0" class="preview-area-input flex gap-2 flex-wrap mb-2">
          <div v-for="img in uploadedImages" :key="img.id" class="preview-wrapper-input relative">
            <img :src="img.src" class="preview-item-input w-9 h-9 rounded-lg object-cover border border-slate-200" />
            <div @click="emit('remove-image', img.id)"
              class="preview-close-input absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
              <i class="fa-solid fa-xmark text-xs text-slate-600"></i>
            </div>
          </div>
        </div>

        <!-- 输入框 -->
        <textarea ref="chatInput" :value="message"
          @input="(e) => { $emit('update:message', (e.target as HTMLTextAreaElement).value); autoResize(e); }"
          @keydown.enter="handleEnter" @paste="$emit('paste', $event as ClipboardEvent)" placeholder="给 Claude 发送消息..."
          :disabled="projectPathMissing"
          class="w-full border-none bg-transparent outline-none p-0 text-sm leading-relaxed max-h-[120px] resize-none text-slate-900 overflow-y-auto custom-scrollbar"
          rows="1"></textarea>

        <!-- 底部按钮行 -->
        <div class="button-row-input flex justify-between items-center pt-2">
          <div class="left-buttons-input flex items-center gap-2">
            <!-- 添加图片按钮 -->
            <label
              class="add-btn-input w-7 h-7 rounded-full bg-transparent text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition">
              <input ref="fileInput" type="file" hidden accept="image/*" multiple @change="handleFileSelect">
              <i class="fa-solid fa-plus"></i>
            </label>

            <!-- 工作目录选择 -->
            <div class="cwd-selector-wrapper relative">
              <div class="cwd-input-container" :class="{ disabled: inputDisabled && !projectPathMissing }">
                <i class="fa-solid fa-folder cwd-icon"></i>
                <input :value="currentCwd"
                  @input="$emit('update:currentCwd', ($event.target as HTMLInputElement).value)"
                  @click.stop="!inputDisabled && emit('toggle-cwd-dropdown')" type="text" class="cwd-input"
                  placeholder="工作目录 (可选)" :disabled="inputDisabled && !projectPathMissing">

                <i v-if="inputDisabled && !projectPathMissing" class="fa-solid fa-info-circle cwd-info-icon"
                  title="已存在的会话&#10;工作目录已加载，点击 [新对话] 按钮开始新的对话"></i>

                <svg v-else-if="cwdList.length > 0" @click.stop="emit('toggle-cwd-dropdown')" class="cwd-dropdown-icon"
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              <!-- CWD 下拉菜单 -->
              <div v-if="cwdDropdownOpen" class="cwd-dropdown">
                <div v-if="cwdList.length === 0" class="cwd-dropdown-empty">暂无历史目录</div>
                <div v-else>
                  <div v-for="(cwd, index) in cwdList" :key="index" class="cwd-option"
                    :class="{ selected: currentCwd === cwd }" @click="emit('select-cwd', cwd)">
                    <div class="cwd-option-content">
                      <i class="fa-solid fa-folder cwd-option-icon"></i>
                      <span>{{ cwd }}</span>
                    </div>
                    <button @click.stop="emit('remove-cwd', index)" class="cwd-remove-btn" title="删除">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="right-buttons-input flex items-center gap-2">
            <button @click="streamingId ? emit('abort') : emit('send')" :disabled="!streamingId && !canSend"
              class="w-7 h-7 rounded-full flex items-center justify-center transition"
              :class="streamingId ? 'bg-slate-800 hover:bg-slate-900 text-white' : canSend ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-200 text-slate-400'">
              <i v-if="streamingId" class="fa-solid fa-stop text-sm"></i>
              <i v-else-if="!isStarting" class="fa-solid fa-paper-plane text-sm"></i>
              <span v-else class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.input-container-gemini {
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 12px 14px 10px 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.input-container-gemini:focus-within {
  background: #ffffff;
  border-color: #d2d5da;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.cwd-selector-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.cwd-input-container {
  position: relative;
  display: flex;
  align-items: center;
  border: 1px solid #dadce0;
  border-radius: 8px;
  background: transparent;
  transition: 0.2s;
  overflow: hidden;
}

.cwd-input-container:hover {
  border-color: #bdc1c6;
  background: #f8f9fa;
}

.cwd-icon {
  padding-left: 10px;
  color: #5f6368;
  font-size: 14px;
}

.cwd-input {
  width: 200px;
  padding: 4px 28px 4px 8px;
  border: none;
  background: transparent;
  color: #202124;
  font-size: 13px;
  outline: none;
}

.cwd-dropdown-icon {
  position: absolute;
  right: 8px;
  cursor: pointer;
  color: #5f6368;
  transition: transform 0.2s;
}

.cwd-info-icon {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5c5c5c;
  font-size: 14px;
  cursor: help;
}

.cwd-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 6px 0;
  min-width: 300px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
}

.cwd-dropdown-empty {
  padding: 20px;
  text-align: center;
  color: #5f6368;
  font-size: 13px;
}

.cwd-option {
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: 0.2s;
}

.cwd-option:hover {
  background: #f8f9fa;
}

.cwd-option.selected {
  background: #e8f0fe;
}

.cwd-option-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #202124;
}

.cwd-option-icon {
  color: #5f6368;
  font-size: 13px;
}

.cwd-remove-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #5f6368;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}

.cwd-remove-btn:hover {
  background: #f1f3f4;
  color: #d93025;
}

.preview-wrapper-input:hover .preview-close-input {
  opacity: 1;
}
</style>
