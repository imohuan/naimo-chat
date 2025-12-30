/**
 * Agent 工具接口定义
 */
class ITool {
  constructor(name, description, input_schema, handler) {
    this.name = name;
    this.description = description;
    this.input_schema = input_schema;
    this.handler = handler;
  }
}

/**
 * Agent 接口定义
 */
class IAgent {
  constructor() {
    this.name = '';
    this.tools = new Map();
  }

  /**
   * 判断是否应该处理该请求
   * @param {Object} req - 请求对象
   * @param {Object} config - 配置对象
   * @returns {boolean} 是否应该处理
   */
  shouldHandle(_req, _config) {
    return false;
  }

  /**
   * 请求处理器（在处理请求前调用）
   * @param {Object} req - 请求对象
   * @param {Object} config - 配置对象
   */
  reqHandler(_req, _config) {
    // 子类实现
  }

  /**
   * 响应处理器（在处理响应后调用，可选）
   * @param {Object} payload - 响应负载
   * @param {Object} config - 配置对象
   */
  resHandler(_payload, _config) {
    // 子类实现
  }
}

module.exports = {
  ITool,
  IAgent,
};

