import { Context, Next } from '@nocobase/actions';

export async function listTaskLogs(ctx: Context, next: Next) {
  const { taskId } = ctx.action.params;
  const page = Math.max(1, parseInt(ctx.action.params.page || '1', 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(ctx.action.params.pageSize || '100', 10) || 100));
  const repo = ctx.db.getRepository('sjgl02_task_logs');
  const [rows, total] = await repo.findAndCount({
    filter: { taskId: parseInt(taskId, 10) || 0 },
    sort: ['timestamp'],
    offset: (page - 1) * pageSize,
    limit: pageSize,
  } as any);
  ctx.body = { items: rows, total, page, pageSize };
  await next();
}

export async function writeTaskLog(ctx: Context, taskId: number, level: string, message: string) {
  try {
    const repo = ctx.db.getRepository('sjgl02_task_logs');
    await repo.create({ values: { taskId, level, message, timestamp: new Date() } });
  } catch (e) {
    console.error('[sjgl02] writeTaskLog failed:', e);
  }
}
