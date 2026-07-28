import { currentUserId } from './actions/utils';
import { Plugin, isTransient } from '@nocobase/server';
import { TaskQueueService } from './services/task-queue';
import { registerImportActions } from './actions/import';
import { registerExportActions } from './actions/export';
import { registerTaskActions } from './actions/tasks';
import { registerMetaActions } from './actions/meta';
import { registerPermissionActions, registerPermissionLogHooks } from './actions/permissions';

export class PluginSjgl02Server extends Plugin {
  taskQueue: TaskQueueService;

  async beforeLoad() {
    registerPermissionLogHooks(this);
  }

  async load() {
    this.taskQueue = new TaskQueueService(this);
    this.registerDemoHandler();
    // worker 瞬态子应用（WORKER_MODE='-'）不订阅队列、不做残留任务恢复：
    // 订阅的 interval 定时器会阻止线程退出；recover 会误标主进程正在执行的任务
    if (!isTransient()) {
      this.taskQueue.subscribe();
      this.app.on('afterStart', async () => {
        try {
          await this.taskQueue.recoverStaleTasks();
        } catch (error) {
          this.app.logger.error('[sjgl02] 启动恢复失败', error);
        }
      });
    }

    this.registerAcl();
    this.registerActions();
    const taskActions = registerTaskActions(this);
    const sjgl02Actions = {
      ...registerImportActions(this),
      ...registerExportActions(this),
      ...registerMetaActions(this),
      ...registerPermissionActions(this),
    };
    this.app.resourcer.define({ name: 'sjgl02', actions: sjgl02Actions });
    this.app.resourceManager.registerActionHandlers(
      Object.fromEntries(Object.entries(taskActions).map(([k, v]) => [`sjgl02Tasks:${k}`, v])),
    );
  }

  async install() {}

  private registerAcl() {
    const snippets: Array<[string, string[]]> = [
      [
        'pm.sjgl02.import',
        [
          'sjgl02:importUpload',
          'sjgl02:previewExcel',
          'sjgl02:getImportPermissions',
          'sjgl02:import',
          'sjgl02:downloadTemplate',
        ],
      ],
      ['pm.sjgl02.export', ['sjgl02:getExportPermissions', 'sjgl02:export']],
      [
        'pm.sjgl02.tasks',
        [
          'sjgl02Tasks:list',
          'sjgl02Tasks:get',
          'sjgl02Tasks:cancel',
          'sjgl02Tasks:download',
          'sjgl02Tasks:exportErrorReport',
          'sjgl02Tasks:retry',
        ],
      ],
      ['pm.sjgl02.permission', ['sjgl02Permissions:*', 'sjgl02PermissionLogs:list', 'sjgl02:permListByCollection']],
    ];
    for (const [name, actions] of snippets) {
      this.app.acl.registerSnippet({ name, actions });
    }
    this.app.acl.allow(
      'sjgl02Tasks',
      [
        'list',
        'get',
        'cancel',
        'testSubmit',
        'stats',
        'download',
        'exportErrorReport',
        'retry',
        'getScope',
        'setScope',
      ],
      'loggedIn',
    );
    this.app.acl.allow('sjgl02Permissions', '*', 'loggedIn');
    this.app.acl.allow('sjgl02PermissionLogs', ['list', 'get'], 'loggedIn');
    this.app.acl.allow('sjgl02', '*', 'loggedIn');
  }

  private registerActions() {
    this.app.resourceManager.registerActionHandlers({
      'sjgl02Tasks:cancel': async (ctx, next) => {
        const taskId = Number(ctx.action.params.filterByTk ?? ctx.action.params.taskId);
        if (!taskId) {
          ctx.throw(400, '缺少 taskId');
        }
        await this.taskQueue.cancel(taskId);
        ctx.body = { ok: true };
        await next();
      },
      // M1 开发自验接口：提交一个 demo 任务（按秒推进进度，可取消）
      'sjgl02Tasks:testSubmit': async (ctx, next) => {
        const seconds = Math.min(Math.max(Number(ctx.action.params.values?.seconds ?? 10), 1), 300);
        const userId = currentUserId(ctx);
        const task = await this.taskQueue.submit('demo', { seconds }, userId, { title: `演示任务（${seconds}s）` });
        ctx.body = { taskId: task.get('id') };
        await next();
      },
    });
  }

  private registerDemoHandler() {
    this.taskQueue.registerHandler('demo', async (ctx, params) => {
      const seconds = Number(params.seconds ?? 10);
      await ctx.updateProgress(0, seconds);
      for (let i = 1; i <= seconds; i++) {
        ctx.throwIfAborted();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await ctx.updateProgress(i, seconds);
        await ctx.updateStats({ totalRows: seconds, successRows: i });
      }
      return { message: 'demo 任务完成', seconds };
    });
  }
}

export default PluginSjgl02Server;
