import { ref, computed, watch, type Ref } from "vue";
import { useToggle } from "@vueuse/core";
import { useLlmApi } from "@/hooks/useLlmApi";
import { useToasts } from "@/hooks/useToasts";
import type { StatusLineConfig, StatusLineModuleConfig } from "../types";
import {
  createDefaultModuleByType,
  createDefaultStatusLineConfig,
  isHexColor,
  replaceVariables,
} from "../utils";
import type { PreviewVariables } from "./usePreviewHistory";

export function useStatusLine(previewVariables: Ref<PreviewVariables>) {
  const { fetchConfig, saveConfig, updateStatusLine } = useLlmApi();
  const { pushToast } = useToasts();

  const statusLineConfig = ref<StatusLineConfig>(createDefaultStatusLineConfig());
  const selectedModuleIndex = ref<number | null>(null);
  const [autoSeparator, setAutoSeparator] = useToggle(false);
  const [showIcon, setShowIcon] = useToggle(true);
  const isLoading = ref(false);
  const isSaving = ref(false);

  // 保存原始配置快照，用于检测是否有未保存的更改
  const savedSnapshot = ref<{
    statusLineConfig: StatusLineConfig;
    autoSeparator: boolean;
    showIcon: boolean;
    previewVariables: PreviewVariables;
  } | null>(null);

  const currentModules = computed(() => {
    const currentTheme = statusLineConfig.value.currentStyle;
    const themeConfig = statusLineConfig.value[currentTheme as keyof StatusLineConfig];
    if (themeConfig && typeof themeConfig === "object" && "modules" in themeConfig) {
      return themeConfig.modules || [];
    }
    return [];
  });

  const draggableModules = computed({
    get: () => currentModules.value,
    set: (val) => {
      const currentTheme = statusLineConfig.value.currentStyle;
      statusLineConfig.value = {
        ...statusLineConfig.value,
        [currentTheme]: { modules: [...val] },
      };
    },
  });

  const selectedModule = computed<StatusLineModuleConfig | null>(() => {
    if (
      selectedModuleIndex.value === null ||
      selectedModuleIndex.value >= currentModules.value.length
    ) {
      return null;
    }
    // 通过空值合并保证返回值永远为 StatusLineModuleConfig 或 null，避免 undefined
    return currentModules.value[selectedModuleIndex.value] ?? null;
  });

  // 默认选中第一个模块，保持选中索引合法
  watch(
    currentModules,
    (modules) => {
      if (!modules || modules.length === 0) {
        selectedModuleIndex.value = null;
        return;
      }
      if (
        selectedModuleIndex.value === null ||
        selectedModuleIndex.value >= modules.length
      ) {
        selectedModuleIndex.value = 0;
      }
    },
    { immediate: true }
  );

  // 深度比较函数
  function deepEqual(obj1: any, obj2: any): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  // 保存当前配置快照
  function saveSnapshot() {
    savedSnapshot.value = {
      statusLineConfig: JSON.parse(JSON.stringify(statusLineConfig.value)),
      autoSeparator: autoSeparator.value,
      showIcon: showIcon.value,
      previewVariables: JSON.parse(JSON.stringify(previewVariables.value)),
    };
  }

  // 检测是否有未保存的更改
  const hasUnsavedChanges = computed(() => {
    if (!savedSnapshot.value) return false;

    return (
      !deepEqual(statusLineConfig.value, savedSnapshot.value.statusLineConfig) ||
      autoSeparator.value !== savedSnapshot.value.autoSeparator ||
      showIcon.value !== savedSnapshot.value.showIcon ||
      !deepEqual(previewVariables.value, savedSnapshot.value.previewVariables)
    );
  });

  async function loadConfig() {
    try {
      isLoading.value = true;
      const config = await fetchConfig();
      if (config.StatusLine) {
        // 合并配置，保留所有主题模板
        const loadedConfig = { ...createDefaultStatusLineConfig(), ...config.StatusLine };

        // 确保至少有一个主题
        if (!loadedConfig.currentStyle || !loadedConfig[loadedConfig.currentStyle]) {
          const firstTheme = Object.keys(loadedConfig).find(
            key => key !== 'enabled' && key !== 'currentStyle' && typeof loadedConfig[key] === 'object' && 'modules' in loadedConfig[key]
          );
          if (firstTheme) {
            loadedConfig.currentStyle = firstTheme;
          }
        }

        statusLineConfig.value = loadedConfig;

        if (config.StatusLine.previewVariables) {
          previewVariables.value = {
            ...previewVariables.value,
            ...config.StatusLine.previewVariables,
          };
        }
        if (config.StatusLine.autoSeparator !== undefined) {
          setAutoSeparator(config.StatusLine.autoSeparator);
        }
        if (config.StatusLine.showIcon !== undefined) {
          setShowIcon(config.StatusLine.showIcon);
        }
      }
      // 加载配置后保存快照
      saveSnapshot();
    } catch (err) {
      pushToast(`加载配置失败: ${(err as Error).message}`, "error");
    } finally {
      isLoading.value = false;
    }
  }

  async function handleSave() {
    try {
      isSaving.value = true;
      const config = await fetchConfig();
      const updatedConfig = {
        ...config,
        StatusLine: {
          ...statusLineConfig.value,
          previewVariables: previewVariables.value,
          autoSeparator: autoSeparator.value,
          showIcon: showIcon.value,
        },
      };
      await saveConfig(updatedConfig);

      // 保存成功后调用更新接口
      await updateStatusLine();

      // 保存成功后更新快照
      saveSnapshot();

      pushToast("StatusLine 配置已保存", "success");
    } catch (err) {
      pushToast(`保存配置失败: ${(err as Error).message}`, "error");
    } finally {
      isSaving.value = false;
    }
  }

  async function refreshConfig() {
    // 重新从服务器加载配置
    await loadConfig();
    pushToast("配置已刷新", "success");
  }

  function handleThemeChange(value: string) {
    if (statusLineConfig.value.currentStyle === value) return;

    const getThemeConfig = (style: string) => {
      const cfg = statusLineConfig.value[style as keyof StatusLineConfig];
      return cfg && typeof cfg === "object" && "modules" in cfg ? cfg : null;
    };

    const prevTheme = statusLineConfig.value.currentStyle;
    const prevThemeConfig = getThemeConfig(prevTheme);
    const prevModules = prevThemeConfig ? [...(prevThemeConfig.modules || [])] : [];

    const targetThemeConfig = getThemeConfig(value);
    const targetModules = targetThemeConfig ? [...(targetThemeConfig.modules || [])] : [];

    if (targetModules.length === 0 && prevModules.length > 0) {
      statusLineConfig.value = {
        ...statusLineConfig.value,
        [value]: { modules: [...prevModules] },
        currentStyle: value,
      };
    } else {
      statusLineConfig.value.currentStyle = value;
    }

    selectedModuleIndex.value = null;
  }

  function handleAddModule(type: string) {
    const newModule = createDefaultModuleByType(type);
    const currentTheme = statusLineConfig.value.currentStyle;
    const themeConfig = statusLineConfig.value[currentTheme as keyof StatusLineConfig];
    const modules =
      themeConfig && typeof themeConfig === "object" && "modules" in themeConfig
        ? [...(themeConfig.modules || [])]
        : [];

    modules.push(newModule);

    statusLineConfig.value = {
      ...statusLineConfig.value,
      [currentTheme]: { modules },
    };

    selectedModuleIndex.value = modules.length - 1;
  }

  function handleModuleChange(field: keyof StatusLineModuleConfig, value: string) {
    if (selectedModuleIndex.value === null) return;

    const currentTheme = statusLineConfig.value.currentStyle;
    const themeConfig = statusLineConfig.value[currentTheme as keyof StatusLineConfig];
    const modules =
      themeConfig && typeof themeConfig === "object" && "modules" in themeConfig
        ? [...(themeConfig.modules || [])]
        : [];

    if (modules[selectedModuleIndex.value]) {
      const updatedModule: StatusLineModuleConfig = {
        ...modules[selectedModuleIndex.value],
        [field]: value,
      } as StatusLineModuleConfig;
      modules[selectedModuleIndex.value] = updatedModule;

      statusLineConfig.value = {
        ...statusLineConfig.value,
        [currentTheme]: { modules },
      };
    }
  }

  function handleDeleteModule() {
    if (selectedModuleIndex.value === null) return;

    const currentTheme = statusLineConfig.value.currentStyle;
    const themeConfig = statusLineConfig.value[currentTheme as keyof StatusLineConfig];
    const modules =
      themeConfig && typeof themeConfig === "object" && "modules" in themeConfig
        ? [...(themeConfig.modules || [])]
        : [];

    modules.splice(selectedModuleIndex.value, 1);

    statusLineConfig.value = {
      ...statusLineConfig.value,
      [currentTheme]: { modules },
    };

    selectedModuleIndex.value = null;
  }

  function applyAutoSeparator(nextEnabled: boolean) {
    const currentTheme = statusLineConfig.value.currentStyle;
    const themeConfig = statusLineConfig.value[currentTheme as keyof StatusLineConfig];
    const modules =
      themeConfig && typeof themeConfig === "object" && "modules" in themeConfig
        ? [...(themeConfig.modules || [])]
        : [];

    if (nextEnabled) {
      const newModules: StatusLineModuleConfig[] = [];
      for (let i = 0; i < modules.length; i++) {
        const module = modules[i];
        if (!module) continue;
        // 判断是否为分割线：type 为 usage 且 text 为 "|"
        const isSeparator = module.type === "usage" && module.text === "|";
        if (!isSeparator) {
          newModules.push(module);
          if (i < modules.length - 1) {
            const nextModule = modules[i + 1];
            const isNextSeparator = nextModule && nextModule.type === "usage" && nextModule.text === "|";
            if (nextModule && !isNextSeparator) {
              newModules.push({
                type: "usage",
                text: "|",
                color: "white",
              });
            }
          }
        }
      }

      statusLineConfig.value = {
        ...statusLineConfig.value,
        [currentTheme]: { modules: newModules },
      };
    } else {
      // 过滤掉分割线：type 为 usage 且 text 为 "|"
      const newModules = modules.filter((m) => {
        if (!m) return false;
        const isSeparator = m.type === "usage" && m.text === "|";
        return !isSeparator;
      });

      statusLineConfig.value = {
        ...statusLineConfig.value,
        [currentTheme]: { modules: newModules },
      };

      if (
        selectedModuleIndex.value !== null &&
        selectedModuleIndex.value < modules.length
      ) {
        const selected = modules[selectedModuleIndex.value];
        const isSeparator = selected && selected.type === "usage" && selected.text === "|";
        if (isSeparator) {
          selectedModuleIndex.value = null;
        }
      }
    }

    setAutoSeparator(nextEnabled);
  }

  function toggleAutoSeparator() {
    applyAutoSeparator(!autoSeparator.value);
  }

  function toggleShowIcon() {
    setShowIcon(!showIcon.value);
  }

  function handleEnabledChange(enabled: boolean) {
    // 只更新本地配置，不保存和调用API
    statusLineConfig.value = {
      ...statusLineConfig.value,
      enabled,
    };
  }

  /**
   * 解析 token 字符串（如 "2.11k", "1.5M", "500"）为数字
   */
  function parseTokenString(tokenStr: string): number {
    if (!tokenStr || typeof tokenStr !== "string") return 0;

    const cleaned = tokenStr.trim().toLowerCase();
    const match = cleaned.match(/^([\d.]+)\s*([kmg]?)$/);
    if (!match || !match[1]) {
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || "";

    switch (unit) {
      case "k":
        return value * 1000;
      case "m":
        return value * 1000000;
      case "g":
        return value * 1000000000;
      default:
        return value;
    }
  }


  /**
   * 渲染进度条模块预览
   */
  function renderProgressModulePreview(
    module: StatusLineModuleConfig,
    isPowerline: boolean
  ) {
    const progressInput = module.progressInput || "";
    const progressOutput = module.progressOutput || "";
    const progressLength = module.progressLength || 20;
    const progressBgColor = module.progressBgColor || "";
    const progressColor = module.progressColor || "";
    const progressStyle = module.progressStyle || "block";

    // 替换变量
    const inputStr = replaceVariables(progressInput, previewVariables.value);
    const outputStr = replaceVariables(progressOutput, previewVariables.value);

    // 解析输入和输出值
    const inputValue = parseTokenString(inputStr);
    const outputValue = parseTokenString(outputStr);

    // 计算百分比
    let percentage = 0;
    if (outputValue > 0) {
      percentage = (inputValue / outputValue) * 100;
    }

    // HEX 转 RGB
    function hexToRgb(hex: string): string {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result || !result[1] || !result[2] || !result[3]) return "";
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgb(${r}, ${g}, ${b})`;
    }

    // 检查是否为 RGB 格式
    function isRgbColor(color: string): boolean {
      return /^rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color);
    }

    // 检查是否为 HEX 格式
    function isHexColor(color: string): boolean {
      return /^#[0-9A-F]{6}$/i.test(color);
    }

    // 处理背景颜色
    let bgColor = progressBgColor || "rgb(51, 65, 85)";
    if (progressBgColor) {
      if (isHexColor(progressBgColor)) {
        bgColor = hexToRgb(progressBgColor);
      } else if (!isRgbColor(progressBgColor)) {
        bgColor = "rgb(51, 65, 85)";
      }
    }

    // 处理进度条颜色
    let progressBarColor = progressColor || "rgb(34, 211, 238)";
    if (progressColor) {
      if (isHexColor(progressColor)) {
        progressBarColor = hexToRgb(progressColor);
      } else if (!isRgbColor(progressColor)) {
        progressBarColor = "rgb(34, 211, 238)";
      }
    }

    // 返回进度条数据
    return {
      isProgress: true,
      percentage,
      progressLength,
      progressStyle,
      bgColor,
      progressColor: progressBarColor,
      // Powerline 样式相关
      bgColorStyle: isPowerline ? { backgroundColor: bgColor } : {},
      bgColorClass: "",
      textColorStyle: {},
      textColorClass: "",
      borderLeftColor: isPowerline
        ? progressBgColor && isHexColor(progressBgColor)
          ? progressBgColor
          : progressBgColor && isRgbColor(progressBgColor)
            ? progressBgColor
            : "#374151"
        : undefined,
      icon: module.icon || "",
      text: "",
      background: module.background,
    };
  }

  function renderModulePreview(module: StatusLineModuleConfig, isPowerline: boolean) {
    // 如果是进度条类型，特殊处理
    if (module.type === "progress") {
      return renderProgressModulePreview(module, isPowerline);
    }

    const text = replaceVariables(module.text || "", previewVariables.value);
    const icon = module.icon || "";
    const colorValue = module.color || "";
    const bgValue = module.background || "";

    // HEX 转 RGB
    function hexToRgb(hex: string): string {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result || !result[1] || !result[2] || !result[3]) return "";
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgb(${r}, ${g}, ${b})`;
    }

    // RGB 转 HEX
    function rgbToHex(rgb: string): string {
      const match = rgb.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (!match || !match[1] || !match[2] || !match[3]) return "";
      const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
      const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
      const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    }

    // 检查是否为 RGB 格式
    function isRgbColor(color: string): boolean {
      return /^rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color);
    }

    // 解析样式字段
    function parseStyles(style: string | string[] | undefined): string[] {
      if (!style) return [];
      if (Array.isArray(style)) return style;
      if (typeof style === "string") {
        try {
          const parsed = JSON.parse(style);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [style];
        }
      }
      return [];
    }

    // 将 ANSI 样式转换为 CSS 样式对象
    function applyAnsiStyles(styles: string[]): Record<string, string> {
      const cssStyles: Record<string, string> = {};
      let hasReverse = false;
      let hasNoReverse = false;

      for (const style of styles) {
        switch (style) {
          case "bold":
            cssStyles.fontWeight = "bold";
            break;
          case "dim":
            cssStyles.opacity = "0.6";
            break;
          case "normal":
            cssStyles.fontWeight = "normal";
            cssStyles.opacity = "1";
            break;
          case "underline":
            cssStyles.textDecoration = "underline";
            break;
          case "noUnderline":
            cssStyles.textDecoration = "none";
            break;
          case "reverse":
            hasReverse = true;
            break;
          case "noReverse":
            hasNoReverse = true;
            break;
        }
      }

      // reverse 和 noReverse 的处理需要在颜色设置后处理
      if (hasReverse && !hasNoReverse) {
        cssStyles.filter = "invert(1)";
      }

      return cssStyles;
    }

    const styles = parseStyles(module.style);
    const styleCss = applyAnsiStyles(styles);

    if (isPowerline) {
      let bgColorStyle: Record<string, string> = {};
      let borderLeftColor = "#374151"; // 默认颜色

      if (bgValue) {
        if (isRgbColor(bgValue)) {
          bgColorStyle = { backgroundColor: bgValue };
          borderLeftColor = rgbToHex(bgValue) || "#374151";
        } else if (isHexColor(bgValue)) {
          const rgb = hexToRgb(bgValue);
          bgColorStyle = { backgroundColor: rgb };
          borderLeftColor = bgValue;
        }
      }

      let textColorStyle: Record<string, string> = {};
      if (colorValue) {
        if (isRgbColor(colorValue)) {
          textColorStyle = { color: colorValue };
        } else if (isHexColor(colorValue)) {
          textColorStyle = { color: hexToRgb(colorValue) };
        }
      } else {
        textColorStyle = { color: "rgb(255, 255, 255)" };
      }

      // 处理 reverse 样式：交换前景色和背景色
      const hasReverse = styles.includes("reverse") && !styles.includes("noReverse");
      if (hasReverse) {
        const tempBg = { ...bgColorStyle };
        const tempText = { ...textColorStyle };
        bgColorStyle = tempText;
        textColorStyle = tempBg;
        // 移除 filter，因为我们已经交换了颜色
        const { filter: _filter, ...restStyleCss } = styleCss;
        return {
          bgColorStyle: { ...bgColorStyle, ...restStyleCss },
          bgColorClass: "",
          textColorStyle: { ...textColorStyle, ...restStyleCss },
          textColorClass: "",
          borderLeftColor,
          icon,
          text,
          background: module.background,
        };
      }

      // 合并样式
      return {
        bgColorStyle: { ...bgColorStyle, ...styleCss },
        bgColorClass: "",
        textColorStyle: { ...textColorStyle, ...styleCss },
        textColorClass: "",
        borderLeftColor,
        icon,
        text,
        background: module.background,
      };
    }

    let textStyle: Record<string, string> = {};
    if (colorValue) {
      if (isRgbColor(colorValue)) {
        textStyle = { color: colorValue };
      } else if (isHexColor(colorValue)) {
        textStyle = { color: hexToRgb(colorValue) };
      }
    }

    // 应用背景颜色
    if (bgValue) {
      if (isRgbColor(bgValue)) {
        textStyle.backgroundColor = bgValue;
      } else if (isHexColor(bgValue)) {
        textStyle.backgroundColor = hexToRgb(bgValue);
      }
    }

    // 处理 reverse 样式：需要背景色才能反转
    const hasReverse = styles.includes("reverse") && !styles.includes("noReverse");
    if (hasReverse && bgValue) {
      // 如果有背景色，交换前景色和背景色
      let bgColor = "";
      if (isRgbColor(bgValue)) {
        bgColor = bgValue;
      } else if (isHexColor(bgValue)) {
        bgColor = hexToRgb(bgValue);
      }
      if (bgColor) {
        textStyle = {
          ...textStyle,
          backgroundColor: textStyle.color || "rgb(255, 255, 255)",
          color: bgColor,
        };
      }
      // 移除 filter，因为我们已经交换了颜色
      const { filter: _filter, ...restStyleCss } = styleCss;
      return { textStyle: { ...textStyle, ...restStyleCss }, textClass: "", icon, text };
    }

    // 合并样式
    return { textStyle: { ...textStyle, ...styleCss }, textClass: "", icon, text };
  }

  // 获取所有主题模板名称列表
  const themeNames = computed(() => {
    return Object.keys(statusLineConfig.value).filter(
      key => key !== 'enabled' && key !== 'currentStyle' && typeof statusLineConfig.value[key] === 'object' && 'modules' in statusLineConfig.value[key]
    );
  });

  // 添加主题模板
  function addThemeTemplate(name: string) {
    if (!name || name.trim() === '') {
      pushToast('主题名称不能为空', 'error');
      return false;
    }
    if (name === 'enabled' || name === 'currentStyle') {
      pushToast('主题名称不能为 enabled 或 currentStyle', 'error');
      return false;
    }
    if (statusLineConfig.value[name]) {
      pushToast('主题名称已存在', 'error');
      return false;
    }

    // 复制当前主题的模块作为新主题的初始内容
    const currentTheme = statusLineConfig.value.currentStyle;
    const currentThemeConfig = statusLineConfig.value[currentTheme];
    const modules = currentThemeConfig && typeof currentThemeConfig === 'object' && 'modules' in currentThemeConfig
      ? [...(currentThemeConfig.modules || [])]
      : [];

    statusLineConfig.value = {
      ...statusLineConfig.value,
      [name]: { modules },
    };

    pushToast(`主题模板 "${name}" 已创建`, 'success');
    return true;
  }

  // 删除主题模板
  function deleteThemeTemplate(name: string) {
    if (name === statusLineConfig.value.currentStyle) {
      pushToast('不能删除当前正在使用的主题模板', 'error');
      return false;
    }
    if (!statusLineConfig.value[name]) {
      pushToast('主题模板不存在', 'error');
      return false;
    }

    const newConfig = { ...statusLineConfig.value };
    delete newConfig[name];
    statusLineConfig.value = newConfig;

    pushToast(`主题模板 "${name}" 已删除`, 'success');
    return true;
  }

  // 复制主题模板
  function duplicateThemeTemplate(sourceName: string) {
    if (!statusLineConfig.value[sourceName]) {
      pushToast('源主题模板不存在', 'error');
      return false;
    }

    // 生成新主题名称
    let newName = `${sourceName} 副本`;
    let counter = 1;
    while (statusLineConfig.value[newName]) {
      newName = `${sourceName} 副本 ${counter}`;
      counter++;
    }

    // 复制主题配置
    const sourceThemeConfig = statusLineConfig.value[sourceName];
    if (sourceThemeConfig && typeof sourceThemeConfig === 'object' && 'modules' in sourceThemeConfig) {
      const modules = [...(sourceThemeConfig.modules || [])];
      statusLineConfig.value = {
        ...statusLineConfig.value,
        [newName]: { modules },
      };
      pushToast(`主题模板 "${sourceName}" 已复制为 "${newName}"`, 'success');
      return true;
    }

    pushToast('复制主题模板失败', 'error');
    return false;
  }

  // 重命名主题模板
  function renameThemeTemplate(oldName: string, newName: string) {
    if (!newName || newName.trim() === '') {
      pushToast('主题名称不能为空', 'error');
      return false;
    }
    if (newName === 'enabled' || newName === 'currentStyle') {
      pushToast('主题名称不能为 enabled 或 currentStyle', 'error');
      return false;
    }
    if (!statusLineConfig.value[oldName]) {
      pushToast('原主题模板不存在', 'error');
      return false;
    }
    if (statusLineConfig.value[newName]) {
      pushToast('新主题名称已存在', 'error');
      return false;
    }

    const themeConfig = statusLineConfig.value[oldName];
    const newConfig = { ...statusLineConfig.value };
    delete newConfig[oldName];
    newConfig[newName] = themeConfig;

    // 如果重命名的是当前主题，更新 currentStyle
    if (oldName === statusLineConfig.value.currentStyle) {
      newConfig.currentStyle = newName;
    }

    statusLineConfig.value = newConfig;

    pushToast(`主题模板已从 "${oldName}" 重命名为 "${newName}"`, 'success');
    return true;
  }

  // 切换主题模板
  function switchThemeTemplate(name: string) {
    if (statusLineConfig.value.currentStyle === name) return true;

    const getThemeConfig = (style: string) => {
      const cfg = statusLineConfig.value[style as keyof StatusLineConfig];
      return cfg && typeof cfg === "object" && "modules" in cfg ? cfg : null;
    };

    const prevTheme = statusLineConfig.value.currentStyle;
    const prevThemeConfig = getThemeConfig(prevTheme);
    const prevModules = prevThemeConfig ? [...(prevThemeConfig.modules || [])] : [];

    const targetThemeConfig = getThemeConfig(name);
    const targetModules = targetThemeConfig ? [...(targetThemeConfig.modules || [])] : [];

    // 如果目标主题不存在或为空，且当前主题有模块，则复制当前主题的模块
    if ((!targetThemeConfig || targetModules.length === 0) && prevModules.length > 0) {
      statusLineConfig.value = {
        ...statusLineConfig.value,
        [name]: { modules: [...prevModules] },
        currentStyle: name,
      };
    } else if (!targetThemeConfig) {
      pushToast('主题模板不存在', 'error');
      return false;
    } else {
      statusLineConfig.value.currentStyle = name;
    }

    selectedModuleIndex.value = null;
    return true;
  }

  return {
    statusLineConfig,
    selectedModuleIndex,
    selectedModule,
    autoSeparator,
    showIcon,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    currentModules,
    draggableModules,
    themeNames,
    loadConfig,
    refreshConfig,
    handleSave,
    handleThemeChange,
    handleAddModule,
    handleModuleChange,
    handleDeleteModule,
    toggleAutoSeparator,
    toggleShowIcon,
    renderModulePreview,
    handleEnabledChange,
    addThemeTemplate,
    deleteThemeTemplate,
    duplicateThemeTemplate,
    renameThemeTemplate,
    switchThemeTemplate,
  };
}

