import type { Application } from '@nocobase/server';
import { TaskQueueService } from '../services/task-queue';
import { ImportEngine, ImportTaskParams } from '../services/import-engine';
import { ExportEngine, ExportTaskParams } from '../services/export-engine';
import type PluginSjgl02Server from '../plugin';

// worker 子进程执行入口：WORKER_MODE='-' 瞬态模式下由 Gateway 经 runAsCLI 调用。
// 注意：runAsCLI 不执行插件 load()，这里在命令内自装配任务队列与引擎（引擎仅依赖 plugin.db）。
export default function runTaskCommand(app: Application) {
  app
    .command('sjgl02:run-task')
    .preload()
    .option('--taskId <taskId>')
    .action(async (options: { taskId: string }) => {
      const taskId = Number(options.taskId);
      let code = 0;
      try {
        // 瞬态应用不触发 beforeStart，DB 动态集合（collections 表记录）需手动加载，否则引擎找不到表
        // @ts-ignore collections repository 的 load 为运行时挂载方法，类型定义缺失（同 core db-sync 做法）
        await app.db.getRepository('collections').load({});
        const loaded = app.pm.get('@my-project/plugin-sjgl02') as PluginSjgl02Server;
        if (loaded?.taskQueue) {
          await loaded.taskQueue.executeAsWorker(taskId);
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
      } catch (error) {
        code = 1;
        app.logger.error(`[sjgl02] 任务 #${taskId} worker 命令执行异常`, error);
      } finally {
        // 终态已由 execute() 写库；子应用 stop 后线程仍可能因连接/定时器残留不退出，
        // 显式退出确保父进程收到 exit 事件、队列不被卡住
        try {
          await app.stop({ logging: false });
        } catch {
          // ignore
        }
        process.exit(code);
      }
    });
}
