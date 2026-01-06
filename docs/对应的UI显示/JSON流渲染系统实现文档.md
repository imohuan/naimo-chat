# JSON流渲染系统完整实现文档

## 目录
1. [系统架构概述](#系统架构概述)
2. [核心组件设计](#核心组件设计)
3. [服务端实现](#服务端实现)
4. [前端实现](#前端实现)
5. [数据流处理](#数据流处理)
6. [完整代码示例](#完整代码示例)
7. [部署与配置](#部署与配置)
8. [常见问题与解决方案](#常见问题与解决方案)

---

## 系统架构概述

### 核心概念
本系统实现了一个实时的JSON流渲染架构，主要用于处理CLI工具（如Claude Code）的JSON输出，并在Web界面中以结构化方式展示。

### 架构图
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   CLI工具   │────▶│  进程管理器   │────▶│  JSON解析器  │────▶│  流管理器   │
│  (Claude)   │     │              │     │              │     │              │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
                                                                  │
                                                                  ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   前端UI    │◀────│   SSE连接    │◀────│  路由处理   │◀────│  广播器     │
│             │     │              │     │              │     │              │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
```

---

## 核心组件设计

### 1. 进程管理器 (ProcessManager)
**职责**: 管理外部CLI进程的生命周期，处理进程间通信

**核心功能**:
- 启动/停止CLI进程
- 捕获stdout/stderr输出
- 环境变量管理
- 进程状态监控

### 2. JSON流解析器 (JsonLinesParser)
**职责**: 解析CLI输出的JSONL格式数据

**核心功能**:
- 逐行解析JSON
- 错误处理与恢复
- 缓冲区管理
- 数据验证

### 3. 流管理器 (StreamManager)
**职责**: 管理客户端连接和数据广播

**核心功能**:
- SSE连接管理
- 客户端注册/注销
- 消息广播
- 心跳机制

### 4. 前端渲染引擎
**职责**: 将JSON数据渲染为可视化界面

**核心功能**:
- 实时数据接收
- 类型识别
- 组件化渲染
- 交互处理

---

## 服务端实现

### 1. 进程管理器实现

```typescript
// process-manager.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ProcessConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  outputFormat?: 'json' | 'text';
}

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();

  async startProcess(id: string, config: ProcessConfig): Promise<void> {
    // 构建命令参数
    const args = [...(config.args || [])];
    if (config.outputFormat === 'json') {
      args.push('--json');
    }

    // 启动进程
    const process = spawn(config.command, args, {
      env: { ...process.env, ...config.env },
      cwd: config.cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 存储进程引用
    this.processes.set(id, process);
    this.outputBuffers.set(id, '');

    // 设置输出处理
    this.setupOutputHandlers(id, process);

    // 设置错误处理
    this.setupErrorHandlers(id, process);
  }

  private setupOutputHandlers(id: string, process: ChildProcess): void {
    if (process.stdout) {
      const parser = new JsonLinesParser();

      process.stdout.pipe(parser);

      parser.on('data', (data) => {
        this.emit('process-data', { id, data });
        this.broadcastToClients(id, data);
      });

      parser.on('error', (error) => {
        this.emit('process-error', { id, error });
      });
    }

    if (process.stderr) {
      process.stderr.on('data', (data) => {
        const errorText = data.toString();
        this.emit('process-stderr', { id, error: errorText });
      });
    }
  }

  private setupErrorHandlers(id: string, process: ChildProcess): void {
    process.on('error', (error) => {
      this.emit('process-error', { id, error });
    });

    process.on('exit', (code, signal) => {
      this.emit('process-exit', { id, code, signal });
      this.processes.delete(id);
      this.outputBuffers.delete(id);
    });
  }

  stopProcess(id: string): Promise<void> {
    return new Promise((resolve) => {
      const process = this.processes.get(id);
      if (!process) {
        resolve();
        return;
      }

      process.kill('SIGTERM');

      const timeout = setTimeout(() => {
        process.kill('SIGKILL');
        resolve();
      }, 5000);

      process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private broadcastToClients(streamId: string, data: any): void {
    // 这个方法需要与StreamManager集成
    this.emit('broadcast', { streamId, data });
  }
}
```

### 2. JSON流解析器实现

```typescript
// json-lines-parser.ts
import { Transform, TransformCallback } from 'stream';

export class JsonLinesParser extends Transform {
  private buffer: string = '';
  private options: { objectMode: boolean };

  constructor(options = { objectMode: true }) {
    super(options);
    this.options = options;
  }

  _transform(chunk: Buffer | string, encoding: string, callback: TransformCallback): void {
    // 将新数据添加到缓冲区
    this.buffer += chunk.toString();

    // 按换行符分割，保留最后一个不完整的行
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    // 处理每个完整的行
    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          this.push(parsed);
        } catch (error) {
          this.emit('error', new Error(`Invalid JSON: ${line}`));
        }
      }
    }

    callback();
  }

  _flush(callback: TransformCallback): void {
    // 处理流结束时剩余的数据
    if (this.buffer.trim()) {
      try {
        const parsed = JSON.parse(this.buffer);
        this.push(parsed);
      } catch (error) {
        this.emit('error', new Error(`Invalid JSON: ${this.buffer}`));
      }
    }
    callback();
  }

  reset(): void {
    this.buffer = '';
  }

  getBuffer(): string {
    return this.buffer;
  }
}
```

### 3. 流管理器实现

```typescript
// stream-manager.ts
import { EventEmitter } from 'events';
import { Response } from 'express';

export interface StreamClient {
  id: string;
  response: Response;
  connectedAt: Date;
  lastActivity: Date;
}

export class StreamManager extends EventEmitter {
  private clients: Map<string, StreamClient[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒

  constructor() {
    super();
    this.startHeartbeat();
  }

  addClient(streamId: string, response: Response): void {
    // 设置SSE响应头
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 创建客户端对象
    const client: StreamClient = {
      id: this.generateClientId(),
      response,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    // 添加客户端到对应流
    if (!this.clients.has(streamId)) {
      this.clients.set(streamId, []);
    }
    this.clients.get(streamId)!.push(client);

    // 发送连接确认
    this.sendToClient(client, {
      type: 'connected',
      clientId: client.id,
      timestamp: new Date().toISOString()
    });

    // 设置断开连接处理
    response.on('close', () => {
      this.removeClient(streamId, client.id);
    });

    response.on('error', () => {
      this.removeClient(streamId, client.id);
    });

    this.emit('client-connected', { streamId, clientId: client.id });
  }

  removeClient(streamId: string, clientId: string): void {
    const streamClients = this.clients.get(streamId);
    if (streamClients) {
      const index = streamClients.findIndex(c => c.id === clientId);
      if (index !== -1) {
        streamClients.splice(index, 1);
        if (streamClients.length === 0) {
          this.clients.delete(streamId);
        }
      }
    }
    this.emit('client-disconnected', { streamId, clientId });
  }

  broadcast(streamId: string, data: any): void {
    const clients = this.clients.get(streamId);
    if (!clients) return;

    const deadClients: StreamClient[] = [];

    for (const client of clients) {
      try {
        this.sendToClient(client, data);
        client.lastActivity = new Date();
      } catch (error) {
        deadClients.push(client);
      }
    }

    // 移除死连接
    for (const deadClient of deadClients) {
      this.removeClient(streamId, deadClient.id);
    }
  }

  private sendToClient(client: StreamClient, data: any): void {
    const sseData = this.formatSSEData(data);
    client.response.write(sseData);
  }

  private formatSSEData(data: any): string {
    const lines = [
      `data: ${JSON.stringify(data)}`,
      '', // 空行表示消息结束
      ''
    ];
    return lines.join('\n');
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private sendHeartbeat(): void {
    for (const [streamId, clients] of this.clients.entries()) {
      const heartbeat = {
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      };
      this.broadcast(streamId, heartbeat);
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // 关闭所有连接
    for (const [streamId, clients] of this.clients.entries()) {
      for (const client of clients) {
        try {
          client.response.end();
        } catch (error) {
          // 忽略关闭错误
        }
      }
    }

    this.clients.clear();
  }
}
```

### 4. Express路由集成

```typescript
// streaming.routes.ts
import { Router } from 'express';
import { StreamManager } from './stream-manager';

export function createStreamingRoutes(streamManager: StreamManager): Router {
  const router = Router();

  // SSE流端点
  router.get('/:streamId', (req, res) => {
    const { streamId } = req.params;

    // 设置超时
    req.setTimeout(0); // 无超时

    // 添加客户端到流
    streamManager.addClient(streamId, res);
  });

  return router;
}

// 主服务器集成示例
// app.ts
import express from 'express';
import { ProcessManager } from './process-manager';
import { StreamManager } from './stream-manager';
import { createStreamingRoutes } from './streaming.routes';

const app = express();
const processManager = new ProcessManager();
const streamManager = new StreamManager();

// 集成进程管理器和流管理器
processManager.on('broadcast', ({ streamId, data }) => {
  streamManager.broadcast(streamId, data);
});

// 注册路由
app.use('/api/stream', createStreamingRoutes(streamManager));

// 启动服务器的代码...
```

---

## 前端实现

### 1. 流式数据接收Hook

```typescript
// useStreaming.ts
import { useEffect, useRef, useCallback, useState } from 'react';

interface StreamEvent {
  type: string;
  data?: any;
  timestamp?: string;
  clientId?: string;
}

interface UseStreamingOptions {
  onMessage: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useStreaming(
  streamId: string | null,
  options: UseStreamingOptions
) {
  const [isConnected, setIsConnected] = useState(false);
  const [shouldReconnect, setShouldReconnect] = useState(true);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);

  // 保持options引用最新
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const disconnect = useCallback(() => {
    setShouldReconnect(false);

    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsConnected((prev) => {
      if (prev) {
        optionsRef.current.onDisconnect?.();
      }
      return false;
    });
  }, []);

  const connect = useCallback(async () => {
    if (!streamId || readerRef.current || abortControllerRef.current) {
      return;
    }

    setShouldReconnect(true);

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch(`/api/stream/${streamId}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Stream connection failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      setIsConnected(true);
      optionsRef.current.onConnect?.();

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              // 处理SSE格式
              let jsonLine = line;
              if (line.startsWith('data: ')) {
                jsonLine = line.substring(6);
              }

              // 跳过SSE注释
              if (line.startsWith(':')) {
                continue;
              }

              const event = JSON.parse(jsonLine) as StreamEvent;
              optionsRef.current.onMessage(event);
            } catch (err) {
              console.error('Failed to parse stream message:', line, err);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Stream error:', error);
        optionsRef.current.onError?.(error);
      }
    } finally {
      const wasIntentional = !shouldReconnect;
      disconnect();

      // 自动重连
      if (!wasIntentional && document.visibilityState === 'visible' && streamId) {
        setTimeout(() => {
          setShouldReconnect(true);
          connect();
        }, 5000);
      }
    }
  }, [streamId, disconnect]);

  useEffect(() => {
    if (streamId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [streamId]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}
```

### 2. 消息组件实现

```typescript
// MessageItem.tsx
import React, { useState } from 'react';
import {
  Copy, Check, Code, FileText, Edit, Terminal,
  ChevronDown, ChevronRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { JsonViewer } from './JsonViewer';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string | ContentBlock[];
  timestamp?: string;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'thinking' | 'json';
  content?: any;
  tool_name?: string;
  tool_input?: any;
  id?: string;
}

export function MessageItem({ message }: { message: Message }) {
  const [copiedBlocks, setCopiedBlocks] = useState<Set<string>>(new Set());

  const copyContent = async (content: string, blockId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedBlocks(prev => new Set(prev).add(blockId));
      setTimeout(() => {
        setCopiedBlocks(prev => {
          const next = new Set(prev);
          next.delete(blockId);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getToolIcon = (toolName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'Read': <FileText size={15} />,
      'Edit': <Edit size={15} />,
      'Bash': <Terminal size={15} />,
      'Write': <Edit size={15} />,
    };
    return iconMap[toolName] || <Code size={15} />;
  };

  // 处理用户消息
  if (message.type === 'user') {
    const content = typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content)
        ? message.content
            .filter(block => block.type === 'text')
            .map(block => block.content)
            .join('\n')
        : '';

    return (
      <div className="flex justify-end w-full my-1">
        <div className="bg-blue-500 text-white rounded-xl p-3 max-w-[80%]">
          <div className="text-sm whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    );
  }

  // 处理助手消息
  if (message.type === 'assistant') {
    const renderContentBlock = (block: ContentBlock, index: number) => {
      const blockId = `${message.id}-${index}`;

      switch (block.type) {
        case 'text':
          return (
            <div key={blockId} className="flex gap-2 items-start">
              <div className="w-4 h-5 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-gray-500 rounded-full" />
              </div>
              <div className="flex-1 prose prose-sm max-w-none">
                <ReactMarkdown>{block.content}</ReactMarkdown>
              </div>
            </div>
          );

        case 'tool_use':
          return (
            <div key={blockId} className="flex gap-2 items-start">
              <div className="w-4 h-5 flex items-center justify-center">
                {getToolIcon(block.tool_name || 'tool')}
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="font-medium text-sm mb-2">
                    {block.tool_name}
                  </div>
                  <JsonViewer
                    data={block.tool_input}
                    collapsed={true}
                    depth={1}
                  />
                </div>
              </div>
            </div>
          );

        case 'thinking':
          return (
            <div key={blockId} className="flex gap-2 items-start">
              <div className="w-4 h-5 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-gray-500 rounded-full" />
              </div>
              <div className="flex-1 prose prose-sm max-w-none italic text-gray-600">
                <ReactMarkdown>{block.content}</ReactMarkdown>
              </div>
            </div>
          );

        default:
          return (
            <div key={blockId} className="flex gap-2 items-start">
              <div className="w-4 h-5 flex items-center justify-center">
                <Code size={15} />
              </div>
              <div className="flex-1">
                <JsonViewer data={block} />
              </div>
            </div>
          );
      }
    };

    const content = Array.isArray(message.content) ? message.content : [];

    return (
      <div className="w-full my-1">
        <div className="bg-white rounded-xl p-3 border">
          {content.map((block, index) => renderContentBlock(block, index))}
        </div>
      </div>
    );
  }

  // 处理错误消息
  if (message.type === 'error') {
    return (
      <div className="w-full my-2">
        <div className="text-red-600 text-sm p-3 bg-red-50 rounded-md border border-red-200">
          {String(message.content)}
        </div>
      </div>
    );
  }

  return null;
}
```

### 3. JSON查看器组件

```typescript
// JsonViewer.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  collapsed?: boolean;
  depth?: number;
  maxDepth?: number;
}

export function JsonViewer({
  data,
  collapsed = false,
  depth = 0,
  maxDepth = 10
}: JsonViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed && depth > 0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderValue = (value: any, key?: string): React.ReactNode => {
    // 基础类型
    if (value === null) {
      return <span className="text-gray-500">null</span>;
    }
    if (value === undefined) {
      return <span className="text-gray-500">undefined</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="text-blue-600">{value.toString()}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-green-600">{value}</span>;
    }
    if (typeof value === 'string') {
      return <span className="text-green-700">"{value}"</span>;
    }

    // 数组类型
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-800">[]</span>;
      }

      if (depth >= maxDepth) {
        return (
          <span className="text-gray-600">
            [{value.length} items]
          </span>
        );
      }

      return (
        <span className="inline-block">
          {depth > 0 && (
            <button
              className="inline-flex items-center justify-center w-4 h-4 mr-1 text-gray-500 hover:text-gray-700"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <span className="text-gray-800">[</span>
          {isCollapsed ? (
            <span className="text-gray-500 italic mx-1">
              ...{value.length} items
            </span>
          ) : (
            <div className="ml-4">
              {value.map((item, index) => (
                <div key={index} className="py-0.5">
                  <span className="text-gray-600 mr-1">{index}:</span>
                  {renderValue(item)}
                  {index < value.length - 1 && <span className="text-gray-800">,</span>}
                </div>
              ))}
            </div>
          )}
          <span className="text-gray-800">]</span>
        </span>
      );
    }

    // 对象类型
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-gray-800">{'{}'}</span>;
      }

      if (depth >= maxDepth) {
        return (
          <span className="text-gray-600">
            {'{'}{entries.length} properties{'}'}
          </span>
        );
      }

      return (
        <span className="inline-block">
          {depth > 0 && (
            <button
              className="inline-flex items-center justify-center w-4 h-4 mr-1 text-gray-500 hover:text-gray-700"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <span className="text-gray-800">{'{'}</span>
          {isCollapsed ? (
            <span className="text-gray-500 italic mx-1">
              ...{entries.length} properties
            </span>
          ) : (
            <div className="ml-4">
              {entries.map(([k, v], index) => (
                <div key={k} className="py-0.5">
                  <span className="text-blue-700">"{k}"</span>
                  <span className="text-gray-800 mx-1">:</span>
                  {renderValue(v, k)}
                  {index < entries.length - 1 && <span className="text-gray-800">,</span>}
                </div>
              ))}
            </div>
          )}
          <span className="text-gray-800">{'}'}</span>
        </span>
      );
    }

    return <span className="text-gray-500">{String(value)}</span>;
  };

  return (
    <div className="relative font-mono text-xs leading-relaxed p-2 bg-gray-50 rounded">
      {depth === 0 && (
        <button
          className="absolute top-1 right-1 p-1 text-gray-500 hover:text-gray-700"
          onClick={handleCopy}
          title="Copy JSON"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
      {renderValue(data)}
    </div>
  );
}
```

### 4. 主应用组件

```typescript
// ChatApp.tsx
import React, { useState, useEffect } from 'react';
import { MessageItem } from './MessageItem';
import { useStreaming } from './useStreaming';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string | any[];
  timestamp: string;
}

export function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [input, setInput] = useState('');

  // 初始化流连接
  const handleStreamMessage = (event: any) => {
    switch (event.type) {
      case 'connected':
        console.log('Connected to stream:', event.clientId);
        break;

      case 'process-data':
        // 处理来自进程的数据
        const newMessage: Message = {
          id: `msg_${Date.now()}`,
          type: 'assistant',
          content: Array.isArray(event.data) ? event.data : [event.data],
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, newMessage]);
        break;

      case 'process-error':
        // 处理错误
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          type: 'error',
          content: event.error.message || 'Unknown error',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
        break;

      case 'heartbeat':
        // 心跳，可以忽略或用于连接状态显示
        break;

      default:
        console.log('Unknown event type:', event.type);
    }
  };

  useStreaming(streamId, {
    onMessage: handleStreamMessage,
    onError: (error) => {
      console.error('Stream error:', error);
    },
    onConnect: () => {
      console.log('Stream connected');
    },
    onDisconnect: () => {
      console.log('Stream disconnected');
    }
  });

  // 启动新的对话
  const startConversation = () => {
    const newStreamId = `stream_${Date.now()}`;
    setStreamId(newStreamId);

    // 这里应该调用API启动进程
    fetch('/api/conversations/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streamId: newStreamId,
        prompt: input
      })
    });

    // 添加用户消息
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>

      {/* 输入区域 */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && startConversation()}
            placeholder="输入消息..."
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={startConversation}
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 数据流处理

### 1. 消息格式定义

```typescript
// types.ts
export interface StreamMessage {
  type: 'content' | 'tool_use' | 'thinking' | 'error' | 'status';
  content?: any;
  tool_name?: string;
  tool_input?: any;
  id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ProcessOutput {
  type: string;
  content?: any;
  error?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}
```

### 2. 数据转换管道

```typescript
// data-processor.ts
export class DataProcessor {
  processRawOutput(rawData: any): StreamMessage {
    // 根据原始数据类型进行转换
    if (this.isToolUse(rawData)) {
      return {
        type: 'tool_use',
        tool_name: rawData.name,
        tool_input: rawData.input,
        id: rawData.id,
        timestamp: new Date().toISOString()
      };
    }

    if (this.isThinking(rawData)) {
      return {
        type: 'thinking',
        content: rawData.thinking,
        timestamp: new Date().toISOString()
      };
    }

    if (this.isContent(rawData)) {
      return {
        type: 'content',
        content: rawData.content,
        timestamp: new Date().toISOString()
      };
    }

    // 默认处理为内容
    return {
      type: 'content',
      content: rawData,
      timestamp: new Date().toISOString()
    };
  }

  private isToolUse(data: any): boolean {
    return data && typeof data === 'object' &&
           data.type === 'tool_use' &&
           data.name && data.input;
  }

  private isThinking(data: any): boolean {
    return data && typeof data === 'object' &&
           data.type === 'thinking';
  }

  private isContent(data: any): boolean {
    return data && (typeof data === 'string' ||
           (data.type === 'text' && data.text));
  }
}
```

---

## 完整代码示例

### 服务端完整示例

```typescript
// server.ts - 完整的服务端实现
import express from 'express';
import cors from 'cors';
import { ProcessManager } from './process-manager';
import { StreamManager } from './stream-manager';
import { DataProcessor } from './data-processor';

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 核心服务
const processManager = new ProcessManager();
const streamManager = new StreamManager();
const dataProcessor = new DataProcessor();

// 集成处理
processManager.on('broadcast', ({ streamId, data }) => {
  const processedData = dataProcessor.processRawOutput(data);
  streamManager.broadcast(streamId, processedData);
});

// 路由定义
app.post('/api/conversations/start', async (req, res) => {
  try {
    const { streamId, prompt, model = 'claude-3-sonnet' } = req.body;

    // 启动Claude进程
    await processManager.startProcess(streamId, {
      command: 'claude',
      args: [prompt, '--model', model, '--json'],
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      }
    });

    res.json({ success: true, streamId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conversations/stop/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    await processManager.stopProcess(streamId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/status/:streamId', (req, res) => {
  const { streamId } = req.params;
  const isActive = processManager.isProcessActive(streamId);
  res.json({ active: isActive });
});

// 集成流路由
app.use('/api/stream', (req, res, next) => {
  // 流路由中间件
  req.setTimeout(0);
  next();
}, require('./streaming.routes').createStreamingRoutes(streamManager));

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  streamManager.close();
  process.exit(0);
});
```

### 前端完整示例

```typescript
// App.tsx - 完整的前端应用
import React, { useState, useEffect } from 'react';
import { ChatApp } from './ChatApp';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 检查认证状态
    const token = localStorage.getItem('auth_token');
    setIsAuthenticated(!!token);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">登录</h2>
          <input
            type="password"
            placeholder="输入访问令牌"
            className="w-full p-2 border rounded mb-4"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                localStorage.setItem('auth_token', e.currentTarget.value);
                setIsAuthenticated(true);
              }
            }}
          />
        </div>
      </div>
    );
  }

  return <ChatApp />;
}

export default App;
```

---

## 部署与配置

### 1. 环境变量配置

```bash
# .env
ANTHROPIC_API_KEY=your_anthropic_api_key
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

### 2. Docker部署

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  cui-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./data:/app/data
```

### 3. 生产部署配置

```typescript
// production.config.ts
export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: '0.0.0.0',
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }
  },

  streaming: {
    heartbeatInterval: 30000,
    maxConnections: 1000,
    connectionTimeout: 300000 // 5分钟
  },

  process: {
    timeout: 600000, // 10分钟
    maxMemory: '512MB',
    retries: 3
  }
};
```

---

## 常见问题与解决方案

### 1. 连接断开问题

**问题**: SSE连接频繁断开
**解决方案**:
```typescript
// 实现指数退避重连
const reconnectWithBackoff = (attempt: number) => {
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
  setTimeout(connect, delay);
};
```

### 2. 内存泄漏

**问题**: 长时间运行后内存占用过高
**解决方案**:
```typescript
// 定期清理死连接
setInterval(() => {
  streamManager.cleanupDeadConnections();
}, 60000);

// 限制消息历史
const MAX_MESSAGES = 1000;
if (messages.length > MAX_MESSAGES) {
  setMessages(prev => prev.slice(-MAX_MESSAGES));
}
```

### 3. JSON解析错误

**问题**: 不完整的JSON数据导致解析失败
**解决方案**:
```typescript
// 增强的JSON解析器
class SafeJsonParser {
  parse(line: string): any {
    try {
      return JSON.parse(line);
    } catch (error) {
      // 尝试修复常见JSON问题
      const fixed = line
        .replace(/,\s*}/g, '}')  // 移除尾随逗号
        .replace(/,\s*]/g, ']');  // 移除数组尾随逗号

      try {
        return JSON.parse(fixed);
      } catch {
        throw new Error(`Invalid JSON: ${line}`);
      }
    }
  }
}
```

### 4. 性能优化

**问题**: 大量数据时渲染缓慢
**解决方案**:
```typescript
// 虚拟化长列表
import { FixedSizeList as List } from 'react-window';

const MessageList = ({ messages }) => (
  <List
    height={600}
    itemCount={messages.length}
    itemSize={100}
    itemData={messages}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <MessageItem message={data[index]} />
      </div>
    )}
  </List>
);

// 防抖更新
const debouncedUpdate = debounce((newMessages) => {
  setMessages(newMessages);
}, 100);
```

---

## 总结

这个JSON流渲染系统提供了：

1. **完整的实时通信架构**: 从CLI进程到Web UI的端到端解决方案
2. **灵活的数据处理**: 支持多种消息格式和内容类型
3. **优秀的用户体验**: 实时渲染、交互式JSON查看器、自动重连
4. **生产就绪**: 包含错误处理、性能优化、部署配置

您可以根据具体需求调整和扩展这个基础架构，添加更多功能如：
- 用户认证和权限管理
- 消息持久化存储
- 多语言支持
- 主题定制
- 插件系统

这个实现提供了坚实的基础，可以满足大多数实时JSON流渲染的需求。