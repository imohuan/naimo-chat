import { ref, computed } from 'vue'

/**
 * 图片预览数据接口
 */
export interface ImagePreview {
  id: string
  src: string
  name: string
}

/**
 * 图片预览 Hook
 * 
 * 管理输入框中的图片预览功能
 * 
 * @example
 * ```ts
 * const { images, addImage, removeImage, clearImages, openViewer } = useImagePreview()
 * 
 * // 添加图片
 * const handleFileSelect = (file: File) => {
 *   addImage(file)
 * }
 * 
 * // 删除图片
 * const handleRemove = (id: string) => {
 *   removeImage(id)
 * }
 * 
 * // 打开查看器
 * const handlePreview = (src: string) => {
 *   openViewer(src)
 * }
 * ```
 */
export function useImagePreview() {
  // State
  const images = ref<ImagePreview[]>([])
  const viewerVisible = ref(false)
  const viewerSrc = ref('')

  // Computed
  const hasImages = computed(() => images.value.length > 0)
  const imageCount = computed(() => images.value.length)

  /**
   * 添加图片预览
   * @param file - 图片文件
   */
  const addImage = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('只能上传图片文件'))
        return
      }

      const reader = new FileReader()

      reader.onload = (e) => {
        const imageData: ImagePreview = {
          id: Math.random().toString(36).substr(2, 9),
          src: e.target?.result as string,
          name: file.name
        }
        images.value.push(imageData)
        resolve()
      }

      reader.onerror = () => {
        reject(new Error('读取图片失败'))
      }

      reader.readAsDataURL(file)
    })
  }

  /**
   * 批量添加图片
   * @param files - 图片文件列表
   */
  const addImages = async (files: File[]): Promise<void> => {
    const promises = files
      .filter(file => file.type.startsWith('image/'))
      .map(file => addImage(file))

    await Promise.all(promises)
  }

  /**
   * 删除图片预览
   * @param imageId - 图片 ID
   */
  const removeImage = (imageId: string) => {
    images.value = images.value.filter(img => img.id !== imageId)
  }

  /**
   * 清空所有图片预览
   */
  const clearImages = () => {
    images.value = []
  }

  /**
   * 打开图片查看器
   * @param src - 图片源地址
   */
  const openViewer = (src: string) => {
    viewerSrc.value = src
    viewerVisible.value = true
  }

  /**
   * 关闭图片查看器
   */
  const closeViewer = () => {
    viewerVisible.value = false
    viewerSrc.value = ''
  }

  /**
   * 获取图片的 Base64 数据（用于发送）
   */
  const getImageData = () => {
    return images.value.map(img => ({
      src: img.src,
      name: img.name
    }))
  }

  /**
   * 处理粘贴事件
   * @param event - 粘贴事件
   */
  const handlePaste = async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.includes('image')) {
        const file = item.getAsFile()
        if (file) {
          files.push(file)
        }
      }
    }

    if (files.length > 0) {
      await addImages(files)
    }
  }

  /**
   * 处理文件选择事件
   * @param event - 文件选择事件
   */
  const handleFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const files = target.files
    if (!files || files.length === 0) return

    await addImages(Array.from(files))

    // 清空 input 值，允许重复选择同一文件
    target.value = ''
  }

  /**
   * 处理拖放事件
   * @param event - 拖放事件
   */
  const handleDrop = async (event: DragEvent) => {
    event.preventDefault()
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return

    await addImages(Array.from(files))
  }

  return {
    // State
    images,
    viewerVisible,
    viewerSrc,

    // Computed
    hasImages,
    imageCount,

    // Methods
    addImage,
    addImages,
    removeImage,
    clearImages,
    openViewer,
    closeViewer,
    getImageData,

    // Event handlers
    handlePaste,
    handleFileSelect,
    handleDrop
  }
}
