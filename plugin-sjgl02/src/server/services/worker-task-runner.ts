import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type Plugin from '../plugin';

const CANCEL_GRACE_MS = 30_000;

// 仿官方 plugin-async-task-manager 的 CommandTaskType：
// 以 WORKER_MODE='-' 瞬态模式 spawn 完整 NocoBase 子应用线程执行 sjgl02:run-task 命令，
// 任务在独立事件循环/DB 连接中运行，主进程不被 CPU 密集工作阻塞。
export class WorkerTaskRunner {
  constructor(private plugin: Plugin) {}

  async run(taskId: number, signal: AbortSignal): Promise<void> {
    const logger = this.plugin.app.logger;
    const isDev = (process.argv[1]?.endsWith('.ts') || process.argv[1].includes('tinypool')) ?? false;
    const appRoot = process.env.APP_PACKAGE_ROOT || 'packages/core/app';
    const workerPath = path.resolve(process.cwd(), appRoot, isDev ? 'src/index.ts' : 'lib/index.js');
    logger.info(`[sjgl02] 任务 #${taskId} 启动 worker 子进程执行（${isDev ? 'dev' : 'prod'} 模式）`);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (err?: Error | null) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      const worker = new Worker(workerPath, {
        execArgv: isDev ? ['--require', 'tsx/cjs'] : [],
        workerData: { argv: ['sjgl02:run-task', `--taskId=${taskId}`] },
        env: { ...process.env, WORKER_MODE: '-' },
      });

      const onAbort = () => {
        // 先 IPC 优雅取消（引擎回滚并标记 canceled），超时强杀兜底
        worker.postMessage({ type: 'cancel' });
        setTimeout(() => {
          worker.terminate();
        }, CANCEL_GRACE_MS).unref();
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });

      worker.on('message', (message) => {
        if (message?.type === 'failure') {
          settle(new Error(message.error || '任务执行失败'));
        }
      });
      worker.on('error', (error) => settle(error));
      worker.on('exit', (code) => {
        logger.info(`[sjgl02] 任务 #${taskId} worker 已退出，code=${code}`);
        if (code !== 0 && !signal.aborted) {
          settle(new Error(`任务执行进程异常退出（code ${code}）`));
        } else {
          settle();
        }
      });
      worker.on('messageerror', (error) => settle(error));
    });
  }
}
