/**
 * @typedef {Object} ProviderConfigObject
 * @property {boolean} LOG - 是否启用服务日志输出
 * @property {string} LOG_LEVEL - 日志级别，可选值: "debug" | "info" | "warn" | "error"
 * @property {string} CLAUDE_PATH - Claude 服务的可执行文件路径，如果为空则使用系统默认路径
 * @property {string} API_TIMEOUT_MS - API 请求超时时间（毫秒），字符串格式
 * @property {string} HOST - 服务监听的主机地址
 * @property {number} PORT - 服务监听的端口号
 * @property {string} APIKEY - API 密钥，访问 /v1/messages 端点时需要携带，Claude 服务启动时必须设置
 * @property {string} CUSTOM_ROUTER_PATH - 自定义路由配置文件的路径，如果为空则使用默认路由配置
 * @property {string} PROXY_URL - HTTP/HTTPS 代理地址，用于 @musistudio/llms 库的请求代理
 * @property {TransformerConfig[]} transformers - 全局 Transformer 配置列表
 * @property {ProviderConfig[]} Providers - LLM 提供商配置列表
 * @property {RouterConfig} Router - 路由规则配置，定义不同场景下使用的提供商和模型
 * @property {StatusLineConfig} StatusLine - 状态栏显示配置
 */

/**
 * @type {ProviderConfigObject}
 * @description 路由服务的完整配置对象
 */
