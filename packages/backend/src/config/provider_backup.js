const config = {
  Providers: [
    {
      "name": "yunwu",
      "api_base_url": "https://yunwu.ai/v1/chat/completions",
      "api_key": "sk-U3SKSHcCuyi6eDtR0h9QjZ05VVVi8hPIinlme8yRfafN6BS0",
      // "api_keys": ["xxxx",xx],
      "models": [
        "gpt-5-nano-2025-08-07",
        "glm-4.6",
        "gpt-5-mini",
        "kimi-k2-0711-preview-search"
      ],
      "transformer": {
        "deepseek-v3.1": {
          "use": [
            [
              "maxtoken",
              {
                "max_tokens": 8192
              }
            ]
          ]
        }
      }
    },
    {
      "name": "yunwu_code",
      "api_base_url": "https://yunwu.ai/v1/messages",
      "api_key": "sk-VQERXnAWHvHd9J7sojuhyVeEMbYSSZOBynQQzhIJxdjoHPpf",
      "use_anthropic": true,
      "anthropic_version": "2023-06-01",
      "models": [
        "claude-haiku-4-5-20251001"
      ],
      "transformer": {
        "deepseek-v3.1": {
          "use": [
            [
              "maxtoken",
              {
                "max_tokens": 8192
              }
            ]
          ]
        }
      }
    },
    {
      "name": "iflow",
      "api_base_url": "https://apis.iflow.cn/v1/chat/completions",
      "api_key": "sk-2000c7dfbb220ba7443b96679e364b38",
      "models": [
        "qwen3-coder-plus",
        "kimi-k2-0905",
        "glm-4.5",
        "glm-4.6",
        "qwen3-max",
        "deepseek-v3.1",
        "qwen3-vl-plus",
        "deepseek-v3.2"
      ],
      "transformer": {
        "deepseek-v3.1": {
          "use": [
            [
              "maxtoken",
              {
                "max_tokens": 8192
              }
            ]
          ]
        }
      }
    },
    {
      "name": "iflow_2",
      "api_base_url": "https://apis.iflow.cn/v1/chat/completions",
      "api_key": "sk-6cfa06d526065230d263cbbf1be32eeb",
      "models": [
        "qwen3-coder-plus",
        "kimi-k2-0905",
        "glm-4.5",
        "glm-4.6",
        "qwen3-max",
        "deepseek-v3.1",
        "qwen3-vl-plus",
        "deepseek-v3.2"
      ],
      "transformer": {
        "deepseek-v3.1": {
          "use": [
            [
              "maxtoken",
              {
                "max_tokens": 8192
              }
            ]
          ]
        }
      }
    },
  ],
  Router: {
    default: "iflow,glm-4.6",
    background: "iflow_2,glm-4.6",
    // think: "yunwu,gpt-5-mini",
    // longContext: "yunwu,glm-4.6",
    // webSearch: "yunwu,kimi-k2-0711-preview-search"
    // default: "yunwu_code,claude-haiku-4-5-20251001",
    // background: "yunwu_code,claude-haiku-4-5-20251001",
    think: "yunwu_code,claude-haiku-4-5-20251001",
    // longContext: "yunwu_code,claude-haiku-4-5-20251001",
    // webSearch: "yunwu_code,claude-haiku-4-5-20251001"
  }
};

module.exports = {
  PROVIDER_CONFIG: config
}