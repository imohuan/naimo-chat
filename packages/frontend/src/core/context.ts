import { useMessage, useDialog, useLoadingBar } from "naive-ui";
import type { MessageApi, DialogApi, LoadingBarApi } from "naive-ui";
import mitt, { type Emitter } from "mitt";
import type { Events } from "../typings/events";
import { useToasts } from "../hooks/useToasts";
import type { ToastItem } from "../interface";

/**
 * Toast API 接口
 * 提供统一的 Toast 通知能力
 */
export interface ToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

/**
 * 全局上下文接口
 * 提供统一的消息提示、通知、弹窗等能力
 */
export interface GlobalContext {
  /** 消息提示（轻量级，自动消失） */
  message: MessageApi;
  /** Toast 通知（使用 ToastList 组件） */
  notify: ToastApi;
  /** 对话框（确认、警告等） */
  dialog: DialogApi;
  /** 加载条（顶部进度条） */
  loadingBar: LoadingBarApi;
  /** 事件总线（用于组件间通信） */
  eventBus: Emitter<Events>;
  /** Toast 列表（供组件使用） */
  toasts: { value: ToastItem[] };
  /** 移除 Toast */
  removeToast: (id: number) => void;
}

// 全局事件总线实例
const eventBus = mitt<Events>();

// 全局 context 实例
let contextInstance: GlobalContext | null = null;

/**
 * 初始化全局 context
 * 必须在 App 组件中调用，确保 naive-ui 的 composables 可用
 */
export function initContext(): GlobalContext {
  if (contextInstance) {
    return contextInstance;
  }

  const message = useMessage();
  const dialog = useDialog();
  const loadingBar = useLoadingBar();
  const { toasts, pushToast, removeToast } = useToasts();

  // 创建 Toast API
  const notify: ToastApi = {
    success: (message: string, duration = 3000) => {
      pushToast(message, "success", duration);
    },
    error: (message: string, duration = 3000) => {
      pushToast(message, "error", duration);
    },
    warning: (message: string, duration = 3000) => {
      pushToast(message, "info", duration); // ToastItem 只有 success/error/info，warning 使用 info
    },
    info: (message: string, duration = 3000) => {
      pushToast(message, "info", duration);
    },
  };

  contextInstance = {
    message,
    notify,
    dialog,
    loadingBar,
    eventBus,
    toasts,
    removeToast,
  };

  return contextInstance;
}

/**
 * 获取全局 context
 * 如果未初始化，会抛出错误
 */
export function getContext(): GlobalContext {
  if (!contextInstance) {
    throw new Error("Context 未初始化，请确保在 App 组件中调用 initContext()");
  }
  return contextInstance;
}

/**
 * 便捷方法：显示成功消息
 */
export function showSuccess(content: string, duration = 3000) {
  return getContext().message.success(content, { duration });
}

/**
 * 便捷方法：显示错误消息
 */
export function showError(content: string, duration = 3000) {
  return getContext().message.error(content, { duration });
}

/**
 * 便捷方法：显示警告消息
 */
export function showWarning(content: string, duration = 3000) {
  return getContext().message.warning(content, { duration });
}

/**
 * 便捷方法：显示信息消息
 */
export function showInfo(content: string, duration = 3000) {
  return getContext().message.info(content, { duration });
}

/**
 * 便捷方法：显示加载消息
 */
export function showLoading(content: string, duration = 3000) {
  return getContext().message.loading(content, { duration });
}

/**
 * 便捷方法：显示成功通知
 */
export function notifySuccess(message: string, duration = 3000) {
  getContext().notify.success(message, duration);
}

/**
 * 便捷方法：显示错误通知
 */
export function notifyError(message: string, duration = 3000) {
  getContext().notify.error(message, duration);
}

/**
 * 便捷方法：显示警告通知
 */
export function notifyWarning(message: string, duration = 3000) {
  getContext().notify.warning(message, duration);
}

/**
 * 便捷方法：显示信息通知
 */
export function notifyInfo(message: string, duration = 3000) {
  getContext().notify.info(message, duration);
}

/**
 * 便捷方法：确认对话框
 */
export function confirmDialog(
  title: string,
  content: string,
  onConfirm?: () => void | Promise<void>,
  onCancel?: () => void,
) {
  const dialog = getContext().dialog;
  dialog.warning({
    title,
    content,
    positiveText: "确认",
    negativeText: "取消",
    onPositiveClick: onConfirm,
    onNegativeClick: onCancel,
  });
}

/**
 * 便捷方法：警告对话框
 */
export function warningDialog(title: string, content: string, onConfirm?: () => void | Promise<void>) {
  const dialog = getContext().dialog;
  dialog.warning({
    title,
    content,
    positiveText: "确定",
    onPositiveClick: onConfirm,
  });
}

/**
 * 便捷方法：错误对话框
 */
export function errorDialog(title: string, content: string, onConfirm?: () => void | Promise<void>) {
  const dialog = getContext().dialog;
  dialog.error({
    title,
    content,
    positiveText: "确定",
    onPositiveClick: onConfirm,
  });
}

/**
 * 便捷方法：信息对话框
 */
export function infoDialog(title: string, content: string, onConfirm?: () => void | Promise<void>) {
  const dialog = getContext().dialog;
  dialog.info({
    title,
    content,
    positiveText: "确定",
    onPositiveClick: onConfirm,
  });
}

// 导出 context 实例（供高级用法）
export { contextInstance };

/**
 * 全局事件总线
 * 用于组件间通信
 */
export { eventBus };
