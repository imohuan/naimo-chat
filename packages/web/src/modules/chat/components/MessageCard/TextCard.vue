<script setup lang="ts">
import { computed, onMounted, nextTick, watch, ref } from 'vue';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { useCollapseStore } from '../../stores/collapseStore';
import type { ChatMessage } from '@/types';

const props = defineProps<{
  item: ChatMessage;
}>();

const contentRef = ref<HTMLElement>();
const collapseStore = useCollapseStore();

const htmlContent = computed(() => {
  if (props.item.html) {
    return props.item.html;
  }
  if (props.item.rawText) {
    return marked.parse(props.item.rawText);
  }
  return '';
});

// 处理代码块，添加自定义工具栏和语法高亮
const processCodeBlocks = () => {
  nextTick(() => {
    if (!contentRef.value) return;

    const preElements = contentRef.value.querySelectorAll('pre');
    preElements.forEach((pre, index) => {
      // 避免重复处理
      if (pre.parentElement?.classList.contains('code-block-wrapper')) return;

      const code = pre.querySelector('code');
      if (!code) return;

      const codeText = code.textContent || '';

      // 应用语法高亮
      hljs.highlightElement(code as HTMLElement);

      // 获取语言类型
      let language = 'text';
      const classList = Array.from(code.classList);
      const langClass = classList.find(cls => cls.startsWith('language-'));
      if (langClass) {
        language = langClass.replace('language-', '');
      } else {
        // 从 hljs 高亮后的类名获取
        const hljsLangClass = classList.find(cls => cls !== 'hljs' && !cls.startsWith('hljs-'));
        if (hljsLangClass) {
          language = hljsLangClass;
        }
      }

      // 为每个代码块生成唯一 ID
      const codeBlockId = `${props.item.id}-code-${index}`;

      // 注册到 store
      collapseStore.registerItem(codeBlockId);

      // 创建包装容器
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      wrapper.dataset.codeBlockId = codeBlockId;

      // 创建工具栏
      const toolbar = document.createElement('div');
      toolbar.className = 'code-toolbar';

      // 语言标签
      const langLabel = document.createElement('span');
      langLabel.className = 'code-language';
      langLabel.textContent = language;

      // 复制按钮
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-btn copy-btn';
      copyBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>复制</span>
      `;
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(codeText);
          copyBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>已复制</span>
          `;
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>复制</span>
            `;
          }, 2000);
        } catch (err) {
          console.error('复制失败:', err);
        }
      };

      // 展开/折叠按钮
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'code-btn toggle-btn';

      const updateToggleBtn = () => {
        const isCollapsed = collapseStore.isCollapsed(codeBlockId);
        toggleBtn.innerHTML = isCollapsed ? `
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span>展开</span>
        ` : `
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          <span>折叠</span>
        `;
        pre.classList.toggle('collapsed', isCollapsed);
      };

      updateToggleBtn();

      toggleBtn.onclick = () => {
        collapseStore.toggleCollapse(codeBlockId);
        updateToggleBtn();
      };

      // 监听全局折叠状态变化
      const checkInterval = setInterval(() => {
        if (!document.body.contains(wrapper)) {
          clearInterval(checkInterval);
          return;
        }
        const currentCollapsed = collapseStore.isCollapsed(codeBlockId);
        const preCollapsed = pre.classList.contains('collapsed');
        if (currentCollapsed !== preCollapsed) {
          updateToggleBtn();
        }
      }, 100);

      // 组装工具栏
      toolbar.appendChild(langLabel);
      toolbar.appendChild(copyBtn);
      toolbar.appendChild(toggleBtn);

      // 替换原有的 pre 元素
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(toolbar);
      wrapper.appendChild(pre);
    });
  });
};

onMounted(() => {
  processCodeBlocks();
});

watch(() => props.item, () => {
  processCodeBlocks();
}, { deep: true });

// 监听全局折叠状态变化
watch(() => collapseStore.allCollapsed, () => {
  // 触发重新渲染按钮状态
  nextTick(() => {
    if (!contentRef.value) return;
    const wrappers = contentRef.value.querySelectorAll('.code-block-wrapper');
    wrappers.forEach((wrapper) => {
      const codeBlockId = (wrapper as HTMLElement).dataset.codeBlockId;
      if (codeBlockId) {
        const pre = wrapper.querySelector('pre');
        const isCollapsed = collapseStore.isCollapsed(codeBlockId);
        pre?.classList.toggle('collapsed', isCollapsed);
      }
    });
  });
});
</script>

<template>
  <div ref="contentRef" class="assistant-text text-slate-800" v-html="htmlContent"></div>
</template>

<style scoped>
.assistant-text :deep(p) {
  margin-bottom: 0.5rem;
}

/* 行内代码样式 */
.assistant-text :deep(code) {
  background-color: #f1f5f9;
  color: #e11d48;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  border: 1px solid #e2e8f0;
}

/* 代码块包装容器 */
.assistant-text :deep(.code-block-wrapper) {
  position: relative;
  margin: 0;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  overflow: hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

/* 代码工具栏 */
.assistant-text :deep(.code-toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background-color: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  gap: 0.5rem;
}

/* 语言标签 */
.assistant-text :deep(.code-language) {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}

/* 工具按钮 */
.assistant-text :deep(.code-btn) {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: #475569;
  background-color: white;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.assistant-text :deep(.code-btn:hover) {
  background-color: #f8fafc;
  border-color: #94a3b8;
  color: #1e293b;
}

.assistant-text :deep(.code-btn:active) {
  transform: scale(0.98);
}

.assistant-text :deep(.code-btn .icon) {
  width: 1rem;
  height: 1rem;
}

/* 代码块容器 - 亮色主题 */
.assistant-text :deep(.code-block-wrapper pre) {
  background-color: #f8fafc;
  border: none;
  padding: 1rem;
  border-radius: 0;
  overflow-x: auto;
  margin: 0;
  box-shadow: none;
  max-height: 500px;
  transition: max-height 0.3s ease;
}

.assistant-text :deep(.code-block-wrapper pre.collapsed) {
  max-height: 150px;
  overflow: hidden;
}

.assistant-text :deep(pre code) {
  background-color: transparent;
  padding: 0;
  border: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Highlight.js 亮色主题样式 */
.assistant-text :deep(.hljs) {
  display: block;
  overflow-x: auto;
  background: #f8fafc;
  color: #1e293b;
}

/* 关键字 */
.assistant-text :deep(.hljs-keyword),
.assistant-text :deep(.hljs-selector-tag),
.assistant-text :deep(.hljs-literal),
.assistant-text :deep(.hljs-section),
.assistant-text :deep(.hljs-link),
.assistant-text :deep(.hljs-tag) {
  color: #0369a1;
  font-weight: 600;
}

/* 字符串 */
.assistant-text :deep(.hljs-string),
.assistant-text :deep(.hljs-title),
.assistant-text :deep(.hljs-name),
.assistant-text :deep(.hljs-type),
.assistant-text :deep(.hljs-attribute),
.assistant-text :deep(.hljs-symbol),
.assistant-text :deep(.hljs-bullet),
.assistant-text :deep(.hljs-addition),
.assistant-text :deep(.hljs-variable),
.assistant-text :deep(.hljs-template-tag),
.assistant-text :deep(.hljs-template-variable) {
  color: #15803d;
}

/* 注释 */
.assistant-text :deep(.hljs-comment),
.assistant-text :deep(.hljs-quote),
.assistant-text :deep(.hljs-deletion),
.assistant-text :deep(.hljs-meta) {
  color: #64748b;
  font-style: italic;
}

/* 数字 */
.assistant-text :deep(.hljs-number),
.assistant-text :deep(.hljs-regexp),
.assistant-text :deep(.hljs-selector-id),
.assistant-text :deep(.hljs-selector-class) {
  color: #c026d3;
}

/* 函数名 */
.assistant-text :deep(.hljs-function),
.assistant-text :deep(.hljs-title.function_),
.assistant-text :deep(.hljs-params) {
  color: #0284c7;
}

/* 属性 */
.assistant-text :deep(.hljs-attr) {
  color: #0891b2;
}

/* 内置对象 */
.assistant-text :deep(.hljs-built_in),
.assistant-text :deep(.hljs-builtin-name) {
  color: #7c3aed;
}

/* 操作符 */
.assistant-text :deep(.hljs-operator) {
  color: #475569;
}

/* 强调 */
.assistant-text :deep(.hljs-emphasis) {
  font-style: italic;
}

/* 加粗 */
.assistant-text :deep(.hljs-strong) {
  font-weight: bold;
}

/* DOCTYPE */
.assistant-text :deep(.hljs-doctag) {
  color: #64748b;
}

/* 标签名 */
.assistant-text :deep(.hljs-name) {
  color: #0369a1;
}

/* 属性值 */
.assistant-text :deep(.hljs-attr) {
  color: #0891b2;
}
</style>
