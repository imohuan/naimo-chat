/**
 * SSE 解析器转换流
 * 将 SSE 格式的字符串流转换为结构化事件对象
 */
class SSEParserTransform extends TransformStream {
  constructor() {
    const buffer = { value: '' };
    const currentEvent = {};

    const processLine = (line, events) => {
      if (!line.trim()) {
        if (Object.keys(currentEvent).length > 0) {
          const event = { ...currentEvent };
          // 清空 currentEvent
          Object.keys(currentEvent).forEach(key => delete currentEvent[key]);
          if (events) {
            events.push(event);
            return null;
          }
          return event;
        }
        return null;
      }

      if (line.startsWith('event:')) {
        currentEvent.event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          currentEvent.data = { type: 'done' };
        } else {
          try {
            currentEvent.data = JSON.parse(data);
          } catch {
            currentEvent.data = { raw: data, error: 'JSON parse failed' };
          }
        }
      } else if (line.startsWith('id:')) {
        currentEvent.id = line.slice(3).trim();
      } else if (line.startsWith('retry:')) {
        currentEvent.retry = parseInt(line.slice(6).trim());
      }
      return null;
    };

    super({
      transform: (chunk, controller) => {
        const decoder = new TextDecoder();
        const text = decoder.decode(chunk);
        buffer.value += text;
        const lines = buffer.value.split('\n');

        // 保留最后一行（可能不完整）
        buffer.value = lines.pop() || '';

        for (const line of lines) {
          const event = processLine(line);
          if (event) {
            controller.enqueue(event);
          }
        }
      },
      flush: (controller) => {
        // 处理缓冲区中剩余的内容
        if (buffer.value.trim()) {
          const events = [];
          processLine(buffer.value.trim(), events);
          events.forEach(event => controller.enqueue(event));
        }

        // 推送最后一个事件（如果有）
        if (Object.keys(currentEvent).length > 0) {
          controller.enqueue({ ...currentEvent });
        }
      }
    });
  }
}

module.exports = { SSEParserTransform };

