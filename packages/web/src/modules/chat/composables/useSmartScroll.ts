import { ref, nextTick, type Ref } from 'vue'
import { useScroll } from '@vueuse/core'

export interface SmartScrollOptions {
  /**
   * 距离底部多少像素时认为"接近底部"
   * @default 100
   */
  threshold?: number
  /**
   * 是否使用平滑滚动
   * @default true
   */
  smooth?: boolean
}

export interface SmartScrollReturn {
  /**
   * 智能滚动到底部（只有在接近底部时才滚动）
   */
  smartScrollToBottom: (smooth?: boolean, threshold?: number) => void
  /**
   * 强制滚动到底部
   */
  scrollToBottom: (smooth?: boolean) => void
  /**
   * 滚动到顶部
   */
  scrollToTop: (smooth?: boolean) => void
  /**
   * 是否接近底部
   */
  isNearBottom: Ref<boolean>
  /**
   * 距离底部的距离
   */
  distanceFromBottom: Ref<number>
  /**
   * 距离顶部的距离
   */
  distanceFromTop: Ref<number>
}

/**
 * 智能滚动 Hook
 * 
 * 提供智能滚动功能，只在用户接近底部时自动滚动
 * 
 * @param el - 滚动容器元素
 * @param options - 配置选项
 * @returns 滚动控制方法和状态
 * 
 * @example
 * ```ts
 * const container = ref<HTMLElement>()
 * const { smartScrollToBottom, isNearBottom } = useSmartScroll(container)
 * 
 * // 添加新消息时智能滚动
 * onMessageAdded(() => {
 *   smartScrollToBottom()
 * })
 * ```
 */
export function useSmartScroll(
  el: Ref<HTMLElement | null | undefined>,
  options: SmartScrollOptions = {}
): SmartScrollReturn {
  const { threshold = 100, smooth = true } = options

  // 使用 VueUse 的 useScroll 监听滚动
  const { y, arrivedState } = useScroll(el, {
    throttle: 100
  })

  // 距离底部的距离
  const distanceFromBottom = ref(0)
  // 距离顶部的距离
  const distanceFromTop = ref(0)
  // 是否接近底部
  const isNearBottom = ref(false)

  // 计算滚动距离
  const updateScrollDistance = () => {
    if (!el.value) return

    const scrollTop = el.value.scrollTop
    const scrollHeight = el.value.scrollHeight
    const clientHeight = el.value.clientHeight

    distanceFromTop.value = scrollTop
    distanceFromBottom.value = scrollHeight - scrollTop - clientHeight
    isNearBottom.value = distanceFromBottom.value <= threshold
  }

  // 监听滚动位置变化
  const unwatch = () => {
    if (el.value) {
      el.value.removeEventListener('scroll', updateScrollDistance)
    }
  }

  // 添加滚动监听
  const watch = () => {
    if (el.value) {
      el.value.addEventListener('scroll', updateScrollDistance)
      updateScrollDistance() // 初始计算
    }
  }

  // 智能滚动到底部：只有在接近底部时才滚动
  const smartScrollToBottom = (
    smoothScroll: boolean = smooth,
    customThreshold: number = threshold
  ) => {
    nextTick(() => {
      if (!el.value) return

      const scrollTop = el.value.scrollTop
      const scrollHeight = el.value.scrollHeight
      const clientHeight = el.value.clientHeight
      const distance = scrollHeight - scrollTop - clientHeight

      // 只有当距离底部小于阈值时才滚动
      if (distance <= customThreshold) {
        el.value.scrollTo({
          top: scrollHeight,
          behavior: smoothScroll ? 'smooth' : 'auto'
        })
      }
    })
  }

  // 强制滚动到底部
  const scrollToBottom = (smoothScroll: boolean = smooth) => {
    nextTick(() => {
      if (!el.value) return

      el.value.scrollTo({
        top: el.value.scrollHeight,
        behavior: smoothScroll ? 'smooth' : 'auto'
      })
    })
  }

  // 滚动到顶部
  const scrollToTop = (smoothScroll: boolean = smooth) => {
    nextTick(() => {
      if (!el.value) return

      el.value.scrollTo({
        top: 0,
        behavior: smoothScroll ? 'smooth' : 'auto'
      })
    })
  }

  // 初始化监听
  watch()

  return {
    smartScrollToBottom,
    scrollToBottom,
    scrollToTop,
    isNearBottom,
    distanceFromBottom,
    distanceFromTop
  }
}
