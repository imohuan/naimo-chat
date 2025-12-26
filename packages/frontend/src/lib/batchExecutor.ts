/**
 * 批量并发执行工具
 * 支持自定义并发数量，批量执行异步任务
 */

export interface BatchTask<T> {
  /** 任务唯一标识 */
  id: string | number;
  /** 任务执行函数 */
  executor: () => Promise<T>;
}

export interface BatchResult<T> {
  /** 任务标识 */
  id: string | number;
  /** 执行结果 */
  result?: T;
  /** 错误信息 */
  error?: Error;
  /** 是否成功 */
  success: boolean;
}

export interface BatchExecutorOptions {
  /** 并发数量，默认 3 */
  concurrency?: number;
  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * 批量并发执行任务
 * @param tasks 任务数组
 * @param options 配置选项
 * @returns Promise<BatchResult[]>
 */
export async function batchExecute<T>(
  tasks: BatchTask<T>[],
  options: BatchExecutorOptions = {}
): Promise<BatchResult<T>[]> {
  const { concurrency = 3, onProgress } = options;
  const results: BatchResult<T>[] = [];
  let completed = 0;
  const total = tasks.length;

  // 如果没有任务，直接返回
  if (total === 0) {
    return results;
  }

  let currentIndex = 0;

  // 执行单个任务
  const executeTask = async (): Promise<void> => {
    while (currentIndex < total) {
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];

      // 安全检查
      if (!task) {
        continue;
      }

      try {
        const result = await task.executor();
        results.push({
          id: task.id,
          result,
          success: true,
        });
      } catch (error) {
        results.push({
          id: task.id,
          error: error instanceof Error ? error : new Error(String(error)),
          success: false,
        });
      }

      completed++;
      onProgress?.(completed, total);
    }
  };

  // 创建并发执行队列
  const promises = Array(Math.min(concurrency, total))
    .fill(null)
    .map(() => executeTask());

  await Promise.all(promises);

  // 按照原始顺序排序结果
  const taskIdToIndex = new Map(tasks.map((task, index) => [task.id, index]));
  results.sort((a, b) => {
    const indexA = taskIdToIndex.get(a.id) ?? 0;
    const indexB = taskIdToIndex.get(b.id) ?? 0;
    return indexA - indexB;
  });

  return results;
}

