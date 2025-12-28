import { createApp } from "vue";
import "./style.css";
import "streamdown-vue/style.css";
// 引入 vfonts 字体
// import "vfonts/Lato.css";
// import "vfonts/FiraCode.css";

import App from "./App.vue";
import { createPinia } from "pinia";
import { router } from "./router.ts";
import { logger, setLoggerConfig } from "./core/logger";

const app = createApp(App);
const pinia = createPinia();

// 配置日志
setLoggerConfig({
  enabled: import.meta.env.DEV,
  reportEnabled: !import.meta.env.DEV,
  env: import.meta.env.MODE,
});

// Vue 错误处理
// app.config.errorHandler = (err: unknown, instance: unknown, info: string) => {
//   const error = err instanceof Error ? err : new Error(String(err));
//   logger.error(`Vue 错误: ${info}`, error, {
//     component: instance,
//     errorInfo: info,
//   });
// };

// // 全局错误处理
// window.onerror = (
//   message: string | Event,
//   source?: string,
//   lineno?: number,
//   colno?: number,
//   error?: Error
// ) => {
//   const errorMessage = typeof message === "string" ? message : message.type;
//   const errorObj = error || new Error(errorMessage);

//   logger.error(`全局错误: ${errorMessage}`, errorObj, {
//     source,
//     lineno,
//     colno,
//   });

//   // 返回 false 以允许默认错误处理
//   return false;
// };

// // 未捕获的 Promise 错误
// window.addEventListener("unhandledrejection", (event) => {
//   const error =
//     event.reason instanceof Error ? event.reason : new Error(String(event.reason));

//   logger.error(`未捕获的 Promise 错误: ${event.reason}`, error, {
//     promise: event.promise,
//   });

//   // 阻止默认行为（可选）
//   // event.preventDefault();
// });

app.use(pinia);
app.use(router);

app.mount("#app");

// 启动日志
logger.info("应用已启动", {
  env: import.meta.env.MODE,
  version: import.meta.env.VITE_APP_VERSION || "unknown",
});

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "L") {
    debugger;
  }
}); 