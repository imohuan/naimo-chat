/**
 * Parser 模块测试运行器
 * 独立运行测试，不依赖外部测试框架
 * 
 * 使用方法：
 * - node test-runner.js
 * - bun test-runner.js
 */

const {
  extractHtmlCode,
  extractHtmlCodeIncremental,
  extractDiffBlocks,
  hasDiffFormat,
  parseCodeBlocks,
} = require("./index");

// 简单的测试辅助函数
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failCount++;
    console.error(`  ❌ ${name}`);
    console.error(`     ${error.message}`);
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) {
        throw new Error(`Expected "${value}" to be "${expected}"`);
      }
    },
    toBeNull() {
      if (value !== null) {
        throw new Error(`Expected ${value} to be null`);
      }
    },
    not: {
      toBeNull() {
        if (value === null) {
          throw new Error(`Expected value not to be null`);
        }
      },
    },
    toContain(substring) {
      if (!value || !value.includes(substring)) {
        throw new Error(`Expected "${value?.substring(0, 50)}..." to contain "${substring}"`);
      }
    },
    toHaveLength(length) {
      if (!Array.isArray(value) || value.length !== length) {
        throw new Error(`Expected array to have length ${length}, got ${value?.length || 0}`);
      }
    },
  };
}

function describe(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

// ========== 测试用例 ==========

function runAllTests() {
  console.log("🚀 开始运行 Parser 测试...\n");

  describe("parseCodeBlocks", () => {
    test("应该解析简单的 HTML 代码块", () => {
      const content = `这是一个测试\n\`\`\`html\n<div>Hello</div>\n\`\`\`\n结束`;
      const blocks = parseCodeBlocks(content, "html");
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe("html");
      expect(blocks[0].code).toBe("<div>Hello</div>");
    });

    test("应该解析多个代码块", () => {
      const content = `
\`\`\`html
<div>First</div>
\`\`\`

\`\`\`html
<div>Second</div>
\`\`\`
`;
      const blocks = parseCodeBlocks(content, "html");
      expect(blocks).toHaveLength(2);
      expect(blocks[1].code).toBe("<div>Second</div>");
    });
  });

  describe("extractHtmlCode", () => {
    test("应该提取 HTML 代码块", () => {
      const content = `\`\`\`html\n<!DOCTYPE html>\n<html><body>Test</body></html>\n\`\`\``;
      const html = extractHtmlCode(content);
      expect(html).toBe("<!DOCTYPE html>\n<html><body>Test</body></html>");
    });

    test("应该返回最后一个 HTML 代码块", () => {
      const content = `
\`\`\`html
<div>First</div>
\`\`\`

\`\`\`html
<div>Second</div>
\`\`\`
`;
      const html = extractHtmlCode(content);
      expect(html).toBe("<div>Second</div>");
    });

    test("如果没有 HTML 代码块应该返回 null", () => {
      const content = `\`\`\`javascript\nconsole.log('test');\n\`\`\``;
      const html = extractHtmlCode(content);
      expect(html).toBeNull();
    });
  });

  describe("extractHtmlCodeIncremental", () => {
    test("应该提取完整的 HTML 代码块", () => {
      const content = `\`\`\`html\n<div>Complete</div>\n\`\`\``;
      const html = extractHtmlCodeIncremental(content);
      expect(html).toBe("<div>Complete</div>");
    });

    test("应该提取不完整的 HTML 代码块（流式写入）", () => {
      const content = `\`\`\`html\n<div>Incomplete`;
      const html = extractHtmlCodeIncremental(content);
      expect(html).toBe("<div>Incomplete");
    });
  });

  describe("hasDiffFormat", () => {
    test("应该检测标准格式的 diff（同一行）", () => {
      const content = `------- SEARCH\ncode\n=======\nnew code\n+++++++ REPLACE`;
      expect(hasDiffFormat(content)).toBe(true);
    });

    test("应该检测换行格式的 diff（SEARCH 换行）", () => {
      const content = `-------\nSEARCH\ncode\n=======\nnew code\n+++++++ REPLACE`;
      expect(hasDiffFormat(content)).toBe(true);
    });

    test("应该检测变体格式的 diff（<<<<< 格式）", () => {
      const content = `<<<<< SEARCH\ncode\n=======\nnew code\n>>>>>>> REPLACE`;
      expect(hasDiffFormat(content)).toBe(true);
    });

    test("应该检测变体格式的 diff（<<<<< 换行）", () => {
      const content = `<<<<<\nSEARCH\ncode\n=======\nnew code\n>>>>>>> REPLACE`;
      expect(hasDiffFormat(content)).toBe(true);
    });

    test("不应该检测没有分隔符的内容", () => {
      const content = `------- SEARCH\ncode`;
      expect(hasDiffFormat(content)).toBe(false);
    });
  });

  describe("extractDiffBlocks - 标准格式（同一行）", () => {
    test("应该提取标准的 diff 格式（代码块中）", () => {
      const content = `
\`\`\`
------- SEARCH
            document.body.addEventListener('click', function(e) {
                createFirework(e.clientX, e.clientY);
            });
=======
            document.addEventListener('mousemove', function(e) {
                createFirework(e.clientX, e.clientY);
            });
+++++++ REPLACE
\`\`\`
`;
      const diff = extractDiffBlocks(content);
      expect(diff).not.toBeNull();
      expect(diff).toContain("------- SEARCH");
      expect(diff).toContain("=======");
      expect(diff).toContain("+++++++ REPLACE");
      expect(diff).toContain("addEventListener('click'");
      expect(diff).toContain("addEventListener('mousemove'");
    });

    test("应该提取标准的 diff 格式（不在代码块中）", () => {
      const content = `
Some text before

------- SEARCH
old code
=======
new code
+++++++ REPLACE

Some text after
`;
      const diff = extractDiffBlocks(content);
      expect(diff).not.toBeNull();
      expect(diff).toContain("------- SEARCH");
      expect(diff).toContain("old code");
      expect(diff).toContain("new code");
    });
  });

  describe("extractDiffBlocks - 换行格式", () => {
    test("应该提取 SEARCH 换行的 diff 格式", () => {
      const content = `
\`\`\`
-------
SEARCH
            document.body.addEventListener('click', function(e) {
                createFirework(e.clientX, e.clientY);
            });
=======
            document.addEventListener('mousemove', function(e) {
                createFirework(e.clientX, e.clientY);
            });
>>>>>>> REPLACE
\`\`\`
`;
      const diff = extractDiffBlocks(content);
      expect(diff).not.toBeNull();
      expect(diff).toContain("SEARCH");
      expect(diff).toContain("=======");
      expect(diff).toContain(">>>>>>> REPLACE");
    });
  });

  describe("extractDiffBlocks - 变体格式（<<<<<）", () => {
    test("应该提取 <<<<< 格式的 diff（同一行）", () => {
      const content = `
\`\`\`
11<<<<< SEARCH
            document.body.addEventListener('click', function(e) {
                createFirework(e.clientX, e.clientY);
            });
=======
            document.addEventListener('mousemove', function(e) {
                createFirework(e.clientX, e.clientY);
            });
>>>>>>> REPLACE
\`\`\`
`;
      const diff = extractDiffBlocks(content);
      expect(diff).not.toBeNull();
      expect(diff).toContain("<<<<< SEARCH");
      expect(diff).toContain("=======");
      expect(diff).toContain(">>>>>>> REPLACE");
    });

    test("应该提取 <<<<< 格式的 diff（换行）", () => {
      const content = `
\`\`\`
<<<<<
SEARCH
old code
=======
new code
>>>>>>> REPLACE
\`\`\`
`;
      const diff = extractDiffBlocks(content);
      expect(diff).not.toBeNull();
      expect(diff).toContain("SEARCH");
      expect(diff).toContain("old code");
      expect(diff).toContain("new code");
    });
  });

  describe("extractDiffBlocks - 实际案例（未完成.md 中的格式）", () => {
    test("应该提取未完成.md 中的第一个格式", () => {
      const content = `
\`\`\`
------- SEARCH
            document.body.addEventListener('click', function(e) {
                createFirework(e.clientX, e.clientY);
            });

            function createFirework(x, y) {
=======
            document.addEventListener('mousemove', function(e) {
                createFirework(e.clientX, e.clientY);
            });

            function createFirework(x, y) {
>>>>>>> REPLACE
\`\`\`
`;
      const diff = extractDiffBlocks(content);
      expect(diff).not.toBeNull();
      expect(diff).toContain("------- SEARCH");
      expect(diff).toContain("document.body.addEventListener('click'");
      expect(diff).toContain("document.addEventListener('mousemove'");
    });

    test("应该提取未完成.md 中的第二个格式（<<<<<）", () => {
      const content = `
\`\`\`
11<<<<< SEARCH
            document.body.addEventListener('click', function(e) {
                createFirework(e.clientX, e.clientY);
            });

            function createFirework(x, y) {
=======
            document.addEventListener('mousemove', function(e) {
                createFirework(e.clientX, e.clientY);
            });

            function createFirework(x, y) {
>>>>>>> REPLACE
\`\`\`
`;
      const diff = extractDiffBlocks(content);
      expect(diff).not.toBeNull();
      expect(diff).toContain("<<<<< SEARCH");
      expect(diff).toContain("document.body.addEventListener('click'");
    });
  });

  describe("extractDiffBlocks - 边界情况", () => {
    test("应该处理空内容", () => {
      const diff = extractDiffBlocks("");
      expect(diff).toBeNull();
    });

    test("应该处理不包含 diff 的内容", () => {
      const content = `Just regular text without any diff format`;
      const diff = extractDiffBlocks(content);
      expect(diff).toBeNull();
    });

    test("应该在 HTML 代码块中提取 diff", () => {
      const content = `
\`\`\`html
------- SEARCH
<div>Old</div>
=======
<div>New</div>
+++++++ REPLACE
\`\`\`
`;
      const diff = extractDiffBlocks(content);
      expect(diff).not.toBeNull();
      expect(diff).toContain("<div>Old</div>");
      expect(diff).toContain("<div>New</div>");
    });
  });

  // 输出测试结果
  console.log(`\n${"=".repeat(50)}`);
  console.log(`测试完成: ${testCount} 个测试`);
  console.log(`✅ 通过: ${passCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`${"=".repeat(50)}\n`);

  return failCount === 0;
}

// 运行测试
if (require.main === module) {
  const success = runAllTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runAllTests };

