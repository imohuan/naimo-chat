<script setup lang="ts">
import { computed } from "vue";
import { Infinity as InfinityIcon, ChevronDown } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import type { ConversationMode } from "@/views/LlmDashboard/Chat/types";

const props = defineProps<{
  mode: ConversationMode;
}>();

const emit = defineEmits<{
  "update:mode": [mode: ConversationMode];
}>();

const conversationModes = [{
  value: "chat" as const,
  label: "对话",
  description: "直接对话模式。适用于简单问题和快速响应",
},
{
  value: "canvas" as const,
  label: "画布",
  description: "可视化工作区模式。用于创建和编辑视觉内容",
}
] as const

const conversationModes1 = [
  {
    value: "agent" as const,
    label: "智能",
    description: "Agent 可以在执行任务前进行规划。适用于深度研究、复杂任务或协作工作",
  },
  {
    value: "chat" as const,
    label: "对话",
    description: "直接对话模式。适用于简单问题和快速响应",
  },
  {
    value: "canvas" as const,
    label: "画布",
    description: "可视化工作区模式。用于创建和编辑视觉内容",
  },
  {
    value: "图片" as const,
    label: "图片生成",
    description: "图片处理模式。用于图片分析、编辑和生成",
  },
  {
    value: "视频" as const,
    label: "视频生成",
    description: "视频处理模式。用于视频分析、编辑和处理",
  },
] as const;

const selectedModeLabel = computed(() => {
  const mode = conversationModes.find((m) => m.value === props.mode);
  return mode?.label || "Chat";
});

function handleModeChange(mode: ConversationMode) {
  emit("update:mode", mode);
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <PromptInputButton class="gap-1.5 bg-gray-200 hover:bg-gray-300">
        <InfinityIcon class="w-4 h-4" />
        <span class="font-medium">{{ selectedModeLabel }}</span>
        <ChevronDown class="w-3.5 h-3.5 opacity-50" />
      </PromptInputButton>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" class="min-w-[320px] w-[320px] p-2">
      <DropdownMenuLabel class="px-3 py-2 text-sm font-semibold text-foreground">
        对话模式
      </DropdownMenuLabel>
      <DropdownMenuSeparator class="my-1" />
      <DropdownMenuRadioGroup :model-value="mode" class="flex flex-col gap-1" @update:model-value="handleModeChange">
        <DropdownMenuRadioItem v-for="modeOption in conversationModes" :key="modeOption.value" :value="modeOption.value"
          :class="[
            'flex! flex-col! items-start! gap-1! py-3! px-3! pl-3! rounded-sm! [&>span.absolute]:hidden',
            mode === modeOption.value ? 'bg-accent' : '',
          ]">
          <div class="flex flex-col gap-1 w-full">
            <span class="font-medium text-sm">{{ modeOption.label }}</span>
            <span class="text-xs text-muted-foreground leading-relaxed">
              {{ modeOption.description }}
            </span>
          </div>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
