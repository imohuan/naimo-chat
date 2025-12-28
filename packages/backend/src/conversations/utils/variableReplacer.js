/**
 * 变量替换工具函数
 * 用于在消息中替换 {{variable}} 格式的占位符
 */

/**
 * 在文本中替换变量
 * @param {string} text - 要替换的文本
 * @param {Object} variables - 变量对象，例如 { name: "世界" }
 * @returns {string} 替换后的文本
 */
function replaceVariables(text, variables) {
  if (!text || typeof text !== "string") return text;
  if (!variables || Object.keys(variables).length === 0) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
}

/**
 * 在消息中替换变量
 * @param {Array} messages - 消息数组 (ChatMessage[])
 * @param {Object} variables - 变量对象，例如 { name: "世界" }
 * @returns {Array} 替换后的消息数组（深拷贝）
 */
function replaceVariablesInMessages(messages, variables) {
  if (!Array.isArray(messages)) {
    return messages;
  }
  if (!variables || Object.keys(variables).length === 0) {
    return messages;
  }

  return messages.map((msg) => {
    const newMsg = { ...msg };

    if (typeof msg.content === "string") {
      // content 是字符串，直接替换
      newMsg.content = replaceVariables(msg.content, variables);
    } else if (Array.isArray(msg.content)) {
      // content 是数组，递归处理每个元素
      newMsg.content = msg.content.map((item) => {
        if (item.type === "text" && item.text) {
          return {
            ...item,
            text: replaceVariables(item.text, variables),
          };
        }
        return item;
      });
    }

    return newMsg;
  });
}

module.exports = {
  replaceVariables,
  replaceVariablesInMessages,
};

