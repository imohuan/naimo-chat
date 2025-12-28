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

  return messages
    .map((msg) => {
      // 检查是否有 _checkVariables 属性
      if (msg._checkVariables && Array.isArray(msg._checkVariables)) {
        // 检查所有需要检查的变量是否都存在且不为空
        const hasEmptyVariable = msg._checkVariables.some((varName) => {
          const value = variables[varName];
          return value === undefined || value === null || value === "";
        });

        // 如果有任何变量为空，则删除该消息（返回 null）
        if (hasEmptyVariable) {
          return null;
        }
      }

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

      // 删除临时属性 _checkVariables
      if (newMsg._checkVariables !== undefined) {
        delete newMsg._checkVariables;
      }

      return newMsg;
    })
    .filter((msg) => msg !== null); // 过滤掉被删除的消息
}

module.exports = {
  replaceVariables,
  replaceVariablesInMessages,
};

