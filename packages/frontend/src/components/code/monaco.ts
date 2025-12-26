import { loader } from "@guolao/vue-monaco-editor";

import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { emmetHTML, emmetCSS, emmetJSX } from "emmet-monaco-es";

type MonacoModule = typeof import("monaco-editor");

let configured = false;

// 配置 MonacoEnvironment（按照官方文档）
if (typeof self !== "undefined") {
  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === "json") {
        return new jsonWorker();
      }
      if (label === "css" || label === "scss" || label === "less") {
        return new cssWorker();
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new htmlWorker();
      }
      if (label === "typescript" || label === "javascript") {
        return new tsWorker();
      }
      return new editorWorker();
    },
  };
}

// 配置 loader 从 node_modules 加载
loader.config({ monaco });

async function configureMonaco(monaco: MonacoModule) {
  if (configured) {
    return;
  }

  configured = true;

  console.log("🔧 开始配置 Monaco Editor（根据官方文档）...");

  // TypeScript 配置
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    allowJs: true,
    typeRoots: ["node_modules/@types"],
  });

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

  // JavaScript 配置 - 根据官方文档配置
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: true, // 启用类型检查
  });

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  // 初始化 Emmet 支持（必须在所有编辑器实例创建之前）
  console.log("🔧 初始化 Emmet 支持...");
  // HTML Emmet 支持（适用于 HTML 和 PHP 等兼容 HTML 的语言）
  // emmetHTML(monaco, ["html", "php"]);
  // emmetHTML(monaco, ["html"]);
  emmetHTML(monaco);
  // CSS Emmet 支持（适用于 CSS、LESS、SCSS 等）
  // emmetCSS(monaco, ["css", "less", "scss"]);
  // emmetCSS(monaco, ["css"]);
  // JSX Emmet 支持（适用于 JavaScript、TypeScript、JSX、TSX、MDX 等）
  // emmetJSX(monaco, ["javascript", "typescript", "jsx", "tsx", "mdx"]);
  // emmetJSX(monaco, ["javascript"]);
  console.log("✅ Monaco Editor 配置完成");
  console.log("✅ TypeScript 服务配置: checkJs=true, EagerModelSync=true");
  console.log("✅ Emmet 支持已启用: HTML, CSS, JSX");
}

export async function loadMonaco(): Promise<MonacoModule> {
  await configureMonaco(monaco);
  return monaco;
}

/**
 * 颜色化元素（代码高亮）
 * @param element 元素
 * @param options 选项
 */
export function colorizeElement(
  element: HTMLElement,
  options: monaco.editor.IColorizerElementOptions
) {
  monaco.editor.colorizeElement(element, options);
}

export type MonacoInstance = MonacoModule;
