import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type Plugin from '../plugin';

const CANCEL_GRACE_MS = 30_000;

// spawn 独立 worker 线程执行大任务，不经过 Gateway.run() 和命令系统，彻底绕过 loadCommands
// （避免其他插件 commands 文件导出异常导致 callback is not a function）。
// worker 入口为插件自己的 worker-entry.ts，直接初始化 Application 并执行任务。
export class WorkerTaskRunner {
  constructor(private plugin: Plugin) {}

  async run(taskId: number, signal: AbortSignal): Promise<void> {
    const logger = this.plugin.app.logger;
    const isDev = (process.argv[1]?.endsWith('.ts') || process.argv[1].includes('tinypool')) ?? false;
    const workerPath = isDev
      ? path.resolve(__dirname, 'worker-entry.ts')
      : path.resolve(__dirname, 'worker-entry.js');
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
        workerData: { taskId },
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
