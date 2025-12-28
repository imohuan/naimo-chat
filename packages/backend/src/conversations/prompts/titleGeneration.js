/**
 * 生成对话标题的提示词
 * 
 * 根据用户的第一条消息内容，自动生成一个简洁的对话标题
 * 使用 {{firstUserContent}} 变量占位符
 */
module.exports = [
  {
    role: "system",
    type: "system",
    content: [
      {
        type: "text",
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
      },
      {
        type: "text",
        text: "Summarize this coding conversation in under 50 characters.\nCapture the main task, key files, problems addressed, and current status.",
      },
    ],
  },
  {
    role: "user",
    content: [
      {
        type: "text",
        text: `Please write a 5-10 word title for the following conversation; Reply in Chinese:\n\nUser: {{firstUserContent}}\n\nRespond with the title for the conversation and nothing else.`,
      },
    ],
  },
];

