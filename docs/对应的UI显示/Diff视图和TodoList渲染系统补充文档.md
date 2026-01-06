# Diff视图和TodoList渲染系统 - 补充文档

## 概述

本文档补充了JSON流渲染系统中两个重要的 specialized 渲染组件：
1. **Diff视图渲染器** - 用于显示文件编辑前后的差异
2. **TodoList渲染器** - 用于显示任务列表和进度跟踪

---

## 1. Diff视图渲染系统

### 1.1 核心DiffViewer组件

```typescript
// DiffViewer.tsx
import React, { useState } from 'react';
import { Maximize2, Minimize2, Plus, Minus } from 'lucide-react';
import { detectLanguageFromPath } from '../utils/language-detection';

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  language?: string;
  filePath?: string;
  showLineNumbers?: boolean;
  maxLines?: number;
}

export function DiffViewer({
  oldValue,
  newValue,
  language = 'text',
  filePath,
  showLineNumbers = true,
  maxLines = 8
}: DiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 计算行数和统计
  const oldLines = oldValue.split('\n');
  const newLines = newValue.split('\n');
  const totalLines = Math.max(oldLines.length, newLines.length);
  const shouldShowExpandButton = totalLines > maxLines;

  // 计算差异统计
  const diffStats = calculateDiffStats(oldLines, newLines);

  // 截断显示内容
  const displayLines = isExpanded || !shouldShowExpandButton
    ? Math.max(oldLines.length, newLines.length)
    : maxLines;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {filePath ? `File: ${filePath}` : 'Content Diff'}
          </span>
          {language !== 'text' && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {language}
            </span>
          )}
        </div>

        {/* 差异统计 */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <Plus size={14} />
            {diffStats.additions}
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <Minus size={14} />
            {diffStats.deletions}
          </span>
        </div>
      </div>

      {/* 展开按钮 */}
      {shouldShowExpandButton && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute top-2 right-2 h-6 w-6 p-0 text-gray-500 hover:text-gray-700 z-10 bg-white rounded border shadow-sm"
          aria-label={isExpanded ? "Show fewer lines" : "Show all lines"}
        >
          {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      )}

      {/* Diff内容 */}
      <div className="font-mono text-xs leading-relaxed overflow-x-auto">
        {renderDiffContent(oldLines, newLines, displayLines, showLineNumbers)}
      </div>

      {/* 折叠提示 */}
      {!isExpanded && shouldShowExpandButton && (
        <div className="text-center py-2 bg-gray-50 text-xs text-gray-600 border-t border-gray-200">
          ... +{totalLines - maxLines} more lines
        </div>
      )}
    </div>
  );
}

function calculateDiffStats(oldLines: string[], newLines: string[]) {
  const additions = newLines.filter(line =>
    !oldLines.includes(line)
  ).length;

  const deletions = oldLines.filter(line =>
    !newLines.includes(line)
  ).length;

  return { additions, deletions };
}

function renderDiffContent(
  oldLines: string[],
  newLines: string[],
  maxLines: number,
  showLineNumbers: boolean
) {
  const lines = [];
  const totalLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < Math.min(totalLines, maxLines); i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine === newLine && oldLine) {
      // 未更改的行
      lines.push(
        <div key={i} className="flex hover:bg-gray-50">
          {showLineNumbers && (
            <span className="w-12 text-right text-gray-500 mr-4 select-none px-2">
              {i + 1}
            </span>
          )}
          <span className="flex-1 text-gray-800 whitespace-pre">
            {oldLine}
          </span>
        </div>
      );
    } else {
      // 有差异的行
      if (oldLine) {
        lines.push(
          <div key={`${i}-old`} className="flex bg-red-50 hover:bg-red-100">
            {showLineNumbers && (
              <span className="w-12 text-right text-red-600 mr-4 select-none px-2 font-medium">
                -{i + 1}
              </span>
            )}
            <span className="flex-1 text-red-800 whitespace-pre">
              {oldLine}
            </span>
          </div>
        );
      }
      if (newLine) {
        lines.push(
          <div key={`${i}-new`} className="flex bg-green-50 hover:bg-green-100">
            {showLineNumbers && (
              <span className="w-12 text-right text-green-600 mr-4 select-none px-2 font-medium">
                +{i + 1}
              </span>
            )}
            <span className="flex-1 text-green-800 whitespace-pre">
              {newLine}
            </span>
          </div>
        );
      }
    }
  }

  return lines;
}
```

