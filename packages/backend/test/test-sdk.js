const { query } = require("@anthropic-ai/claude-agent-sdk")
process.env.API_TIMEOUT_MS = "300000"
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:3457/"
process.env.ANTHROPIC_AUTH_TOKEN = "sk-123456"
// process.env.ANTHROPIC_API_KEY = "sk-123456";

// 确保已设置环境变量 export ANTHROPIC_API_KEY='your-key'
async function run() {
  const stream = query({
    prompt: "四川成都当前天气如何",
    options: {
      // 允许 Agent 使用的工具，例如 'Read' 用于读文件
      allowedTools: ["WebFetch", "WebSearch"],
      model: "claude-3-5-sonnet-latest"
    }
  });

  for await (const message of stream) {
    // 实时打印 Agent 的思考和执行结果
    if (message.type === 'text') {
      process.stdout.write(message.text);
    }
  }

}

run().catch(console.error);