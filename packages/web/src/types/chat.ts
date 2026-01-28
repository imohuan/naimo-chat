/**
 * 聊天模块类型定义
 * 
 * 包含所有聊天相关的 TypeScript 类型定义
 */

/**
 * 消息角色
 */
export type MessageRole = 'user' | 'assistant'

/**
 * 消息类型
 */
export type MessageKind =
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'permission_request'
  | 'subagent'
  | 'todo'
  | 'error'

/**
 * 工具类型
 */
export type ToolType =
  | 'bash'
  | 'write'
  | 'read'
  | 'search'
  | 'list'
  | 'delete'
  | 'other'

/**
 * TODO 状态
 */
export type TodoStatus = 'completed' | 'in_progress' | 'pending'

/**
 * 基础消息接口
 */
export interface BaseMessage {
  /**
   * 消息 ID
   */
  id: string

  /**
   * 消息角色
   */
  role: MessageRole

  /**
   * 消息类型
   */
  kind: MessageKind

  /**
   * 时间戳
   */
  timestamp?: number

  /**
   * 是否折叠
   */
  isCollapsed?: boolean
}

/**
 * 文本消息
 */
export interface TextMessage extends BaseMessage {
  kind: 'text'

  /**
   * 文本内容
   */
  text: string
}

/**
 * 工具调用项
 */
export interface ToolCallItem extends BaseMessage {
  kind: 'tool_use'

  /**
   * 工具使用 ID
   */
  tool_use_id: string

  /**
   * 工具名称
   */
  name: string

  /**
   * 工具类型
   */
  type?: ToolType

  /**
   * 工具输入参数
   */
  input: Record<string, any>

  /**
   * 工具执行结果
   */
  result?: string

  /**
   * 是否有错误
   */
  is_error?: boolean

  /**
   * 错误信息
   */
  error?: string

  /**
   * Diff 内容（用于 write 工具）
   */
  diff?: string

  /**
   * 是否折叠
   */
  isCollapsed?: boolean
}

/**
 * 工具结果项
 */
export interface ToolResultItem extends BaseMessage {
  kind: 'tool_result'

  /**
   * 工具使用 ID
   */
  tool_use_id: string

  /**
   * 结果内容
   */
  content: string

  /**
   * 是否有错误
   */
  is_error?: boolean
}

/**
 * 权限请求项
 */
export interface PermissionRequest extends BaseMessage {
  kind: 'permission_request'

  /**
   * 权限请求 ID
   */
  permission_id: string

  /**
   * 工具名称
   */
  tool_name: string

  /**
   * 工具输入参数
   */
  tool_input: Record<string, any>

  /**
   * 请求消息
   */
  message?: string

  /**
   * 是否已批准
   */
  approved?: boolean

  /**
   * 是否已拒绝
   */
  denied?: boolean
}

/**
 * 子代理项
 */
export interface SubagentItem extends BaseMessage {
  kind: 'subagent'

  /**
   * 工具使用 ID（用于关联子代理消息）
   */
  tool_use_id: string

  /**
   * 子代理名称
   */
  name: string

  /**
   * 子代理描述
   */
  description?: string

  /**
   * 子代理类型
   */
  type?: string

  /**
   * 子代理提示
   */
  prompt?: string

  /**
   * 子代理消息列表
   */
  subagentMessages?: ChatMessage[]

  /**
   * 执行结果
   */
  result?: string

  /**
   * 是否有错误
   */
  is_error?: boolean

  /**
   * 错误信息
   */
  error?: string

  /**
   * 是否折叠
   */
  isCollapsed?: boolean
}

/**
 * TODO 项
 */
export interface TodoItem extends BaseMessage {
  kind: 'todo'

  /**
   * TODO 列表
   */
  todos: Array<{
    /**
     * TODO ID
     */
    id: string

    /**
     * TODO 文本
     */
    text: string

    /**
     * TODO 状态
     */
    status: TodoStatus

    /**
     * 活动文件
     */
    activeFile?: string
  }>

  /**
   * 是否折叠
   */
  isCollapsed?: boolean
}

/**
 * 错误消息
 */
