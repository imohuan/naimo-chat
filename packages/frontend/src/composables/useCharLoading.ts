import { ref, computed, readonly, type Ref, watch } from 'vue'

// 字符加载hooks
export function useCharLoading<T>(
  source: Ref<T[]>,
  getCharCount: (item: T) => number,
  options: {
    initialChars?: number
    loadMoreChars?: number
  } = {}
) {
  const {
    initialChars = 2000, // 初始加载2000字符
    loadMoreChars = 1000  // 每次加载1000字符
  } = options

  // 最后加载的索引位置
  const lastIndex = ref(-1)
  // 加载状态
  const isLoading = ref(false)

  const getVisibleStartIndex = (startIndex: number, visibleCount = loadMoreChars) => {
    let currentCharCount = 0
    const result: T[] = []
    let currentIndex = -1

    for (let i = startIndex; i < source.value.length; i++) {
      const item = source.value[i]!
      const charCount = getCharCount(item)

      // 如果当前项目超出字符限制，并且已经有至少一个项目，则停止
      if (currentCharCount + charCount > visibleCount && result.length > 0) {
        break
      }

      result.push(item)
      currentCharCount += charCount
      currentIndex = i
    }

    if (currentIndex === -1) return startIndex
    return currentIndex + 1
  }

  // 计算可见项目（基于字符限制）
  const visibleItems = computed(() => {
    if (lastIndex.value === -1) lastIndex.value = getVisibleStartIndex(0, initialChars)
    return source.value.slice(0, lastIndex.value)
  })

  // 重置加载状态
  function reset() {
    lastIndex.value = -1
    // lastIndex.value = 999999999
  }

  // 加载更多
  async function loadMore() {
    if (isLoading.value || lastIndex.value >= source.value.length) return
    isLoading.value = true
    await new Promise(resolve => setTimeout(resolve, 100))
    lastIndex.value = getVisibleStartIndex(lastIndex.value + 1, loadMoreChars)
    isLoading.value = false
  }

  // 是否还有更多内容
  const hasMore = computed(() => lastIndex.value < source.value.length)

  // 下次加载的字符数
  const nextLoadChars = computed(() =>
    Math.min(loadMoreChars, source.value.length - lastIndex.value)
  )

  return {
    lastIndex,
    visibleItems,
    isLoading: readonly(isLoading),
    hasMore,
    nextLoadChars,
    loadMore,
    reset
  }
}