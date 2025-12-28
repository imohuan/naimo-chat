# 消息临时字段说明

本文档说明在消息对象中可以使用的临时字段，这些字段用于控制消息的处理行为，并在处理完成后自动清理。

## `_checkVariables`

### 说明

用于在变量替换时检查指定的变量是否为空。如果任何一个变量为空（`undefined`、`null` 或空字符串），则该消息会被自动删除。

### 类型

```typescript
_checkVariables?: string[]
```

### 使用场景

当某个消息依赖于某些变量，而这些变量可能为空时，可以使用此字段来确保只有在变量存在时才包含该消息。

### 示例

```javascript
{
  role: "user",
  content: `当前编辑器中的代码：\n\`\`\`\n{{editorCode}}\n\`\`\``,
  _checkVariables: ["editorCode"],
}
```

### 处理逻辑

- 在 `replaceVariablesInMessages` 函数中处理
- 检查 `_checkVariables` 数组中列出的所有变量
- 如果任何一个变量为空，该消息会被删除（返回 `null`）
- 如果所有变量都不为空，正常进行变量替换
- 处理完成后，`_checkVariables` 属性会被自动删除

### 注意事项

- 此字段会在变量替换完成后自动清理，不会出现在最终的消息对象中
- 变量检查发生在变量替换之前
- 空值判断：`undefined`、`null` 或 `""` 都被视为空

---

## `_noInsertFiles`

### 说明

用于标记消息是否允许插入文件。如果消息有此标记，当需要添加文件时，系统会创建新的 user 消息来包含文件，而不是将文件添加到当前消息中。

### 类型

```typescript
_noInsertFiles?: boolean
```

### 使用场景

当某个消息的内容结构固定，不应该被文件插入操作修改时，可以使用此字段。

### 示例

```javascript
{
  role: "user",
  content: `<format_selection>...</format_selection>\n用户输入：{{userInput}}`,
  _noInsertFiles: true, // 标记此消息不允许插入文件
}
```

### 处理逻辑

- 在 `addFilesToLastUserMessage` 函数中处理
- 如果最后一个 user 消息有 `_noInsertFiles: true` 标记，则创建新的 user 消息来包含文件
- 如果没有此标记或标记为 `false`，文件会被添加到现有的最后一个 user 消息中
- 处理完成后，所有消息中的 `_noInsertFiles` 属性会被自动删除

### 注意事项

- 此字段会在文件添加完成后自动清理，不会出现在最终的消息对象中
- 只有在需要添加文件时才会检查此字段
- 如果消息数组中没有 user 消息，会直接创建新的 user 消息（不受此字段影响）

---

## 字段清理时机

| 字段              | 清理位置              | 清理时机       |
| ----------------- | --------------------- | -------------- |
| `_checkVariables` | `variableReplacer.js` | 变量替换完成后 |
| `_noInsertFiles`  | `messageHelper.js`    | 文件添加完成后 |

**重要提示**：这些字段都是临时字段，不应该出现在最终发送给 LLM 的消息中。系统会自动清理这些字段，无需手动处理。
