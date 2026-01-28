# 常用命令

## 开发

```bash
pnpm dev              # 启动开发服务器 http://localhost:5173
pnpm preview          # 预览生产构建
```

## 构建

```bash
pnpm build            # 类型检查 + 构建
```

## 代码质量

```bash
pnpm lint             # 代码检查
pnpm format           # 代码格式化
pnpm lint:format      # 检查 + 格式化
```

## 测试

```bash
pnpm test             # 运行测试（单次）
pnpm test:watch       # 监听模式
pnpm test:coverage    # 覆盖率报告
```

## CI

```bash
pnpm ci               # lint → format → build
```
