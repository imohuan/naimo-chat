/**
 * 消息处理辅助函数
 * 用于处理消息数组的通用操作
 */

/**
 * 将文件/图片添加到消息数组中的最后一个 user 消息
 * 如果最后一个 user 消息有 _noInsertFiles 标记，则创建新的 user 消息
 * 
 * @param {Array} messages - 消息数组
 * @param {Array} files - 文件列表，每个文件对象包含 { type, url, filename?, mediaType? }
 * @param {string} userInput - 用户输入文本（可选，仅在需要创建新消息时使用）
 * @returns {Array} 更新后的消息数组（深拷贝）
 */
function addFilesToLastUserMessage(messages, files, userInput = "") {
  if (!files || files.length === 0) {
    return messages;
  }

  // 深拷贝消息数组
  const newMessages = messages.map(msg => ({ ...msg }));

  // 从后往前查找最后一个 user 消息
  let lastUserIndex = -1;
  for (let i = newMessages.length - 1; i >= 0; i--) {
    if (newMessages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }

  // 检查最后一个 user 消息是否允许插入文件
  const shouldCreateNewMessage =
    lastUserIndex === -1 ||
    newMessages[lastUserIndex]._noInsertFiles === true;

  if (shouldCreateNewMessage) {
    // 创建新的 user 消息
    const contentParts = userInput ? [{ type: "text", text: userInput }] : [];

    for (const file of files) {
      if (file.type === "image" || file.mediaType?.startsWith("image/")) {
        contentParts.push({
          type: "image",
          source: {
            type: "url",
            url: file.url,
          },
        });
      } else {
        contentParts.push({
          type: "text",
          text: `\n附件: ${file.filename || file.url}`,
        });
      }
    }

    newMessages.push({
      role: "user",
      content: contentParts.length > 0 ? contentParts : userInput || "",
    });
  } else {
    // 添加到现有的最后一个 user 消息
    const lastUserMsg = newMessages[lastUserIndex];
    let contentParts = [];

    // 处理现有 content
    if (typeof lastUserMsg.content === "string") {
      if (lastUserMsg.content) {
        contentParts.push({ type: "text", text: lastUserMsg.content });
      }
    } else if (Array.isArray(lastUserMsg.content)) {
      contentParts = [...lastUserMsg.content];
    }

    // 添加文件
    for (const file of files) {
      if (file.type === "image" || file.mediaType?.startsWith("image/")) {
        contentParts.push({
          type: "image",
          source: {
            type: "url",
            url: file.url,
          },
        });
      } else {
        contentParts.push({
          type: "text",
          text: `\n附件: ${file.filename || file.url}`,
        });
      }
    }

    lastUserMsg.content = contentParts.length > 0 ? contentParts : lastUserMsg.content;
  }

  // 清理所有消息中的临时属性 _noInsertFiles
  newMessages.forEach((msg) => {
    if (msg._noInsertFiles !== undefined) {
      delete msg._noInsertFiles;
    }
  });

  return newMessages;
}

module.exports = {
  addFilesToLastUserMessage,
};

