/**
 * 重写流
 * 读取源 ReadableStream，返回一个新的 ReadableStream
 * 由 processor 对源数据进行处理后将返回的新值推送到新的 stream
 * 如果没有返回值则不推送
 * @param {ReadableStream} stream - 源流
 * @param {Function} processor - 处理函数，接收 (data, controller) 参数，返回处理后的数据或 undefined
 * @returns {ReadableStream} 新的流
 */
function rewriteStream(stream, processor) {
  const reader = stream.getReader();

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }

          const processed = await processor(value, controller);
          if (processed !== undefined) {
            controller.enqueue(processed);
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });
}

module.exports = { rewriteStream };

