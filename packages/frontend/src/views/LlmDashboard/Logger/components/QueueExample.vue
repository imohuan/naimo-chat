<script setup lang="ts">
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemAttachment,
  QueueItemContent,
  QueueItemDescription,
  QueueItemFile,
  QueueItemImage,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue";

import { ArrowUp, Trash2 } from "lucide-vue-next";

import { computed, ref, watch } from "vue";

export interface QueueMessagePart {
  type: string;
  text?: string;
  url?: string;
  filename?: string;
  mediaType?: string;
}

export interface QueueMessage {
  id: string;
  parts: QueueMessagePart[];
}

export interface QueueTodo {
  id: string;
  title: string;
  description?: string;
  status?: "pending" | "completed";
}

interface Props {
  todos?: QueueTodo[];
  messages?: QueueMessage[];
  showMessages?: boolean;
  preview?: boolean; // 预览模式，不允许编辑
}

const props = withDefaults(defineProps<Props>(), {
  todos: () => [],
  messages: () => [],
  showMessages: true,
  preview: false,
});

const sampleMessages: QueueMessage[] = [
  {
    id: "msg-1",
    parts: [{ type: "text", text: "How do I set up the project?" }],
  },
  {
    id: "msg-2",
    parts: [{ type: "text", text: "What is the roadmap for Q4?" }],
  },
  {
    id: "msg-3",
    parts: [
      { type: "text", text: "Update the default logo to this png." },
      {
        type: "file",
        url: "https://github.com/peoray.png",
        filename: "setup-guide.png",
        mediaType: "image/png",
      },
    ],
  },
  {
    id: "msg-4",
    parts: [{ type: "text", text: "Please generate a changelog." }],
  },
  {
    id: "msg-5",
    parts: [{ type: "text", text: "Add dark mode support." }],
  },
  {
    id: "msg-6",
    parts: [{ type: "text", text: "Optimize database queries." }],
  },
  {
    id: "msg-7",
    parts: [{ type: "text", text: "Set up CI/CD pipeline." }],
  },
];

const sampleTodos: QueueTodo[] = [
  {
    id: "todo-1",
    title: "Restore message container backgrounds",
    description: "Restoring message backgrounds",
    status: "pending",
  },
  {
    id: "todo-2",
    title: "Keep nested tool content white",
    description: "Keeping nested content white",
    status: "pending",
  },
  {
    id: "todo-3",
    title: "Ensure proper visual hierarchy with backgrounds",
    description: "Ensuring visual hierarchy",
    status: "pending",
  },
];

const messages = ref<QueueMessage[]>(
  props.messages.length > 0 ? props.messages : sampleMessages
);
const todos = ref<QueueTodo[]>(props.todos.length > 0 ? props.todos : sampleTodos);

// 监听 props 变化并更新内部状态
watch(
  () => props.todos,
  (newTodos) => {
    if (newTodos.length > 0) {
      todos.value = newTodos;
    }
  },
  { immediate: true, deep: true }
);

watch(
  () => props.messages,
  (newMessages) => {
    if (newMessages.length > 0) {
      messages.value = newMessages;
    }
  },
  { immediate: true, deep: true }
);

function handleRemoveMessage(id: string) {
  messages.value = messages.value.filter((msg) => msg.id !== id);
}

function handleRemoveTodo(id: string) {
  todos.value = todos.value.filter((todo) => todo.id !== id);
}

function handleSendNow(id: string) {
  // eslint-disable-next-line no-console
  console.log("Send now:", id);
  handleRemoveMessage(id);
}

const hasQueue = computed(() => messages.value.length > 0 || todos.value.length > 0);
</script>

<template>
  <Queue v-if="hasQueue" class="min-w-0 w-full">
    <!-- Queued Messages Section -->
    <QueueSection v-if="showMessages && messages.length > 0">
      <QueueSectionTrigger>
        <QueueSectionLabel :count="messages.length" label="Queued" />
      </QueueSectionTrigger>

      <QueueSectionContent>
        <QueueList>
          <QueueItem v-for="message in messages" :key="message.id">
            <div class="flex items-center gap-2">
              <QueueItemIndicator />

              <QueueItemContent>
                {{
                  message.parts
                    .filter((p) => p.type === "text")
                    .map((p) => p.text)
                    .join(" ")
                    .trim() || "(queued message)"
                }}
              </QueueItemContent>

              <QueueItemActions v-if="!preview">
                <QueueItemAction
                  aria-label="Remove from queue"
                  title="Remove from queue"
                  @click.stop="handleRemoveMessage(message.id)"
                >
                  <Trash2 :size="12" />
                </QueueItemAction>

                <QueueItemAction
                  aria-label="Send now"
                  @click.stop="handleSendNow(message.id)"
                >
                  <ArrowUp :size="14" />
                </QueueItemAction>
              </QueueItemActions>
            </div>

            <QueueItemAttachment
              v-if="message.parts.some((p) => p.type === 'file' && p.url)"
            >
              <template
                v-for="file in message.parts.filter((p) => p.type === 'file' && p.url)"
                :key="file.url"
              >
                <QueueItemImage
                  v-if="file.mediaType?.startsWith('image/')"
                  :src="file.url"
                  :alt="file.filename || 'attachment'"
                />
                <QueueItemFile v-else>
                  {{ file.filename || "file" }}
                </QueueItemFile>
              </template>
            </QueueItemAttachment>
          </QueueItem>
        </QueueList>
      </QueueSectionContent>
    </QueueSection>

    <!-- Todos Section -->
    <QueueSection v-if="todos.length > 0" class="w-full">
      <QueueSectionTrigger>
        <QueueSectionLabel :count="todos.length" label="Todo" />
      </QueueSectionTrigger>

      <QueueSectionContent class="w-full">
        <QueueList :max-height="preview ? null : 'max-h-40'">
          <QueueItem v-for="todo in todos" :key="todo.id">
            <div class="flex items-center gap-2">
              <QueueItemIndicator :completed="todo.status === 'completed'" />

              <QueueItemContent :completed="todo.status === 'completed'">
                {{ todo.title }}
              </QueueItemContent>

              <QueueItemActions v-if="!preview">
                <QueueItemAction
                  aria-label="Remove todo"
                  @click="handleRemoveTodo(todo.id)"
                >
                  <Trash2 :size="12" />
                </QueueItemAction>
              </QueueItemActions>
            </div>

            <QueueItemDescription
              v-if="todo.description"
              :completed="todo.status === 'completed'"
            >
              {{ todo.description }}
            </QueueItemDescription>
          </QueueItem>
        </QueueList>
      </QueueSectionContent>
    </QueueSection>
  </Queue>
</template>
