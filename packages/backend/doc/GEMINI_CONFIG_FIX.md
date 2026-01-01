# Gemini Provider 配置修复指南

## 问题描述

错误信息：`Error from provider(gemini,undefined: 404)`

这个错误表明请求已到达 Gemini provider，但返回了 404。通常是因为 Gemini provider 的配置不正确。

## 解决方案

### 1. 确保使用 Gemini Transformer

`@musistudio/llms` 库内置了 `gemini` transformer，它会自动处理 Gemini API 的特殊端点格式。你需要在 provider 配置中指定使用这个 transformer。

### 2. 正确的 Gemini Provider 配置

```json
{
  "name": "gemini",
  "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models",
  "api_key": "your-api-key-here",
  "api_keys": ["your-api-key-here"],
  "models": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-3-flash-preview"],
  "transformer": {
    "use": [["gemini"]]
  }
}
```

### 3. 关键配置说明

- **api_base_url**: 应该是 `https://generativelanguage.googleapis.com/v1beta/models`（不需要包含 `:generateContent`，transformer 会自动处理）
- **transformer**: 必须包含 `["gemini"]`，这样 `@musistudio/llms` 才会使用 Gemini transformer 来处理请求
- **模型名称**: 使用正确的 Gemini 模型名称，例如：
  - `gemini-1.5-flash`
  - `gemini-1.5-pro`
  - `gemini-3-flash-preview`
  - `gemini-2.0-flash-exp`

### 4. 在 UI 中配置

在编辑 Provider 页面：

1. **名称 (ID)**: `gemini`
2. **基础地址**: `https://generativelanguage.googleapis.com/v1beta/models`
3. **API 密钥**: 你的 Google API 密钥
4. **模型列表**: 添加模型，例如 `gemini-3-flash-preview`
5. **Transformer 转换器**: 选择 `GeminiTransformer`（在作用域下拉菜单中选择）

### 5. 验证配置

配置完成后，尝试发送一个测试请求。如果仍然出现 404 错误，请检查：

- API 密钥是否有效
- 模型名称是否正确
- Transformer 是否正确配置

## 常见问题

### Q: 为什么需要 transformer？

A: Gemini API 的端点格式与其他 API（如 OpenAI）不同。Gemini transformer 会将标准的 `/v1/messages` 请求转换为 Gemini API 的格式（`/v1beta/models/{model}:generateContent`）。

### Q: 模型名称在哪里查找？

A: 可以在 [Google AI Studio](https://makersuite.google.com/app/apikey) 或 [Gemini API 文档](https://ai.google.dev/models/gemini) 中查找最新的模型名称。

### Q: 仍然出现 404 错误？

A: 请检查：

1. API 密钥是否有效且有权限访问 Gemini API
2. 模型名称是否正确（注意大小写和连字符）
3. 网络连接是否正常
4. 查看服务器日志获取更详细的错误信息
