import { Context, Next } from '@nocobase/actions';

export async function listTasks(ctx: Context, next: Next) {
  const { page = 1, pageSize = 20, taskType, status } = ctx.action.params;
  const filter: any = {};
  if (taskType && taskType !== 'all') filter.taskType = taskType;
  if (status && status !== 'all') filter.status = status;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const [rows, total] = await repo.findAndCount({
    filter,
    page,
    pageSize,
    sort: ['-createdAt'],
    appends: ['createdBy'],
  });
  ctx.body = { data: rows, meta: { total, page, pageSize } };
  await next();
}

export async function getTaskDetail(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId }, appends: ['createdBy'] });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  ctx.body = { data: task };
  await next();
}

export async function getTaskLogs(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  ctx.body = {
    data: {
      errorLogs: task.errorLogs || [],
      fieldMapping: task.fieldMapping || null,
      selectedFields: task.selectedFields || null,
    },
  };
  await next();
}

export async function cancelTask(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_tasks');
  const task = await repo.findOne({ filter: { id: taskId } });
  if (!task) {
    ctx.throw(404, 'Task not found');
  }
  if (['completed', 'failed', 'cancelled'].includes(task.status)) {
    ctx.throw(400, 'Cannot cancel a completed/failed/cancelled task');
  }
  await repo.update({
    filterByTk: task.id,
    values: { status: 'cancelled', progress: task.progress },
  });
  ctx.body = { data: { success: true } };
  await next();
}