### 1.2 高级Diff渲染器（带语法高亮）

```typescript
// AdvancedDiffViewer.tsx
import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import Prism from 'prismjs';
import { detectLanguageFromPath } from '../utils/language-detection';

// 导入所需的语言支持
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';

interface AdvancedDiffViewerProps {
  oldValue: string;
  newValue: string;
  language?: string;
  filePath?: string;
  theme?: 'light' | 'dark';
}

export function AdvancedDiffViewer({
  oldValue,
  newValue,
  language = 'javascript',
  filePath,
  theme = 'light'
}: AdvancedDiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDark = theme === 'dark';

  // 渲染带语法高亮的内容
  const renderHighlightedContent = (source: string, lang: string) => {
    if (!source.trim()) return <span>{source}</span>;

    try {
      const grammar = Prism.languages[lang] || Prism.languages.text;
      const highlighted = Prism.highlight(source, grammar, lang);

      return (
        <span
          dangerouslySetInnerHTML={{ __html: highlighted }}
          style={{ display: 'inline' }}
        />
      );
    } catch (error) {
      return <span>{source}</span>;
    }
  };

  // 计算diff块
  const diffBlocks = calculateDiffBlocks(oldValue, newValue);

  return (
    <div className={`border rounded-xl overflow-hidden ${
      isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'
    }`}>
      {/* 标题栏 */}
      <div className={`flex items-center justify-between px-4 py-2 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      } border-b`}>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {filePath || 'Diff View'}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
          }`}>
            {language}
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`h-6 w-6 p-0 rounded border ${
            isDark
              ? 'text-gray-400 hover:text-gray-200 border-gray-600 hover:bg-gray-700'
              : 'text-gray-500 hover:text-gray-700 border-gray-300 hover:bg-gray-100'
          }`}
        >
          {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Diff内容 */}
      <div className={`font-mono text-xs leading-relaxed overflow-x-auto ${
        isDark ? 'text-gray-300' : ''
      }`}>
        {diffBlocks.slice(0, isExpanded ? diffBlocks.length : 3).map((block, index) => (
          <div key={index}>
            {block.type === 'context' && (
              <div className={`flex ${
                isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
              }`}>
                <span className={`w-12 text-right mr-4 select-none px-2 ${
                  isDark ? 'text-gray-600' : 'text-gray-500'
                }`}>
                  {block.lineNumber}
                </span>
                <span className="flex-1 whitespace-pre">
                  {renderHighlightedContent(block.content, language)}
                </span>
              </div>
            )}

            {block.type === 'removed' && (
              <div className={`flex ${
                isDark ? 'bg-red-900/30' : 'bg-red-50'
              }`}>
                <span className="w-12 text-right text-red-500 mr-4 select-none px-2 font-medium">
                  -{block.lineNumber}
                </span>
                <span className="flex-1 text-red-700 whitespace-pre">
                  {renderHighlightedContent(block.content, language)}
                </span>
              </div>
            )}

            {block.type === 'added' && (
              <div className={`flex ${
                isDark ? 'bg-green-900/30' : 'bg-green-50'
              }`}>
                <span className="w-12 text-right text-green-500 mr-4 select-none px-2 font-medium">
                  +{block.lineNumber}
                </span>
                <span className="flex-1 text-green-700 whitespace-pre">
                  {renderHighlightedContent(block.content, language)}
                </span>
              </div>
            )}
          </div>
        ))}

        {!isExpanded && diffBlocks.length > 3 && (
          <div className={`text-center py-2 text-xs ${
            isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-50 text-gray-600'
          } border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            ... +{diffBlocks.length - 3} more changes
          </div>
        )}
      </div>
    </div>
  );
}

interface DiffBlock {
  type: 'context' | 'added' | 'removed';
  content: string;
  lineNumber: number;
}

function calculateDiffBlocks(oldValue: string, newValue: string): DiffBlock[] {
  const oldLines = oldValue.split('\n');
  const newLines = newValue.split('\n');
  const blocks: DiffBlock[] = [];

  // 简化的diff算法 - 实际项目中可以使用更复杂的算法
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine && oldLine) {
      blocks.push({
        type: 'context',
        content: oldLine,
        lineNumber: i + 1
      });
    } else {
      if (oldLine) {
        blocks.push({
          type: 'removed',
          content: oldLine,
          lineNumber: i + 1
        });
      }
      if (newLine) {
        blocks.push({
          type: 'added',
          content: newLine,
          lineNumber: i + 1
        });
      }
    }
  }

  return blocks;
}
```

### 1.3 Edit工具集成

```typescript
// EditTool.tsx
import React from 'react';
import { detectLanguageFromPath } from '../../utils/language-detection';
import { DiffViewer } from './DiffViewer';
import { AdvancedDiffViewer } from './AdvancedDiffViewer';

interface EditToolProps {
  input: any;
  result: string;
  isMultiEdit?: boolean;
  workingDirectory?: string;
  useAdvancedDiff?: boolean;
}

export function EditTool({
  input,
  result,
  isMultiEdit = false,
  workingDirectory,
  useAdvancedDiff = false
}: EditToolProps) {
  const filePath = input?.file_path || '';
  const language = detectLanguageFromPath(filePath);
  const DiffComponent = useAdvancedDiff ? AdvancedDiffViewer : DiffViewer;

  // MultiEdit处理
  if (isMultiEdit && input.edits && Array.isArray(input.edits)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            Multiple Edits ({input.edits.length} changes)
          </h4>
          <span className="text-xs text-gray-500">
            File: {formatFilePath(filePath, workingDirectory)}
          </span>
        </div>

        {input.edits.map((edit: any, index: number) => (
          <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-600">
                Edit {index + 1}/{input.edits.length}
              </span>
              {edit.start_line && edit.end_line && (
                <span className="text-xs text-gray-500 ml-2">
                  Lines {edit.start_line}-{edit.end_line}
                </span>
              )}
            </div>

            <DiffComponent
              oldValue={edit.old_string || ''}
              newValue={edit.new_string || ''}
              language={language}
              filePath={filePath}
            />
          </div>
        ))}
      </div>
    );
  }

  // 单个Edit处理
  if (input.old_string !== undefined && input.new_string !== undefined) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>File:</span>
          <code className="px-2 py-1 bg-gray-100 rounded text-xs">
            {formatFilePath(filePath, workingDirectory)}
          </code>
          {input.start_line && input.end_line && (
            <span className="text-xs">
              (Lines {input.start_line}-{input.end_line})
            </span>
          )}
        </div>

        <DiffComponent
          oldValue={input.old_string}
          newValue={input.new_string}
          language={language}
          filePath={filePath}
        />
      </div>
    );
  }

  // 结果回退显示
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="text-sm text-green-800">
        ✓ Edit completed successfully
      </div>
      {result && (
        <div className="mt-2 text-xs text-green-600">
          {result}
        </div>
      )}
    </div>
  );
}

function formatFilePath(path: string, workingDirectory?: string): string {
  if (!path) return 'Unknown file';

  if (workingDirectory && path.startsWith(workingDirectory)) {
    const relative = path.slice(workingDirectory.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }

  return path;
}
```

---

## 2. TodoList渲染系统

### 2.1 核心TodoTool组件

```typescript
// TodoTool.tsx
import React, { useState } from 'react';
import {
  Circle, Clock, CheckCircle, Plus,
  Edit2, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface TodoToolProps {
  input: any;
  result: string;
  isWrite: boolean;
  editable?: boolean;
  onTodoUpdate?: (todos: TodoItem[]) => void;
}

export function TodoTool({
  input,
  result,
  isWrite,
  editable = false,
  onTodoUpdate
}: TodoToolProps) {
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    if (isWrite && input.todos && Array.isArray(input.todos)) {
      return input.todos;
    } else if (!isWrite && result) {
      return parseTodos(result);
    }
    return [];
  });

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'status' | 'priority' | 'created'>('status');
  const [isExpanded, setIsExpanded] = useState(true);

  // 过滤和排序todos
  const filteredTodos = todos
    .filter(todo => filterStatus === 'all' || todo.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'status':
          return getStatusOrder(a.status) - getStatusOrder(b.status);
        case 'priority':
          return getPriorityOrder(b.priority) - getPriorityOrder(a.priority);
        case 'created':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

  // 统计信息
  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status === 'pending').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length,
  };

  const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  const handleStatusChange = (todoId: string, newStatus: TodoItem['status']) => {
    const updatedTodos = todos.map(todo =>
      todo.id === todoId
        ? { ...todo, status: newStatus, updatedAt: new Date().toISOString() }
        : todo
    );
    setTodos(updatedTodos);
    onTodoUpdate?.(updatedTodos);
  };

  const handleDeleteTodo = (todoId: string) => {
    const updatedTodos = todos.filter(todo => todo.id !== todoId);
    setTodos(updatedTodos);
    onTodoUpdate?.(updatedTodos);
  };

  if (todos.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <Circle size={24} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">No todos found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 标题和统计 */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">
            Task List ({stats.total} items)
          </h4>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* 统计概览 */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Pending', count: stats.pending, icon: Circle, color: 'text-gray-500' },
            { label: 'In Progress', count: stats.inProgress, icon: Clock, color: 'text-blue-500' },
            { label: 'Completed', count: stats.completed, icon: CheckCircle, color: 'text-green-500' },
            { label: 'Progress', count: `${Math.round(completionRate)}%`, icon: Circle, color: 'text-purple-500' }
          ].map(({ label, count, icon: Icon, color }) => (
            <div key={label} className="text-center">
              <Icon size={16} className={`mx-auto mb-1 ${color}`} />
              <div className="text-xs text-gray-600">{label}</div>
              <div className="text-sm font-medium text-gray-900">{count}</div>
            </div>
          ))}
        </div>

        {/* 进度条 */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {isExpanded && (
        <>
          {/* 过滤和排序控制 */}
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs px-2 py-1 border border-gray-300 rounded"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs px-2 py-1 border border-gray-300 rounded"
              >
                <option value="status">Sort by Status</option>
                <option value="priority">Sort by Priority</option>
                <option value="created">Sort by Created</option>
              </select>
            </div>
          </div>

          {/* Todo列表 */}
          <div className="max-h-96 overflow-y-auto">
            {filteredTodos.map((todo) => (
              <TodoItemComponent
                key={todo.id}
                todo={todo}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTodo}
                editable={editable}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TodoItemComponent({
  todo,
  onStatusChange,
  onDelete,
  editable
}: {
  todo: TodoItem;
  onStatusChange: (id: string, status: TodoItem['status']) => void;
  onDelete: (id: string) => void;
  editable: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(todo.content);

  const handleSave = () => {
    // 这里应该调用更新函数
    setIsEditing(false);
  };

  return (
    <div className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
      todo.status === 'completed' ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start gap-3">
        {/* 状态图标 */}
        <button
          onClick={() => onStatusChange(todo.id, getNextStatus(todo.status))}
          className="mt-1 flex-shrink-0 transition-colors"
        >
          {getStatusIcon(todo.status)}
        </button>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={handleSave}
              onKeyPress={(e) => e.key === 'Enter' && handleSave()}
              className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className={`text-sm leading-6 ${
                todo.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
              }`}>
                {todo.content}
              </span>

              {/* 优先级标签 */}
              {todo.priority && (
                <span className={`text-xs px-2 py-1 rounded ${getPriorityClass(todo.priority)}`}>
                  {todo.priority}
                </span>
              )}

              {/* 截止日期 */}
              {todo.dueDate && (
                <span className="text-xs text-gray-500">
                  Due: {new Date(todo.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {/* 标签 */}
          {todo.tags && todo.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {todo.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {editable && (
          <div className="flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-blue-600"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDelete(todo.id)}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 辅助函数
function getStatusIcon(status: TodoItem['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle size={16} className="text-green-500" />;
    case 'in_progress':
      return <Clock size={16} className="text-blue-500" />;
    case 'pending':
    default:
      return <Circle size={16} className="text-gray-400" />;
  }
}

function getNextStatus(currentStatus: TodoItem['status']): TodoItem['status'] {
  const statusFlow: TodoItem['status'][] = ['pending', 'in_progress', 'completed'];
  const currentIndex = statusFlow.indexOf(currentStatus);
  return statusFlow[(currentIndex + 1) % statusFlow.length];
}

function getStatusOrder(status: TodoItem['status']): number {
  const order = { pending: 0, in_progress: 1, completed: 2 };
  return order[status];
}

function getPriorityOrder(priority?: TodoItem['priority']): number {
  const order = { high: 3, medium: 2, low: 1 };
  return order[priority || 'medium'];
}

function getPriorityClass(priority?: TodoItem['priority']): string {
  const classes = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700'
  };
  return classes[priority || 'medium'];
}

function parseTodos(content: string): TodoItem[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.filter(item =>
        item &&
        typeof item === 'object' &&
        typeof item.content === 'string' &&
        typeof item.status === 'string' &&
        ['pending', 'in_progress', 'completed'].includes(item.status)
      );
    }
  } catch (e) {
    console.warn('Failed to parse todos:', e);
  }
  return [];
}
```

### 2.2 Todo可视化组件

```typescript
// TodoVisualization.tsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface TodoVisualizationProps {
  todos: TodoItem[];
  type?: 'pie' | 'bar' | 'timeline';
}

export function TodoVisualization({ todos, type = 'pie' }: TodoVisualizationProps) {
  const stats = {
    pending: todos.filter(t => t.status === 'pending').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length,
  };

  const pieData = [
    { name: 'Pending', value: stats.pending, color: '#6B7280' },
    { name: 'In Progress', value: stats.inProgress, color: '#3B82F6' },
    { name: 'Completed', value: stats.completed, color: '#10B981' },
  ];

  const barData = [
    { status: 'Pending', count: stats.pending },
    { status: 'In Progress', count: stats.inProgress },
    { status: 'Completed', count: stats.completed },
  ];

  if (type === 'pie') {
    return (
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'bar') {
    return (
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData}>
            <XAxis dataKey="status" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
```

### 2.3 任务管理器集成

```typescript
// TaskManager.tsx
import React, { useState } from 'react';
import { TodoTool } from './TodoTool';
import { TodoVisualization } from './TodoVisualization';

interface TaskManagerProps {
  todos: TodoItem[];
  onTodosChange: (todos: TodoItem[]) => void;
}

export function TaskManager({ todos, onTodosChange }: TaskManagerProps) {
  const [view, setView] = useState<'list' | 'visualization'>('list');
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  return (
    <div className="space-y-4">
      {/* 视图切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('list')}
          className={`px-3 py-1 text-sm rounded ${
            view === 'list'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          List View
        </button>
        <button
          onClick={() => setView('visualization')}
          className={`px-3 py-1 text-sm rounded ${
            view === 'visualization'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Visualization
        </button>
      </div>

      {/* 内容渲染 */}
      {view === 'list' ? (
        <TodoTool
          input={{ todos }}
          result={JSON.stringify(todos)}
          isWrite={true}
          editable={true}
          onTodoUpdate={onTodosChange}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setChartType('pie')}
              className={`px-2 py-1 text-xs rounded ${
                chartType === 'pie'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Pie Chart
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2 py-1 text-xs rounded ${
                chartType === 'bar'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Bar Chart
            </button>
          </div>

          <TodoVisualization todos={todos} type={chartType} />
        </div>
      )}
    </div>
  );
}
```

---

## 3. 工具渲染系统集成

### 3.1 更新的ToolContent路由器

```typescript
// ToolContent.tsx (更新版本)
import React, { useState } from 'react';
import { ReadTool } from './tools/ReadTool';
import { EditTool } from './tools/EditTool';
import { WriteTool } from './tools/WriteTool';
import { BashTool } from './tools/BashTool';
import { TodoTool } from './tools/TodoTool';
import { TaskTool } from './tools/TaskTool';
import { SearchTool } from './tools/SearchTool';
import { WebTool } from './tools/WebTool';

export function ToolContent({
  toolName,
  toolInput,
  toolResult,
  workingDirectory,
  toolUseId,
  childrenMessages,
  toolResults
}: ToolContentProps) {
  const [advancedMode, setAdvancedMode] = useState(false);

  // ... 之前的代码

  // 路由到相应的工具组件（支持高级模式）
  switch (toolName) {
    case 'Read':
      return (
        <ReadTool
          input={toolInput}
          result={resultContent}
          workingDirectory={workingDirectory}
          advancedMode={advancedMode}
        />
      );

    case 'Edit':
    case 'MultiEdit':
      return (
        <EditTool
          input={toolInput}
          result={resultContent}
          isMultiEdit={toolName === 'MultiEdit'}
          workingDirectory={workingDirectory}
          useAdvancedDiff={advancedMode}
        />
      );

    case 'TodoRead':
    case 'TodoWrite':
      return (
        <TodoTool
          input={toolInput}
          result={resultContent}
          isWrite={toolName === 'TodoWrite'}
          editable={true}
        />
      );

    // ... 其他工具

    default:
      return <FallbackTool toolName={toolName} input={toolInput} result={resultContent} />;
  }
}
```

---

## 4. 使用示例

### 4.1 在MessageItem中使用

```typescript
// MessageItem.tsx (更新版本)
import { ToolUseRenderer } from '../ToolRendering/ToolUseRenderer';

// 在tool_use块的渲染中
if (block.type === 'tool_use') {
  const toolResult = toolResults[block.id];

  return (
    <div key={blockId} className="flex gap-2 items-start">
      <div className="w-4 h-5 flex items-center justify-center">
        {getToolIcon(block.name)}
      </div>
      <div className="flex-1">
        <ToolUseRenderer
          toolUse={block}
          toolResult={toolResult}
          toolResults={toolResults}
          workingDirectory={message.workingDirectory}
          childrenMessages={childrenMessages}
          expandedTasks={expandedTasks}
          onToggleTaskExpanded={onToggleTaskExpanded}
        />
      </div>
    </div>
  );
}
```

### 4.2 独立使用组件

```typescript
// 单独使用DiffViewer
<DiffViewer
  oldValue={oldCode}
  newValue={newCode}
  language="typescript"
  filePath="src/components/Button.tsx"
/>

// 单独使用TodoTool
<TodoTool
  input={{
    todos: [
      { id: '1', content: '实现用户认证', status: 'completed' },
      { id: '2', content: '添加权限管理', status: 'in_progress' },
      { id: '3', content: '编写测试用例', status: 'pending' }
    ]
  }}
  result=""
  isWrite={true}
  editable={true}
/>
```

---

## 5. 样式和主题

### 5.1 Tailwind CSS配置

```css
/* tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        diff: {
          added: '#dcfce7',
          addedBorder: '#86efac',
          addedText: '#166534',
          removed: '#fef2f2',
          removedBorder: '#fca5a5',
          removedText: '#991b1b',
        }
      }
    }
  }
}
```

### 5.2 自定义样式

```css
/* styles/diff.css */
.diff-line-added {
  background-color: var(--color-diff-added);
  border-left: 3px solid var(--color-diff-addedBorder);
}

.diff-line-removed {
  background-color: var(--color-diff-removed);
  border-left: 3px solid var(--color-diff-removedBorder);
}

.diff-line-context {
  transition: background-color 0.2s ease;
}

.diff-line-context:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

/* styles/todo.css */
.todo-item {
  transition: all 0.2s ease;
}

.todo-item:hover {
  transform: translateX(4px);
}

.todo-completed {
  opacity: 0.7;
}

.todo-pending {
  border-left: 3px solid #6b7280;
}

.todo-in-progress {
  border-left: 3px solid #3b82f6;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%);
}

.todo-completed {
  border-left: 3px solid #10b981;
}
```

---

## 6. 性能优化

### 6.1 Diff优化

```typescript
// 使用虚拟化处理大型diff
import { FixedSizeList as List } from 'react-window';

const VirtualizedDiffViewer = ({ lines }: { lines: DiffLine[] }) => {
  const Row = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>
      {/* 渲染单行diff */}
    </div>
  );

  return (
    <List
      height={400}
      itemCount={lines.length}
      itemSize={24}
      itemData={lines}
    >
      {Row}
    </List>
  );
};
```

### 6.2 Todo优化

```typescript
// 使用React.memo优化Todo项目
const TodoItemComponent = React.memo(({ todo, ...props }) => {
  // 组件实现
}, (prevProps, nextProps) => {
  return prevProps.todo.id === nextProps.todo.id &&
         prevProps.todo.status === nextProps.todo.status &&
         prevProps.todo.content === nextProps.todo.content;
});
```

---

## 7. 测试

### 7.1 Diff组件测试

```typescript
// DiffViewer.test.tsx
import { render, screen } from '@testing-library/react';
import { DiffViewer } from './DiffViewer';

describe('DiffViewer', () => {
  it('renders diff correctly', () => {
    render(
      <DiffViewer
        oldValue="old line"
        newValue="new line"
        language="javascript"
      />
    );

    expect(screen.getByText('old line')).toBeInTheDocument();
    expect(screen.getByText('new line')).toBeInTheDocument();
  });

  it('shows expand button when content is long', () => {
    const longContent = 'line\n'.repeat(10);
    render(
      <DiffViewer
        oldValue={longContent}
        newValue={longContent}
      />
    );

    expect(screen.getByRole('button', { name: /show all lines/i })).toBeInTheDocument();
  });
});
```

### 7.2 Todo组件测试

```typescript
// TodoTool.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TodoTool } from './TodoTool';

describe('TodoTool', () => {
  it('renders todo list', () => {
    const todos = [
      { id: '1', content: 'Test todo', status: 'pending' }
    ];

    render(
      <TodoTool
        input={{ todos }}
        result=""
        isWrite={true}
      />
    );

    expect(screen.getByText('Test todo')).toBeInTheDocument();
  });

  it('handles status changes', () => {
    const onTodoUpdate = jest.fn();
    const todos = [
      { id: '1', content: 'Test todo', status: 'pending' }
    ];

    render(
      <TodoTool
        input={{ todos }}
        result=""
        isWrite={true}
        onTodoUpdate={onTodoUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onTodoUpdate).toHaveBeenCalled();
  });
});
```

---

## 总结

这个补充文档详细说明了Diff视图和TodoList渲染系统的完整实现，包括：

1. **Diff渲染系统**
   - 基础和高级Diff视图
   - 语法高亮支持
   - 多Edit处理
   - 性能优化

2. **TodoList渲染系统**
   - 完整的任务管理功能
   - 可视化图表支持
   - 编辑和删除功能
   - 过滤和排序

3. **集成方案**
   - 与现有工具系统的无缝集成
   - 主题和样式定制
   - 测试策略

这些组件可以独立使用，也可以作为完整工具渲染系统的一部分，为用户提供丰富的交互体验。