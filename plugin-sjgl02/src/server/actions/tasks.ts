import { Context, Next } from '@nocobase/actions';
import { quoteIdentifier } from './import-utils';
import { isAdminOrRoot } from './auth-utils';

export async function listTasks(ctx: Context, next: Next) {
  const { taskType, status, search } = ctx.action.params;
  const page = Math.max(1, parseInt(ctx.action.params.page || '1', 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(ctx.action.params.pageSize || '20', 10) || 20));
  const filter: any = {};
  if (taskType && taskType !== 'all') filter.taskType = taskType;
  if (status && status !== 'all') filter.status = status;

  if (search && String(search).trim()) {
    const kw = String(search).trim();
    const isNum = /^\d+$/.test(kw);
    const orConditions: any[] = [isNum ? { id: parseInt(kw, 10) } : null, { tableName: { $iLike: `%${kw}%` } }].filter(
      Boolean,
    );

    try {
      const userRepo = ctx.db.getRepository('users');
      const matchedUsers = await userRepo.find({
        filter: { nickname: { $iLike: `%${kw}%` } },
      });
      if (matchedUsers.length > 0) {
        orConditions.push({
          createdById: { $in: matchedUsers.map((u: any) => u.id) },
        });
      }
    } catch {
      /* 忽略 */
    }

    filter.$or = orConditions;
  }

  const taskViewScope = await getTaskViewScope(ctx);
  if (taskViewScope === 'own') {
    if (filter.$or) {
      const baseFilter = { createdById: ctx.state.currentUser?.id ?? -1 };
      filter.$and = [baseFilter, { $or: filter.$or }];
      delete filter.$or;
    } else {
      filter.createdById = ctx.state.currentUser?.id ?? -1;
    }
  }

  const repo = ctx.db.getRepository('sjgl02_tasks');
  const [rows, total] = await repo.findAndCount({
    filter,
    appends: ['createdBy'],
    page,
    pageSize,
    sort: ['-createdAt'],
  } as any);
  ctx.body = {
    items: rows,
    total,
    page,
    pageSize,
  };
  await next();
}

export async function getTaskDetail(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({
    filter: { id: taskId },
    appends: ['createdBy'],
  });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  const currentUserId = ctx.state.currentUser?.id;
  const isAdmin = (ctx.state.currentUser?.roles || []).some((r: any) => r.name === 'admin' || r.name === 'root');
  const taskViewScope = await getTaskViewScope(ctx);
  if (!isAdmin && taskViewScope === 'own' && task.createdById !== currentUserId) {
    ctx.throw(403, 'Access denied');
  }
  ctx.body = task;
  await next();
}

export async function cancelTask(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { taskId } = params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  const currentUserId = ctx.state.currentUser?.id;
  if (!isAdminOrRoot(ctx) && task.createdById !== currentUserId) {
    ctx.throw(403, '只能取消自己创建的任务');
  }
  if (['completed', 'failed', 'cancelled'].includes(task.status)) {
    ctx.throw(400, 'Cannot cancel a completed/failed/cancelled task');
  }

  // 先更新 DB 状态（子进程每页检查此字段）
  const taskIdNum = Number(taskId);

  // 如果是导入任务，清理影子表
  if (task.taskType === 'import') {
    try {
      const quotedShadow = quoteIdentifier('_sjgl02_import_' + taskIdNum);
      await ctx.db.sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow);
    } catch {
      /* 忽略 */
    }
  }

  await repo.update({
    filterByTk: task.id,
    values: { status: 'cancelled', progress: task.progress },
  });

  // DB 先标记为 cancelled，再杀子进程（避免 exit 事件竞态覆盖为 timeout）
  if (task.taskType === 'export') {
    try {
      const { activeWorkers } = await import('../workers/zombie-guard');
      const child = activeWorkers.get(taskIdNum);
      if (child && !child.killed) child.kill('SIGTERM');
    } catch {
      /* 忽略 */
    }
  }
  ctx.body = { success: true };
  await next();
}

export async function deleteTask(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { taskId } = params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  if (!isAdminOrRoot(ctx) && task.createdById !== ctx.state.currentUser?.id) {
    ctx.throw(403, '只能删除自己创建的任务');
  }
  await ctx.db.getRepository('sjgl02_task_logs').destroy({ filter: { taskId } });
  await repo.destroy({ filterByTk: task.id });
  ctx.body = { success: true };
  await next();
}

async function getTaskViewScope(ctx: Context): Promise<string> {
  try {
    const roleNames = (ctx.state.currentUser?.roles || []).map((r: any) => r.name);
    if (roleNames.length > 0) {
      const roleRepo = ctx.db.getRepository('roles');
      const userRoles = await roleRepo.find({ filter: { name: { $in: roleNames } } });
      if (userRoles.some((r: any) => r.name === 'admin' || r.name === 'root')) return 'all';
    }
    const settingRepo = ctx.db.getRepository('sjgl02_settings');
    const userId = ctx.state.currentUser?.id;
    const userSetting = await settingRepo.findOne({ filter: { userId } });
    if (userSetting) return userSetting.taskViewScope || 'own';
    const globalSetting = await settingRepo.findOne({ filter: { userId: { $is: null } } });
    return globalSetting?.taskViewScope || 'own';
  } catch {
    return 'own';
  }
}
