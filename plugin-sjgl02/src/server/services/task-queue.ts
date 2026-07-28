import type Plugin from '../plugin';
import { WorkerTaskRunner } from './worker-task-runner';

export const TASK_CHANNEL = 'sjgl02:task';
// 行数达到该阈值的任务改由 worker 子进程执行（避免大任务阻塞主进程事件循环）
const WORKER_MIN_ROWS = 50_000;
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELED: 'canceled',
} as const;

export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export interface TaskHandlerContext {
  taskId: number;
  signal: AbortSignal;
  updateProgress: (current: number, total?: number) => Promise<void>;
  updateStats: (stats: { totalRows?: number; successRows?: number; errorRows?: number }) => Promise<void>;
  throwIfAborted: () => void;
}

export type TaskHandler = (ctx: TaskHandlerContext, params: Record<string, unknown>) => Promise<unknown>;

interface SubmitOptions {
  title?: string;
  collectionName?: string;
  collectionTitle?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  permissionConfigId?: number;
  permissionType?: string;
}

export class TaskQueueService {
  private handlers = new Map<string, TaskHandler>();
  private controllers = new Map<number, AbortController>();
  private processing = new Set<number>();

  constructor(private plugin: Plugin) {}

  private get repo() {
    return this.plugin.db.getRepository('sjgl02Tasks');
  }

  registerHandler(type: string, handler: TaskHandler) {
    this.handlers.set(type, handler);
  }

  subscribe() {
    this.plugin.app.eventQueue.subscribe(TASK_CHANNEL, {
      interval: 500,
      concurrency: 1,
      idle: () => this.processing.size === 0,
      process: async (message: { taskId: number }) => {
        await this.execute(Number(message.taskId));
      },
    });
  }

  async submit(type: string, params: Record<string, unknown>, userId: number, options: SubmitOptions = {}) {
    const task = await this.repo.create({
      values: {
        type,
        status: TASK_STATUS.PENDING,
        params,
        createdById: userId,
        ...options,
      },
      context: { state: { currentUser: { id: userId } } } as never,
    });
    await this.plugin.app.eventQueue.publish(TASK_CHANNEL, { taskId: task.get('id') });
    return task;
  }

  async cancel(taskId: number) {
    const task = await this.repo.findOne({ filter: { id: taskId } });
    if (!task) {
      throw new Error(`任务 #${taskId} 不存在`);
    }
    const status = task.get('status') as TaskStatusValue;
    if (status === TASK_STATUS.PENDING) {
      await this.repo.update({
        filter: { id: taskId },
        values: { status: TASK_STATUS.CANCELED, doneAt: new Date(), message: '排队中被取消' },
      });
      return;
    }
    if (status === TASK_STATUS.RUNNING) {
      this.controllers.get(taskId)?.abort();
      return;
    }
    throw new Error(`任务 #${taskId} 当前状态（${status}）不允许取消`);
  }

