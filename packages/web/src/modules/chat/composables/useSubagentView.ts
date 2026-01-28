import { ref, computed, nextTick } from 'vue'
import { useCollapseStore } from '../stores/collapseStore'
import type { ChatMessage } from '@/types/chat'

/**
 * 子代理视图状态接口
 */
export interface SubagentViewState {
  /** 是否激活子代理视图 */
  active: boolean
  /** 子代理消息列表 */
  messages: ChatMessage[]
  /** 子代理描述 */
  description: string
  /** 保存的滚动位置 */
  scrollPosition: number
  /** 是否全部折叠 */
  allCollapsed: boolean
}

/**
 * 子代理视图 Hook
 * 
 * 管理子代理视图的状态和操作
 * 
 * @example
 * ```ts
 * const {
 *   isActive,
 *   messages,
 *   description,
 *   allCollapsed,
 *   openSubagent,
 *   closeSubagent,
 *   toggleAllCollapse
 * } = useSubagentView()
 * 
 * // 打开子代理视图
 * openSubagent(subagentItem)
 * 
 * // 关闭子代理视图
 * closeSubagent()
 * 
 * // 切换全部折叠/展开
 * toggleAllCollapse()
 * ```
 */
export function useSubagentView() {
  // 使用 Pinia collapse store
  const collapseStore = useCollapseStore()

  // 子代理视图状态
  const state = ref<SubagentViewState>({
    active: false,
    messages: [],
    description: '',
    scrollPosition: 0,
    allCollapsed: false
  })

  // 计算属性
  const isActive = computed(() => state.value.active)
  const messages = computed(() => state.value.messages)
  const description = computed(() => state.value.description)
  const allCollapsed = computed(() => state.value.allCollapsed)
  const messageCount = computed(() => state.value.messages.length)

  /**
   * 打开子代理视图
   * @param item - 子代理项
   */
  const openSubagent = (item: any) => {
    // 保存当前滚动位置
    const container = document.getElementById('chat-container')
    if (container) {
      state.value.scrollPosition = container.scrollTop
    }

    // 设置子代理视图数据
    state.value.active = true
    state.value.messages = item.subagentMessages || []
    state.value.description = item.input?.description || item.input?.prompt || 'Subagent Task'

    // 注册所有子代理消息中可折叠的项到 collapse store
    state.value.messages.forEach((msg: any) => {
      if (msg.kind === 'tool' || msg.kind === 'subagent' || msg.kind === 'todo_list') {
        collapseStore.registerItem(msg.id)
      }
    })

    // 打开子代理视图后滚动到底部
    nextTick(() => {
      const subagentContainer = document.getElementById('subagent-messages-container')
      if (subagentContainer) {
        subagentContainer.scrollTo({
          top: subagentContainer.scrollHeight,
          behavior: 'auto'
        })
      }
    })
  }

  /**
   * 关闭子代理视图
   */
  const closeSubagent = () => {
    state.value.active = false
    state.value.messages = []
    state.value.description = ''

    // 恢复滚动位置
    nextTick(() => {
      const container = document.getElementById('chat-container')
      if (container) {
        container.scrollTop = state.value.scrollPosition
      }
    })
  }

  /**
   * 切换全部折叠/展开
   */
  const toggleAllCollapse = () => {
    const newCollapsedState = !state.value.allCollapsed
    state.value.allCollapsed = newCollapsedState

    // 先确保所有可折叠项目都已注册
    state.value.messages.forEach((item: any) => {
      if (item.kind === 'tool' || item.kind === 'subagent' || item.kind === 'todo_list') {
        collapseStore.registerItem(item.id)
      }
    })

    // 使用 collapse store 设置全部折叠状态
    collapseStore.setAllCollapsed(newCollapsedState)
  }

  /**
   * 获取项的折叠状态
   * @param itemId - 项 ID
   * @returns 是否折叠
   */
  const isCollapsed = (itemId: string): boolean => {
    return collapseStore.isCollapsed(itemId)
  }

  /**
   * 切换项的折叠状态
   * @param itemId - 项 ID
   */
  const toggleCollapse = (itemId: string) => {
    collapseStore.toggleCollapse(itemId)
  }

  return {
    // 状态
    isActive,
    messages,
    description,
    allCollapsed,
    messageCount,

    // 方法
    openSubagent,
    closeSubagent,
    toggleAllCollapse,
    isCollapsed,
    toggleCollapse
  }
}
