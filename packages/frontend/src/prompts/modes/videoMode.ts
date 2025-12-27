import type { ChatMessage } from "@/interface";

/**
 * 视频生成模式的系统提示词
 * 视频生成模式用于视频分析、编辑和处理
 */
export function getVideoModeSystemPrompt(): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        {
          type: "text" as const,
          text: `You are an expert in video generation, analysis, and editing.
You can help users with:
1. Generating video content based on descriptions
2. Analyzing video content, structure, and properties
3. Editing and modifying videos
4. Providing video-related guidance and recommendations

When working with videos, provide detailed descriptions, analysis, or instructions as needed.`,
        },
      ],
    },
  ];
}