  async execute(taskId: number, options: { externalSignal?: AbortSignal } = {}) {
    const task = await this.repo.findOne({ filter: { id: taskId } });
    if (!task) {
      return;
    }
    // worker 子进程路径（externalSignal 存在）：主进程已将状态改为 RUNNING，跳过 PENDING 检查
    if (!options.externalSignal && task.get('status') !== TASK_STATUS.PENDING) {
      return;
    }

    // worker 路径：大任务交给子进程执行（进度/终态由子进程直写任务表）
    if (!options.externalSignal && this.shouldRunInWorker(task)) {
      await this.executeViaWorker(taskId, task);
      return;
    }

    const controller = new AbortController();
    if (options.externalSignal) {
      if (options.externalSignal.aborted) controller.abort();
      else options.externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    this.controllers.set(taskId, controller);
    this.processing.add(taskId);
    const startedAt = new Date();
    await this.repo.update({ filter: { id: taskId }, values: { status: TASK_STATUS.RUNNING, startedAt } });

    let lastProgressWrite = 0;
    const ctx: TaskHandlerContext = {
      taskId,
      signal: controller.signal,
      updateProgress: async (current, total) => {
        const now = Date.now();
        if (now - lastProgressWrite < 500 && current < (total ?? Number.MAX_SAFE_INTEGER)) {
          return;
        }
        lastProgressWrite = now;
        const values: Record<string, number> = { progressCurrent: current };
        if (total !== undefined) {
          values.progressTotal = total;
        }
        await this.repo.update({ filter: { id: taskId }, values });
      },
      updateStats: async (stats) => {
        await this.repo.update({ filter: { id: taskId }, values: stats });
      },
      throwIfAborted: () => {
        if (controller.signal.aborted) {
          throw new Error('__aborted__');
        }
      },
    };

    const doneAt = () => new Date();
    const duration = () => Math.round((Date.now() - startedAt.getTime()) / 1000);
    try {
      const type = task.get('type') as string;
      const handler = this.handlers.get(type);
      if (!handler) {
        throw new Error(`未注册的任务类型: ${type}`);
      }
      const result = await handler(ctx, (task.get('params') as Record<string, unknown>) || {});
      await this.repo.update({
        filter: { id: taskId },
        values: { status: TASK_STATUS.SUCCEEDED, result: result ?? null, doneAt: doneAt(), duration: duration() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (controller.signal.aborted || message === '__aborted__') {
        await this.repo.update({
          filter: { id: taskId },
          values: {
            status: TASK_STATUS.CANCELED,
            doneAt: doneAt(),
            duration: duration(),
            message: '任务已取消，严格模式下已写入数据全部回滚',
          },
        });
      } else {
        this.plugin.app.logger.error(`[sjgl02] 任务 #${taskId} 执行失败: ${message}`, error);
        const details = (error as { details?: Record<string, unknown> }).details;
        await this.repo.update({
          filter: { id: taskId },
          values: {
            status: TASK_STATUS.FAILED,
            doneAt: doneAt(),
            duration: duration(),
            message,
            ...(details ? { result: details } : {}),
          },
        });
      }
    } finally {
      this.controllers.delete(taskId);
      this.processing.delete(taskId);
    }
  }

  private shouldRunInWorker(task: { get: (key: string) => unknown }): boolean {
    const type = task.get('type') as string;
    if (type !== 'import' && type !== 'export') return false;
    const params = (task.get('params') || {}) as Record<string, unknown>;
    if (typeof params.plannedRows === 'number') return params.plannedRows >= WORKER_MIN_ROWS;
    if (type === 'export' && params.allTables) return true;
    return false;
  }

  private async executeViaWorker(taskId: number, task: { get: (key: string) => unknown }) {
    const controller = new AbortController();
    this.controllers.set(taskId, controller);
    this.processing.add(taskId);
    const startedAt = new Date();
    // 在启动 worker 前将任务标记为 RUNNING，与 execute() 进程内路径保持一致。
    // 这样 worker 启动失败时 ensureNotRunning 的 filter 能正确匹配，
    // 避免任务永远卡在 PENDING（"排队中"）。
    await this.repo.update({ filter: { id: taskId }, values: { status: TASK_STATUS.RUNNING, startedAt } });
    try {
      await new WorkerTaskRunner(this.plugin).run(taskId, controller.signal);
      // worker 正常退出：终态已由子进程写库；仍 running 属异常，兜底标记失败
      await this.ensureNotRunning(taskId, startedAt, controller.signal.aborted ? null : '执行进程已退出但未写入终态');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (controller.signal.aborted) {
        // 优雅取消已由子进程回滚并标记 canceled；强杀场景由这里兜底（事务随连接断开自动回滚）
        await this.repo.update({
          filter: { id: taskId, status: [TASK_STATUS.RUNNING, TASK_STATUS.PENDING] },
          values: {
            status: TASK_STATUS.CANCELED,
            doneAt: new Date(),
            message: '任务已取消，严格模式下已写入数据全部回滚',
          },
        });
      } else {
        this.plugin.app.logger.error(`[sjgl02] 任务 #${taskId} worker 执行失败: ${message}`, error);
        await this.ensureNotRunning(taskId, startedAt, message);
      }
    } finally {
      this.controllers.delete(taskId);
      this.processing.delete(taskId);
    }
  }

  private async ensureNotRunning(taskId: number, startedAt: Date, message: string | null) {
    // filter 兼容 RUNNING 和 PENDING：executeViaWorker 已在启动前标记 RUNNING，
    // 但极端情况下（如状态写入竞态）仍可能为 PENDING，双保险确保任何中间状态都能被清理。
    if (!message) {
      await this.repo.update({
        filter: { id: taskId, status: [TASK_STATUS.RUNNING, TASK_STATUS.PENDING] },
        values: {
          status: TASK_STATUS.CANCELED,
          doneAt: new Date(),
          message: '任务已取消，严格模式下已写入数据全部回滚',
        },
      });
      return;
    }
    await this.repo.update({
      filter: { id: taskId, status: [TASK_STATUS.RUNNING, TASK_STATUS.PENDING] },
      values: {
        status: TASK_STATUS.FAILED,
        doneAt: new Date(),
        duration: Math.round((Date.now() - startedAt.getTime()) / 1000),
        message,
      },
    });
  }

  // worker 子进程入口：sjgl02:run-task 命令调用，复用进程内执行逻辑并接入父进程取消信号
  async executeAsWorker(taskId: number) {
    const { parentPort } = await import('node:worker_threads');
    const abort = new AbortController();
    parentPort?.on('message', (m) => {
      if (m && (m as { type?: string }).type === 'cancel') abort.abort();
    });
    await this.execute(taskId, { externalSignal: abort.signal });
  }

  async recoverStaleTasks() {
    const repo = this.repo;
    const stale = await repo.find({ filter: { status: ['pending', 'running'] } });
    for (const task of stale) {
      await repo.update({
        filter: { id: task.get('id') },
        values: { status: TASK_STATUS.FAILED, doneAt: new Date(), message: '服务重启中断' },
      });
    }
    if (stale.length) {
      this.plugin.app.logger.info(`[sjgl02] 启动恢复：${stale.length} 个残留任务已标记为失败（服务重启中断）`);
    }
  }
}
