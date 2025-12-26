## Providers 字段说明

- `name`: 供应商唯一标识，用于在路由或模型选择时引用。
- `api_base_url`: 该供应商的聊天/补全 API 基础地址。
- `limit`: 当前活跃的并发/请求数上限控制（业务方自定义的节流阈值）。
- `api_key`: 必填主密钥字段；即使提供了 `api_keys` 也需要保留，可填任意占位值。
- `api_keys`: 可轮换的密钥列表，便于做简单的轮询或故障切换。
- `models`: 此供应商可用的模型名称列表；路由默认值或调用参数应在此列出的模型里。
- `transformer`: 针对特定模型的请求预处理配置。键为模型名，值为配置对象：
  - `use`: 数组形式的处理步骤，每个元素是 `[处理器名, 配置对象]` 的二元数组。
    - 示例：`["maxtoken", { max_tokens: 8192 }]` 表示为该模型强制设置最大输出 tokens。

## 示例结构

```json
{
  "name": "iflow",
  "api_base_url": "https://apis.iflow.cn/v1/chat/completions",
  "limit": 1,
  "api_key": "sk-xxxx",
  "api_keys": ["sk-foo", "sk-bar"],
  "models": ["glm-4.6", "deepseek-v3.1"],
  "transformer": {
    "deepseek-v3.1": {
      "use": [["maxtoken", { "max_tokens": 8192 }]]
    }
  }
}
```
