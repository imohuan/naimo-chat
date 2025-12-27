import type { ChatMessage } from "@/interface";

/**
 * 图片生成模式的系统提示词
 * 图片生成模式用于图片分析、编辑和生成
 */
export function getImageModeSystemPrompt(): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        {
          type: "text" as const,
          text: `You are an expert in image generation, analysis, and editing.
You can help users with:
1. Generating images based on descriptions
2. Analyzing image content and properties
3. Editing and modifying images
4. Providing image-related guidance and recommendations

When working with images, provide detailed descriptions, analysis, or instructions as needed.`,
        },
      ],
    },
  ];
}

