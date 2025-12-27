import type { ChatMessage } from "@/interface";
import type { MessageType } from "../useChatConversations";

/**
 * UI 状态接口
 */
export interface ModeUIState {
  /** 是否显示画布（ImmersiveCode） */
  showCanvas: boolean;
  /** 是否使用网络搜索 */
  useWebSearch: boolean;
  /** 是否使用麦克风 */
  useMicrophone: boolean;
}

/**
 * ImmersiveCode 组件引用接口
 * 用于在模式处理器中调用 ImmersiveCode 的方法
 */
export interface ImmersiveCodeRef {
  /** 获取当前代码 */
  getCurrentCode: () => string;
  /** 获取上一个版本的代码 */
  getPreviousVersionCode?: () => string;
  /** 开始流式写入模式 */
  startStreaming: () => void;
  /** 流式写入代码 */
  streamWrite: (code: string) => void;
  /** 结束流式写入模式 */
  endStreaming: () => void;
  /** 设置代码并选中行 */
  setCodeAndSelectLines?: (code: string, startLine: number, endLine: number) => void;
  /** 在预览模式中选中元素 */
  selectElementInPreview?: (selector: string) => void;
  /** 添加主要版本 */
  addMajorVersion?: (code?: string, label?: string) => void;
}

/**
 * 模式上下文接口
 * 包含模式处理器需要的所有上下文信息
 */
export interface ModeContext {
  /** 当前对话的消息历史 */
  messages: MessageType[];
  /** 当前用户输入内容 */
  currentUserInput: string;
  /** 当前编辑器中的代码（如果存在） */
  editorCode?: string;
  /** UI 状态 */
  uiState: ModeUIState;
  /** ImmersiveCode 组件引用（如果存在） */
  immersiveCodeRef?: ImmersiveCodeRef | null;
  /** 用户上传的文件 */
  files?: Array<{ url?: string; filename?: string; mediaType?: string }>;
  /** 更新 showCanvas 的回调函数 */
  onShowCanvasChange?: (show: boolean) => void;
  /** 更新只读状态的回调函数 */
  onReadonlyChange?: (readonly: boolean) => void;
}

/**
 * 对话模式处理器接口
 * 每个模式需要实现此接口以提供自定义的行为
 */
export interface ConversationModeHandler {
  /** 模式标识符 */
  mode: string;

  /**
   * 获取系统提示词
   * @param context 模式上下文
   * @returns 系统提示词消息数组
   */
  getSystemPrompt(context: ModeContext): ChatMessage[];

  /**
   * 构建发送给 LLM 的完整消息数组
   * 包含系统提示词、历史消息、上下文信息（如编辑器代码）等
   * @param context 模式上下文
   * @returns 完整的消息数组
   */
  buildMessages(context: ModeContext): ChatMessage[];

  /**
   * 处理流式响应的每个 chunk
   * 可以解析内容、执行副作用（如更新编辑器），并返回用于显示的内容
   * @param chunk 当前接收到的流式数据块（累积内容）
   * @param context 模式上下文
   * @returns 用于在消息中显示的内容
   */
  handleStreamResponse(chunk: string, context: ModeContext): string;

  /**
   * 提交前的钩子函数
   * 用于在发送消息前执行一些操作，如调整 UI 状态、初始化流式写入等
   * @param context 模式上下文
   */
  onBeforeSubmit(context: ModeContext): Promise<void>;

  /**
   * 提交后的钩子函数
   * 用于在接收到完整响应后执行一些操作，如结束流式写入、清理状态等
   * @param context 模式上下文
   * @param fullResponse 完整的响应内容
   */
  onAfterSubmit(context: ModeContext, fullResponse: string): Promise<void>;

  /**
   * 判断是否应该显示画布（ImmersiveCode）组件
   * @returns 是否显示画布
   */
  shouldShowCanvas(): boolean;
}

