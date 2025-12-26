/**
 * SSE 序列化转换流
 * 将结构化事件对象转换为 SSE 格式的字符串流
 */
class SSESerializerTransform extends TransformStream {
  constructor() {
    super({
      transform: (event, controller) => {
        let output = '';

        if (event.event) {
          output += `event: ${event.event}\n`;
        }
        if (event.id) {
          output += `id: ${event.id}\n`;
        }
        if (event.retry) {
          output += `retry: ${event.retry}\n`;
        }
        if (event.data) {
          if (event.data.type === 'done') {
            output += 'data: [DONE]\n';
          } else {
            output += `data: ${JSON.stringify(event.data)}\n`;
          }
        }

        output += '\n';
        controller.enqueue(output);
      }
    });
  }
}

module.exports = { SSESerializerTransform };