const config = {
  /**
   * @type {boolean}
   * @description 是否启用服务日志输出
   */
  LOG: true,

  /**
   * @type {string}
   * @description 日志级别，控制日志输出的详细程度
   * @default "debug"
   */
  LOG_LEVEL: "debug",

  /**
   * @type {string}
   * @description Claude 服务的可执行文件路径
   * @description 如果为空字符串，系统将尝试使用环境变量或默认路径查找 Claude 可执行文件
   * @default ""
   */
  CLAUDE_PATH: "",

  /**
   * @type {string}
   * @description API 请求超时时间（毫秒）
   * @description 字符串格式，例如 "600000" 表示 10 分钟超时
   * @default "600000"
   */
  API_TIMEOUT_MS: "600000",

  /**
   * @type {string}
   * @description 服务监听的主机地址
   * @description 使用 "127.0.0.1" 仅允许本地访问，"0.0.0.0" 允许所有网络接口访问
   * @default "127.0.0.1"
   */
  HOST: "127.0.0.1",

  /**
   * @type {number}
   * @description 服务监听的端口号
   * @default 3456
   */
  PORT: 3456,

  /**
   * @type {string}
   * @description API 密钥
   * @description 访问 /v1/messages 端点时需要携带此密钥进行身份验证
   * @description Claude 服务启动时必须设置 API 密钥，因此此处需要配置
   * @default "sk-123456"
   */
  APIKEY: "sk-imohuan",

  /**
   * @type {string}
   * @description 自定义路由配置文件的路径
   * @description 如果为空字符串，将使用当前文件中的 Router 配置
   * @description 如果指定路径，将从该文件加载路由配置
   * @default ""
   */
  CUSTOM_ROUTER_PATH: "",

  /**
   * @type {string}
   * @description HTTP/HTTPS 代理地址
   * @description 用于 @musistudio/llms 库的请求代理，格式: "http://proxy-host:port" 或 "https://proxy-host:port"
   * @description 如果为空字符串，则不使用代理
   * @default ""
   */
  PROXY_URL: "",

  /**
   * @type {TransformerConfig[]}
   * @description 全局 Transformer 配置列表
   * @description Transformer 用于在请求发送前或响应接收后对数据进行转换处理
   * @description 支持两种类型：class（类）和 module（模块）
   */
  transformers: [
    // {
    //   name: "transformer-name",
    //   type: "class" | "module",
    //   path: "path/to/transformer/module",
    //   options: {},
    // },
  ],

  /**
   * @type {ProviderConfig[]}
   * @description LLM 提供商配置列表
   * @description 每个提供商包含 API 地址、密钥、支持的模型列表等信息
   * @description 路由系统会根据配置选择合适的提供商和模型处理请求
   */
  Providers: [
    {
      name: "yunwu",
      api_base_url: "https://yunwu.ai/v1/chat/completions",
      // limit: 1,
      // sort: 1,
      // enabled: true,
      api_key: "sk-xxx",
      api_keys: ["sk-U3SKSHcCuyi6eDtR0h9QjZ05VVVi8hPIinlme8yRfafN6BS0"],
      models: [
        "gpt-5-nano-2025-08-07",
        "glm-4.6",
        "gpt-5-mini",
        "kimi-k2-0711-preview-search",
      ],
      transformer: {
        "deepseek-v3.1": {
          use: [
            [
              "maxtoken",
              {
                max_tokens: 8192,
              },
            ],
          ],
        },
      },
    },
    {
      name: "iflow",
      api_base_url: "https://apis.iflow.cn/v1/chat/completions",
      api_key: "sk-xxx",
      limit: 1,
      api_keys: [
        "sk-2000c7dfbb220ba7443b96679e364b38",
        "sk-6cfa06d526065230d263cbbf1be32eeb",
      ],
      models: [
        "qwen3-coder-plus",
        "kimi-k2-0905",
        "glm-4.5",
        "glm-4.6",
        "qwen3-max",
        "deepseek-v3.1",
        "qwen3-vl-plus",
        "deepseek-v3.2",
      ],
      transformer: {
        "deepseek-v3.1": {
          use: [
            [
              "maxtoken",
              {
                max_tokens: 8192,
              },
            ],
          ],
        },
      },
    },
  ],

  /**
   * @type {RouterConfig}
   * @description 路由规则配置
   * @description 定义不同场景下使用的提供商和模型组合
   * @description 格式: "provider-name,model-name"，例如 "iflow,glm-4.6"
   * @description 支持的路由类型：
   * @description - default: 默认路由，用于常规请求
   * @description - background: 后台任务路由，用于异步或长时间运行的任务
   * @description - think: 思考任务路由，用于需要深度思考的复杂任务
   * @description - longContext: 长上下文路由，用于需要处理大量上下文的任务
   * @description - webSearch: 网络搜索路由，用于需要网络搜索能力的任务
   */
  Router: {
    default: "iflow,glm-4.6",
    // default: "yunwu,glm-4.6",
    // background: "iflow_2,glm-4.6",
    // think: "yunwu,gpt-5-mini",
    // longContext: "yunwu,glm-4.6",
    // webSearch: "yunwu,kimi-k2-0711-preview-search"
    // default: "yunwu_code,claude-haiku-4-5-20251001",
    // background: "yunwu_code,claude-haiku-4-5-20251001",
    // think: "yunwu_code,claude-haiku-4-5-20251001",
    // longContext: "yunwu_code,claude-haiku-4-5-20251001",
    // webSearch: "yunwu_code,claude-haiku-4-5-20251001"
  },

  /**
   * @type {StatusLineConfig}
   * @description 状态栏显示配置
   * @description 用于配置终端状态栏的显示内容和样式
   * @description 支持 @musistudio/llms 库的状态栏功能
   */
  StatusLine: {
    /**
     * @type {boolean}
     * @description 是否启用状态栏功能
     */
    enabled: true,

    /**
     * @type {string}
     * @description 当前使用的状态栏样式名称
     * @description 对应下方样式配置对象的键名，例如 "default" 或 "powerline"
     */
    currentStyle: "default",

    /**
     * @type {StatusLineStyle}
     * @description 默认样式配置
     * @description 包含工作目录、模型、使用量、Git 分支等信息模块
     */
    default: {
      modules: [
        {
          type: "workDir",
          icon: "󰉋",
          text: "{{workDirName}}",
          color: "bright_blue",
        },
        {
          type: "model",
          icon: "🤖",
          text: "{{model}}",
          color: "bright_yellow",
        },
        {
          type: "usage",
          icon: "📊",
          text: "{{inputTokens}} → {{outputTokens}}",
          color: "bright_magenta",
        },
        {
          type: "gitBranch",
          icon: "🌿",
          text: "{{gitBranch}}",
          color: "bright_green",
        },
        {
          type: "script",
          icon: "📜",
          text: "Script Module",
          color: "bright_cyan",
          scriptPath: "",
        },
      ],
    },

    /**
     * @type {StatusLineStyle}
     * @description Powerline 样式配置
     * @description 提供更丰富的视觉效果，需要配置相应的模块
     */
    powerline: {
      modules: [],
    },
  },
};

/**
 * @module config/provider
 * @description 导出提供商配置对象
 */
module.exports = {
  /**
   * @type {ProviderConfigObject}
   * @description 提供商配置对象，包含所有服务配置项
   */
  PROVIDER_CONFIG: config,
};
