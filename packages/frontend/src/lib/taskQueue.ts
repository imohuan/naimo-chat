/**
 * 并发任务队列
 * 支持动态添加任务，并发执行，自动调度
 */

export interface QueueTask<T> {
  /** 任务唯一标识 */
  id: string | number;
  /** 任务执行函数 */
  executor: () => Promise<T>;
}

export interface QueueResult<T> {
  /** 任务标识 */
  id: string | number;
  /** 执行结果 */
  result?: T;
  /** 错误信息 */
  error?: Error;
  /** 是否成功 */
  success: boolean;
}

export interface TaskQueueOptions {
  /** 并发数量，默认 3 */
  concurrency?: number;
  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void;
  /** 单个任务完成回调 */
  onTaskComplete?: (result: QueueResult<any>) => void;
}

/**
 * 并发任务队列类
 * 支持动态添加任务，自动调度并发执行
 */
export class TaskQueue<T = any> {
  private tasks: QueueTask<T>[] = [];
  private results: QueueResult<T>[] = [];
  private running = 0;
  private completed = 0;
  private concurrency: number;
  private onProgress?: (completed: number, total: number) => void;
  private onTaskComplete?: (result: QueueResult<any>) => void;
  private resolveFinish?: () => void;
  private finishPromise?: Promise<void>;

  constructor(options: TaskQueueOptions = {}) {
    this.concurrency = options.concurrency ?? 3;
    this.onProgress = options.onProgress;
    this.onTaskComplete = options.onTaskComplete;
  }

  /**
   * 添加任务到队列
   * @param task 任务对象
   */
  addTask(task: QueueTask<T>): void {
    this.tasks.push(task);
    this.processQueue();
  }

  /**
   * 批量添加任务到队列
   * @param tasks 任务数组
   */
  addTasks(tasks: QueueTask<T>[]): void {
    this.tasks.push(...tasks);
    this.processQueue();
  }

  /**
   * 处理队列，执行任务
   */
  private processQueue(): void {
    // 如果已达到并发上限，或者没有待执行的任务，则返回
    while (this.running < this.concurrency && this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (!task) break;

      this.running++;
      this.executeTask(task);
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: QueueTask<T>): Promise<void> {
    try {
      const result = await task.executor();
      const queueResult: QueueResult<T> = {
        id: task.id,
        result,
        success: true,
      };
      this.results.push(queueResult);
      this.onTaskComplete?.(queueResult);
    } catch (error) {
      const queueResult: QueueResult<T> = {
        id: task.id,
        error: error instanceof Error ? error : new Error(String(error)),
        success: false,
      };
      this.results.push(queueResult);
      this.onTaskComplete?.(queueResult);
    } finally {
      this.running--;
      this.completed++;
      // 计算总数：已完成 + 运行中 + 等待中
      const total = this.completed + this.running + this.tasks.length;
      this.onProgress?.(this.completed, total);

      // 继续处理队列中的下一个任务
      this.processQueue();

      // 如果所有任务都已完成，解析完成 Promise
      if (this.running === 0 && this.tasks.length === 0 && this.resolveFinish) {
        this.resolveFinish();
        this.finishPromise = undefined;
        this.resolveFinish = undefined;
      }
    }
  }

  /**
   * 等待所有任务完成
   * @returns Promise<void>
   */
  async waitAll(): Promise<void> {
    // 如果没有待执行的任务且没有正在运行的任务，直接返回
    if (this.tasks.length === 0 && this.running === 0) {
      return;
    }

    // 如果已经有一个等待 Promise，返回它
    if (this.finishPromise) {
      return this.finishPromise;
    }

    // 创建新的完成 Promise
    this.finishPromise = new Promise<void>((resolve) => {
      this.resolveFinish = resolve;
    });

    return this.finishPromise;
  }

  /**
   * 获取所有结果
   * @returns QueueResult[]
   */
  getResults(): QueueResult<T>[] {
    return [...this.results];
  }

  /**
   * 获取指定任务的结果
   * @param id 任务 ID
   * @returns QueueResult | undefined
   */
  getResult(id: string | number): QueueResult<T> | undefined {
    return this.results.find((r) => r.id === id);
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      total: this.completed + this.tasks.length + this.running,
      completed: this.completed,
      running: this.running,
      pending: this.tasks.length,
    };
  }

  /**
   * 清空队列和结果
   */
  clear(): void {
    this.tasks = [];
    this.results = [];
    this.completed = 0;
    this.running = 0;
    this.finishPromise = undefined;
    this.resolveFinish = undefined;
  }
}

