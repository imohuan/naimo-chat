<script setup lang="ts">
import { ref } from "vue";
import { useVModel } from "@vueuse/core";
import {
  CloseOutlined,
  SaveOutlined,
  TimerOutlined,
  LinkOutlined,
  VpnKeyOutlined,
  FolderOpenOutlined,
  TerminalOutlined,
} from "@vicons/material";
import Input from "@/components/llm/Input.vue";
import ClaudeIcon from "@/components/svg/claude.vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    timeoutMs: string;
    baseUrl: string;
    apiKey: string;
    claudePath: string;
    workDir: string;
    terminalType?: string;
    // 是否在右侧显示"文件/目录选择"按钮（以及对应的 file input）
    enableFileButtons?: boolean;
  }>(),
  {
    terminalType: "powershell",
    enableFileButtons: false,
  }
);

const emit = defineEmits<{
  "update:show": [value: boolean];
  "update:timeoutMs": [value: string];
  "update:baseUrl": [value: string];
  "update:apiKey": [value: string];
  "update:claudePath": [value: string];
  "update:workDir": [value: string];
  "update:terminalType": [value: string];
  confirm: [];
}>();

const show = useVModel(props, "show", emit);
const timeoutMs = useVModel(props, "timeoutMs", emit);
const baseUrl = useVModel(props, "baseUrl", emit);
const apiKey = useVModel(props, "apiKey", emit);
const claudePath = useVModel(props, "claudePath", emit);
const workDir = useVModel(props, "workDir", emit);
const terminalType = useVModel(props, "terminalType", emit);

// 文件/目录选择：通过按钮点击触发隐藏的 file 输入
const claudePathInputRef = ref<HTMLInputElement | null>(null);
const workDirInputRef = ref<HTMLInputElement | null>(null);

function pickClaudePath() {
  console.log("[ClaudeSettingsModal] pickClaudePath button click");
  if (!claudePathInputRef.value) {
    console.warn("[ClaudeSettingsModal] claudePathInputRef is null, input 未挂载");
    return;
  }
  claudePathInputRef.value.click();
}

function pickWorkDir() {
  console.log("[ClaudeSettingsModal] pickWorkDir button click");
  if (!workDirInputRef.value) {
    console.warn("[ClaudeSettingsModal] workDirInputRef is null, input 未挂载");
    return;
  }
  workDirInputRef.value.click();
}

function handleClaudePathChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  console.log("[ClaudeSettingsModal] handleClaudePathChange fired, file:", file);
  if (file) {
    // 浏览器无法获取真实系统路径，这里仅使用文件名占位
    claudePath.value = file.name;
  }
}

function handleWorkDirChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  console.log("[ClaudeSettingsModal] handleWorkDirChange fired, file:", file);
  if (file) {
    // 使用相对路径/文件名占位
    const relPath = (file as any).webkitRelativePath || file.name;
    workDir.value = relPath;
  }
}
</script>

