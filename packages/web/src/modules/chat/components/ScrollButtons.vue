<template>
  <div class="scroll-buttons">
    <button
      v-show="showScrollTop"
      @click="handleScrollToTop"
      class="scroll-btn scroll-btn-top"
      title="回到顶部"
      aria-label="回到顶部"
    >
      <i class="fa-solid fa-chevron-up"></i>
    </button>
    <button
      v-show="showScrollBottom"
      @click="handleScrollToBottom"
      class="scroll-btn scroll-btn-bottom"
      title="回到底部"
      aria-label="回到底部"
    >
      <i class="fa-solid fa-chevron-down"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useScroll } from '@vueuse/core'

interface Props {
  /**
   * 滚动容器的 ID 或 class
   */
  containerId?: string
  /**
   * 滚动容器元素引用
   */
  containerRef?: HTMLElement | null
  /**
   * 距离顶部/底部多少像素时显示按钮
   * @default 100
   */
  threshold?: number
}

const props = withDefaults(defineProps<Props>(), {
  threshold: 100
})

// 状态
const showScrollTop = ref(false)
const showScrollBottom = ref(false)
const container = ref<HTMLElement | null>(null)

// 获取容器元素
const getContainer = (): HTMLElement | null => {
  if (props.containerRef) {
    return props.containerRef
  }

  if (props.containerId) {
    // 尝试通过 class 查找
    const byClass = document.querySelector(`.${props.containerId}`)
    if (byClass instanceof HTMLElement) {
      return byClass
    }

    // 尝试通过 ID 查找
    const byId = document.getElementById(props.containerId)
    if (byId) {
      return byId
    }
  }

  return null
}

// 使用 VueUse 的 useScroll
const { y, arrivedState } = useScroll(container, {
  throttle: 100
})

// 处理滚动事件
const handleScroll = () => {
  if (!container.value) return

  const { scrollTop, scrollHeight, clientHeight } = container.value
  const distanceFromTop = scrollTop
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight

  // 显示回到顶部按钮：不在顶部时
  showScrollTop.value = distanceFromTop > props.threshold

  // 显示回到底部按钮：不在底部时
  showScrollBottom.value = distanceFromBottom > props.threshold
}

// 滚动到顶部
const handleScrollToTop = () => {
  if (container.value) {
    container.value.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }
}

// 滚动到底部
const handleScrollToBottom = () => {
  if (container.value) {
    container.value.scrollTo({
      top: container.value.scrollHeight,
      behavior: 'smooth'
    })
  }
}

// 生命周期
onMounted(() => {
  container.value = getContainer()

  if (container.value) {
    container.value.addEventListener('scroll', handleScroll)
    handleScroll() // 初始检查
  } else {
    console.warn('[ScrollButtons] Container not found:', props.containerId)
  }
})

onBeforeUnmount(() => {
  if (container.value) {
    container.value.removeEventListener('scroll', handleScroll)
  }
})

// 监听容器引用变化
watch(() => props.containerRef, (newRef) => {
  if (newRef) {
    // 移除旧的监听器
    if (container.value) {
      container.value.removeEventListener('scroll', handleScroll)
    }

    // 设置新容器
    container.value = newRef
    container.value.addEventListener('scroll', handleScroll)
    handleScroll()
  }
})
</script>

<style scoped>
.scroll-buttons {
  position: fixed;
  right: 2rem;
  bottom: 8rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 100;
}

.scroll-btn {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: #666;
}

.scroll-btn:hover {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #333;
  transform: translateY(-2px);
}

.scroll-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.scroll-btn i {
  font-size: 1rem;
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  .scroll-btn {
    background: rgba(40, 40, 40, 0.9);
    color: #ccc;
  }

  .scroll-btn:hover {
    background: #333;
    color: #fff;
  }
}
</style>
