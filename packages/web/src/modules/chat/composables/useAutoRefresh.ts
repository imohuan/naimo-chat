import { ref, computed } from 'vue'
import { useIntervalFn } from '@vueuse/core'

/**
 * 自动刷新配置选项
 */
export interface AutoRefreshOptions {
  /**
   * 刷新间隔（毫秒）
   * @default 5000
   */
  interval?: number

  /**
   * 是否在初始化时立即启动
   * @default false
   */
  immediate?: boolean

  /**
   * 刷新回调函数
   */
  onRefresh?: () => void | Promise<void>
}

/**
 * 自动刷新 Hook
 * 
 * 提供自动刷新功能，支持启动/停止、可配置刷新间隔
 * 
 * @param options - 配置选项
 * @returns 自动刷新控制对象
 * 
 * @example
 * ```ts
 * const { isActive, start, stop, toggle } = useAutoRefresh({
 *   interval: 5000,
 *   onRefresh: async () => {
 *     await fetchMessages()
 *   }
 * })
 * 
 * // 启动自动刷新
 * start()
 * 
 * // 停止自动刷新
 * stop()
 * 
 * // 切换自动刷新状态
 * toggle()
 * ```
 */
export function useAutoRefresh(options: AutoRefreshOptions = {}) {
  const {
    interval = 5000,
    immediate = false,
    onRefresh
  } = options

  // 是否正在刷新
  const isRefreshing = ref(false)

  // 刷新处理函数
  const handleRefresh = async () => {
    if (isRefreshing.value) {
      console.log('[AutoRefresh] 跳过刷新：上一次刷新尚未完成')
      return
    }

    try {
      isRefreshing.value = true
      console.log('[AutoRefresh] 开始刷新...')

      if (onRefresh) {
        await onRefresh()
      }

      console.log('[AutoRefresh] 刷新完成')
    } catch (error) {
      console.error('[AutoRefresh] 刷新失败:', error)
    } finally {
      isRefreshing.value = false
    }
  }

  // 使用 VueUse 的 useIntervalFn
  const { isActive, pause, resume } = useIntervalFn(
    handleRefresh,
    interval,
    { immediate }
  )

  /**
   * 启动自动刷新
   */
  const start = () => {
    console.log('[AutoRefresh] 启动自动刷新')
    resume()
  }

  /**
   * 停止自动刷新
   */
  const stop = () => {
    console.log('[AutoRefresh] 停止自动刷新')
    pause()
  }

  /**
   * 切换自动刷新状态
   */
  const toggle = () => {
    if (isActive.value) {
      stop()
    } else {
      start()
    }
  }

  /**
   * 手动触发一次刷新
   */
  const refresh = async () => {
    console.log('[AutoRefresh] 手动触发刷新')
    await handleRefresh()
  }

  return {
    /**
     * 是否正在自动刷新
     */
    isActive: computed(() => isActive.value),

    /**
     * 是否正在执行刷新操作
     */
    isRefreshing: computed(() => isRefreshing.value),

    /**
     * 启动自动刷新
     */
    start,

    /**
     * 停止自动刷新
     */
    stop,

    /**
     * 切换自动刷新状态
     */
    toggle,

    /**
     * 手动触发一次刷新
     */
    refresh
  }
}