<template>
  <transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
      >
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"
        >
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <ClaudeIcon class="w-7 h-7 rounded-md overflow-hidden" />
            <span class="text-lg">Claude 启动配置</span>
          </h3>
          <button class="btn-icon" @click="show = false">
            <CloseOutlined class="w-5 h-5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <div class="space-y-2">
            <label class="label-base flex items-center gap-1">
              <LinkOutlined class="w-4 h-4" />
              <span>基础 URL</span>
            </label>
            <Input v-model="baseUrl" placeholder="http://127.0.0.1:3457/" />
            <p class="text-xs text-slate-400">本地路由/转发服务的基础地址。</p>
          </div>

          <div class="space-y-2">
            <label class="label-base flex items-center gap-1">
              <VpnKeyOutlined class="w-4 h-4" />
              <span>API Key</span>
            </label>
            <Input
              v-model="apiKey"
              type="password"
              :passwordToggle="true"
              placeholder="sk-..."
            />
            <p class="text-xs text-slate-400">用于访问 Anthropic / Claude 的 API Key。</p>
          </div>

          <div class="space-y-2">
            <label class="label-base">Claude Path（指令 / 可执行文件路径）</label>
            <div class="relative">
              <Input
                v-model="claudePath"
                placeholder="例如：claude 或 D:\Tools\claude\claude.exe"
                :class="props.enableFileButtons ? 'pr-10' : ''"
              />
              <!-- 隐藏的文件选择，通过按钮点击触发 -->
              <template v-if="props.enableFileButtons">
                <input
                  ref="claudePathInputRef"
                  type="file"
                  class="hidden"
                  @change="handleClaudePathChange"
                />
                <button
                  class="absolute inset-y-0 right-0 px-2 flex items-center text-slate-400 hover:text-primary transition-colors"
                  type="button"
                  @click="pickClaudePath"
                >
                  <FolderOpenOutlined class="w-4 h-4" />
                </button>
              </template>
            </div>
            <p class="text-xs text-slate-400">
              支持直接输入命令或选择可执行文件；具体执行逻辑需在桌面端脚本中实现。
            </p>
          </div>

          <div class="space-y-2">
            <label class="label-base">工作地址（工作目录）</label>
            <div class="relative">
              <Input
                v-model="workDir"
                placeholder="例如：G:\ClaudeCode"
                :class="props.enableFileButtons ? 'pr-10' : ''"
              />
              <!-- 目录选择（浏览器限制下使用 webkitdirectory 占位），通过按钮点击触发 -->
              <template v-if="props.enableFileButtons">
                <input
                  ref="workDirInputRef"
                  type="file"
                  webkitdirectory
                  class="hidden"
                  @change="handleWorkDirChange"
                />
                <button
                  class="absolute inset-y-0 right-0 px-2 flex items-center text-slate-400 hover:text-primary transition-colors"
                  type="button"
                  @click="pickWorkDir"
                >
                  <FolderOpenOutlined class="w-4 h-4" />
                </button>
              </template>
            </div>
            <p class="text-xs text-slate-400">
              Claude
              运行时的工作目录；路径选择在浏览器中仅作为占位展示，实际逻辑可由本地脚本处理。
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <div class="flex-[3] space-y-2">
                <label class="label-base flex items-center gap-1">
                  <TimerOutlined class="w-4 h-4" />
                  <span>超时时间 (ms)</span>
                </label>
                <input
                  v-model="timeoutMs"
                  type="number"
                  class="input-base w-full"
                  placeholder="例如：300000"
                  min="0"
                />
              </div>
              <div class="flex-[2] space-y-2">
                <label class="label-base flex items-center gap-1">
                  <TerminalOutlined class="w-4 h-4" />
                  <span>启动终端</span>
                </label>
                <div class="w-fit flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 border border-transparent"
                    :class="
                      terminalType === 'powershell'
                        ? 'bg-white text-primary shadow-sm border border-primary/20'
                        : 'text-slate-500 hover:text-slate-700'
                    "
                    @click="terminalType = 'powershell'"
                  >
                    <TerminalOutlined class="w-4 h-4" />
                    <span>PowerShell</span>
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 border border-transparent"
                    :class="
                      terminalType === 'cmd'
                        ? 'bg-white text-primary shadow-sm border border-primary/20'
                        : 'text-slate-500 hover:text-slate-700'
                    "
                    @click="terminalType = 'cmd'"
                  >
                    <TerminalOutlined class="w-4 h-4" />
                    <span>CMD</span>
                  </button>
                </div>
              </div>
            </div>
            <p class="text-xs text-slate-400">
              请求 Claude 的超时时间，单位毫秒。右侧可选择启动终端类型。
            </p>
          </div>
        </div>

        <div
          class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end items-center gap-3"
        >
          <button class="btn-secondary" @click="show = false">取消</button>
          <button
            class="btn-primary flex items-center gap-2"
            @click="
              () => {
                emit('confirm');
              }
            "
          >
            <SaveOutlined class="w-4 h-4" />
            执行
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
