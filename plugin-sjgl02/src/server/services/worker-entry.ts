import { workerData } from 'node:worker_threads';
import { Application, runPluginStaticImports } from '@nocobase/server';
import { parseDatabaseOptionsFromEnv } from '@nocobase/database';
import { TaskQueueService } from './task-queue';
import { ImportEngine, ImportTaskParams } from './import-engine';
import { ExportEngine, ExportTaskParams } from './export-engine';
import type PluginSjgl02Server from '../plugin';

// 独立 worker 入口：不经过 Gateway.run() 和命令系统，直接初始化 Application 并执行任务。
// 彻底绕过 loadCommands（避免其他插件 commands 文件导出异常导致 callback is not a function）。
// worker 线程由 WorkerTaskRunner spawn，workerData 传入 { taskId }。
// cancel 信号由 executeAsWorker 内部监听 parentPort 处理，此处不重复。
async function main() {
  const { taskId } = workerData as { taskId: number };

  await runPluginStaticImports();

  const app = new Application({
    database: await parseDatabaseOptionsFromEnv(),
    plugins: ['nocobase'],
  });

  await app.load();
  // @ts-ignore collections repository 的 load 为运行时挂载方法，类型定义缺失（同 core db-sync 做法）
  await app.db.getRepository('collections').load({});

  // 优先通过字符串名称查找插件实例（不依赖构造函数引用一致性）；
  // 若插件未被加载（addOrThrow 失败被静默吞掉等），fallback 手动创建 adapter 执行任务。
  const plugin = app.pm.get('@my-project/plugin-sjgl02') as PluginSjgl02Server | undefined;
  if (plugin?.taskQueue) {
    await plugin.taskQueue.executeAsWorker(taskId);
  } else {
    const adapter = { db: app.db, app } as unknown as PluginSjgl02Server;
    const taskQueue = new TaskQueueService(adapter);
    taskQueue.registerHandler('import', (ctx, params) =>
      new ImportEngine(adapter).run(ctx, params as unknown as ImportTaskParams),
    );
    taskQueue.registerHandler('export', (ctx, params) =>
      new ExportEngine(adapter).run(ctx, params as unknown as ExportTaskParams),
    );
    await taskQueue.executeAsWorker(taskId);
  }

  try {
    await app.stop({ logging: false });
  } catch {
    // ignore
  }
  process.exit(0);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[sjgl02] worker-entry 异常: ${message}`, error);
  process.exit(1);
});
