# Parser 模块

用于从 markdown 流式内容中提取 HTML 代码块和 diff 格式代码的解析器模块。

## 功能

### 1. HTML 代码块提取

- `extractHtmlCode(content: string)`: 提取完整的 HTML 代码块
- `extractHtmlCodeIncremental(content: string)`: 支持流式写入的增量提取（可提取不完整的代码块）

### 2. Diff 格式提取

支持多种 diff 格式变体，以适应 AI 输出的不确定性：

#### 支持的 SEARCH 标记格式：
- `------- SEARCH` (标准格式，同一行)
- `-------\nSEARCH` (换行格式)
- `<<<<< SEARCH` (变体格式，同一行)
- `<<<<<\nSEARCH` (变体格式，换行)
- `11<<<<< SEARCH` (带前导数字的变体)

#### 支持的分隔符格式：
- `=======` (标准格式，至少3个等号)
- `===` (简短格式)

#### 支持的 REPLACE 标记格式：
- `>>>>>>> REPLACE` (标准格式，同一行)
- `>>>>>>>\nREPLACE` (换行格式)
- `+++++++ REPLACE` (变体格式，同一行)
- `+++++++\nREPLACE` (变体格式，换行)

### 3. 核心函数

- `hasDiffFormat(content: string, config?)`: 检测内容是否包含 diff 格式
- `extractDiffBlocks(content: string, config?)`: 提取所有 diff 代码块
- `parseCodeBlocks(content: string, language?)`: 解析代码块

## 使用示例

```javascript
const { extractHtmlCode, extractDiffBlocks, hasDiffFormat } = require('./parser');

// 提取 HTML 代码
const htmlCode = extractHtmlCode(markdownContent);
if (htmlCode) {
  console.log('找到 HTML 代码:', htmlCode);
}

// 检测并提取 diff
if (hasDiffFormat(markdownContent)) {
  const diffContent = extractDiffBlocks(markdownContent);
  if (diffContent) {
    console.log('找到 diff 内容:', diffContent);
  }
}
```

## 测试

运行测试：

```bash
# 使用 Node.js
node test-runner.js

# 使用 bun
bun test-runner.js
```

测试文件 `test-runner.ts` 包含了多种格式变体的测试用例，确保解析器能够正确处理各种格式。

## 实际案例

以下是从 `未完成.md` 中提取的真实格式示例：

### 案例 1: 标准格式（同一行）
```
------- SEARCH
code here
=======
new code here
>>>>>>> REPLACE
```

### 案例 2: 换行格式
```
-------
SEARCH
code here
=======
new code here
>>>>>>> REPLACE
```

### 案例 3: 变体格式（<<<<<）
```
11<<<<< SEARCH
code here
=======
new code here
>>>>>>> REPLACE
```

所有这些格式都能被正确识别和提取。

