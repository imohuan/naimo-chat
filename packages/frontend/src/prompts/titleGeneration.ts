import type { ChatMessage } from "@/interface";

/**
 * 生成对话标题的提示词
 * 
 * 核心功能：
 * - 根据用户的第一条消息内容，自动生成一个简洁的对话标题
 * - 标题长度控制在 5-10 个词，使用中文回复
 * 
 * 要做的事情：
 * 1. 设置系统角色为 Claude Code，用于代码相关的对话总结
 * 2. 要求模型在 50 个字符内总结对话，捕获主要任务、关键文件、解决的问题和当前状态
 * 3. 基于用户的第一条消息内容，生成一个简洁的中文标题
 * 4. 确保输出只包含标题本身，不包含其他内容
 * 
 * @param firstUserContent 用户的第一条消息内容
 * @returns 用于生成标题的聊天消息历史
 */
export function createTitleGenerationPrompt(
  firstUserContent: string
): ChatMessage[] {
  return [
    {
      role: "system",
      type: "system",
      content: [
        {
          type: "text" as const,
          text: "You are Claude Code, Anthropic's official CLI for Claude.",
        },
        {
          type: "text" as const,
          text: "Summarize this coding conversation in under 50 characters.\nCapture the main task, key files, problems addressed, and current status.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text" as const,
          text: `Please write a 5-10 word title for the following conversation; Reply in Chinese:\n\nUser: ${firstUserContent}\n\nRespond with the title for the conversation and nothing else.`,
        },
      ],
    },
  ];
}