export interface ErrorMessage extends BaseMessage {
  kind: 'error'

  /**
   * 错误信息
   */
  error: string

  /**
   * 错误详情
   */
  details?: string
}

/**
 * 聊天消息（联合类型）
 */
export type ChatMessage =
  | TextMessage
  | ToolCallItem
  | ToolResultItem
  | PermissionRequest
  | SubagentItem
  | TodoItem
  | ErrorMessage

/**
 * 消息分组
 */
export interface MessageGroup {
  /**
   * 分组 ID
   */
  id: string

  /**
   * 消息角色
   */
  role: MessageRole

  /**
   * 消息列表
   */
  items: ChatMessage[]

  /**
   * 时间戳
   */
  timestamp: number

  /**
   * 是否折叠
   */
  isCollapsed?: boolean
}

/**
 * 图片预览
 */
export interface ImagePreview {
  /**
   * 图片 ID
   */
  id: string

  /**
   * 图片 URL（Data URL）
   */
  url: string

  /**
   * 文件名
   */
  name: string

  /**
   * 文件大小（字节）
   */
  size: number

  /**
   * MIME 类型
   */
  type: string

  /**
   * 原始文件对象
   */
  file: File
}

/**
 * 聊天会话
 */
export interface ChatSession {
  /**
   * 会话 ID
   */
  id: string

  /**
   * 会话标题
   */
  title: string

  /**
   * 创建时间
   */
  createdAt: number

  /**
   * 更新时间
   */
  updatedAt: number

  /**
   * 消息数量
   */
  messageCount: number
}

/**
 * 流事件类型
 */
export type StreamEventType =
  | 'message'
  | 'content'
  | 'content_block_delta'
  | 'assistant'
  | 'user'
  | 'tool_use'
  | 'tool_result'
  | 'permission_request'
  | 'permission_decision'
  | 'subagent_message'
  | 'error'
  | 'process_end'
  | 'aborted'

/**
 * 流事件数据
 */
export interface StreamEvent {
  /**
   * 事件类型
   */
  type: StreamEventType

  /**
   * 事件数据
   */
  data: any

  /**
   * 会话 ID
   */
  sessionId?: string
}

/**
 * 发送消息选项
 */
export interface SendMessageOptions {
  /**
   * 消息文本
   */
  message: string

  /**
   * 会话 ID
   */
  sessionId?: string

  /**
   * 图片列表
   */
  images?: ImagePreview[]

  /**
   * 工作目录
   */
  cwd?: string

  /**
   * 是否流式响应
   */
  stream?: boolean
}

/**
 * 权限决策
 */
export interface PermissionDecision {
  /**
   * 权限请求 ID
   */
  permission_id: string

  /**
   * 是否批准
   */
  approved: boolean

  /**
   * 拒绝原因（如果拒绝）
   */
  reason?: string
}

/**
 * 聊天状态
 */
export interface ChatState {
  /**
   * 当前会话 ID
   */
  sessionId: string | null

  /**
   * 消息列表
   */
  messages: ChatMessage[]

  /**
   * 是否正在加载
   */
  isLoading: boolean

  /**
   * 是否正在发送
   */
  isSending: boolean

  /**
   * 错误信息
   */
  error: string | null

  /**
   * 上传的图片
   */
  uploadedImages: ImagePreview[]

  /**
   * 当前工作目录
   */
  currentCwd: string

  /**
   * 可用的工作目录列表
   */
  availableCwds: string[]
}

/**
 * 子代理视图状态
 */
export interface SubagentViewState {
  /**
   * 是否激活
   */
  active: boolean

  /**
   * 子代理消息列表
   */
  messages: ChatMessage[]

  /**
   * 子代理描述
   */
  description: string

  /**
   * 滚动位置
   */
  scrollPosition: number

  /**
   * 是否全部折叠
   */
  allCollapsed: boolean
}

/**
 * 自动刷新配置
 */
export interface AutoRefreshConfig {
  /**
   * 是否启用
   */
  enabled: boolean

  /**
   * 刷新间隔（毫秒）
   */
  interval: number

  /**
   * 是否正在刷新
   */
  isRefreshing: boolean
}
