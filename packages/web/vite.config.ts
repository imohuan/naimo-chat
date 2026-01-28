import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  // 使用相对路径，支持直接打开 dist/index.html（file:// 协议）
  base: "./",
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // 性能调优：文件预热 (Warmup)
    // 预先解析并缓存常用的文件，消除开发服务器启动后的内部瀑布效应，
    // 特别适用于大型应用启动时 。
    warmup: {
      clientFiles: [
        "./src/main.ts",
        "./src/App.vue",
        // 如果项目较大，可根据 vite:transform 的日志添加大型组件路径
      ],
    },
  },

  // Rolldown/Vite 生产构建优化
  build: {
    // 关于 TailwindCSS v4 与 LightningCSS：
    // TailwindCSS v4 内部已基于 LightningCSS 构建，理论上兼容性良好。
    // 但建议先测试构建，如果遇到问题可移除此配置，使用默认的 esbuild。
    //
    // 推荐使用 LightningCSS (Rust-based) 替代默认的 CSS 最小化器
    // 注意：这可能需要额外的目标浏览器配置来确保兼容性
    cssMinify: "lightningcss",

    // 如果使用 LightningCSS，建议配置目标兼容性以确保 CSS 正确转换
    // 方式1: 使用 browserslist（推荐，如果项目中有 .browserslistrc 或 package.json 中的 browserslist）
    // 方式2: 直接指定目标
    // target: 'es2020', // 或使用 browserslist-to-esbuild 转换列表
  },

  // 可选：如果需要更精细的 LightningCSS 控制，可以配置 css.lightningcss
  // css: {
  //   lightningcss: {
  //     targets: {
  //       chrome: 90,
  //       firefox: 88,
  //       safari: 14,
  //     },
  //   },
  // },
});
