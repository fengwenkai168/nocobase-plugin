import { Context, Next } from '@nocobase/actions';

export async function listTasks(ctx: Context, next: Next) {
  const { taskType, status } = ctx.action.params;
  const page = Math.max(1, parseInt(ctx.action.params.page || '1', 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(ctx.action.params.pageSize || '20', 10) || 20));
  const filter: any = {};
  if (taskType && taskType !== 'all') filter.taskType = taskType;
  if (status && status !== 'all') filter.status = status;

  const taskViewScope = await getTaskViewScope(ctx);
  if (taskViewScope === 'own') {
    filter.createdById = ctx.state.currentUser?.id || -1;
  }

  const repo = ctx.db.getRepository('sjgl02_tasks');
  const [rows, total] = await repo.findAndCount({
    filter,
    appends: ['createdBy'],
    page,
    pageSize,
    sort: ['-createdAt'],
  });
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
  if (['completed', 'failed', 'cancelled'].includes(task.status)) {
    ctx.throw(400, 'Cannot cancel a completed/failed/cancelled task');
  }
  await repo.update({
    filterByTk: task.id,
    values: { status: 'cancelled', progress: task.progress },
  });
  ctx.body = { success: true };
  await next();
}

async function getTaskViewScope(ctx: Context): Promise<string> {
  try {
    const roleNames = (ctx.state.currentUser?.roles || []).map((r: any) => r.name);
    if (roleNames.length > 0) {
      const roleRepo = ctx.db.getRepository('roles');
      const userRoles = aw