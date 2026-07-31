import { currentUserId } from './utils';
import fs from 'node:fs';
import path from 'node:path';
import type Plugin from '../plugin';
import { PermissionService } from '../services/permission';

const ACTIVE_STATUSES = ['pending', 'running'];

function encodeFileName(name: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function registerTaskActions(plugin: Plugin) {
  const permissionService = new PermissionService(plugin);

  async function getScope(userId: number): Promise<'self' | 'all'> {
    const record = await plugin.db.getRepository('sjgl02UserSettings').findOne({ filter: { userId } });
    return (record?.get('taskScope') as 'self' | 'all') || 'self';
  }

  async function canViewAll(userId: number): Promise<boolean> {
    const roleNames = await permissionService.getUserRoleNames(userId);
    if (permissionService.isAdmin(roleNames)) return true;
    return (await getScope(userId)) === 'all';
  }

  plugin.app.resourcer.use(
    async (ctx, next) => {
      const { resourceName, actionName } = ctx.action;
      if (resourceName === 'sjgl02Tasks' && ['list', 'get'].includes(actionName)) {
        const userId = currentUserId(ctx);
        if (userId && !(await canViewAll(userId))) {
          const existing = ctx.action.params.filter;
          const scopeFilter = { createdById: userId };
          ctx.action.mergeParams({
            filter: existing && Object.keys(existing).length ? { $and: [existing, scopeFilter] } : scopeFilter,
          });
        }
      }
      await next();
    },
    { tag: 'sjgl02TaskScope', after: 'auth' },
  );

  return {
    'stats': async (ctx, next) => {
      const repo = plugin.db.getRepository('sjgl02Tasks');
      const userId = currentUserId(ctx);
      const filter: Record<string, unknown> = {};
      if (userId && !(await canViewAll(userId))) {
        filter.createdById = userId;
      }
      const tasks = await repo.find({ filter, fields: ['status'] });
      const counts: Record<string, number> = { total: 0, succeeded: 0, running: 0, pending: 0, failed: 0, canceled: 0 };
      for (const task of tasks) {
        const status = task.get('status') as string;
        counts.total += 1;
        if (status in counts) counts[status] += 1;
      }
      ctx.body = counts;
      await next();
    },

    'download': async (ctx, next) => {
      const taskId = Number(ctx.action.params.filterByTk);
      const type = (ctx.action.params.type || 'result') as 'result' | 'source';
      const task = await plugin.db.getRepository('sjgl02Tasks').findOne({ filter: { id: taskId } });
      if (!task) ctx.throw(404, '任务不存在');
      const userId = currentUserId(ctx);
      if (userId && !(await canViewAll(userId)) && Number(task.get('createdById')) !== userId) {
        ctx.throw(403, '无权下载该任务文件');
      }
      let filePath: string | null = null;
      let fileName = 'download';
      if (type === 'source' && task.get('type') === 'import') {
        filePath = (task.get('params') as Record<string, unknown>)?.filePath as string;
        fileName = (task.get('params') as Record<string, unknown>)?.fileName as string;
      } else {
        filePath = task.get('filePath') as string;
        fileName = (task.get('fileName') as string) || fileName;
      }
      if (!filePath || !fs.existsSync(filePath)) {
        ctx.throw(404, '文件不存在或已被清理');
      }
      const stat = fs.statSync(filePath);
      ctx.set('Content-Type', 'application/octet-stream');
      ctx.set('Content-Length', String(stat.size));
      ctx.set('Content-Disposition', encodeFileName(fileName || path.basename(filePath)));
      ctx.body = fs.createReadStream(filePath);
      await next();
    },

    'exportErrorReport': async (ctx, next) => {
      const taskId = Number(ctx.action.params.filterByTk);
      const task = await plugin.db.getRepository('sjgl02Tasks').findOne({ filter: { id: taskId } });
      if (!task) ctx.throw(404, '任务不存在');
      const userId = currentUserId(ctx);
      if (userId && !(await canViewAll(userId)) && Number(task.get('createdById')) !== userId) {
        ctx.throw(403, '无权下载该任务错误报告');
      }
      const result = (task.get('result') || {}) as { errors?: Array<{ row: number; field: string; reason: string; raw: unknown }> };
      const errors = result.errors || [];
      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = ['行号,字段,错误原因,原始数据'];
      for (const e of errors) {
        lines.push([e.row, escape(e.field), escape(e.reason), escape(e.raw)].join(','));
      }
      const csv = '﻿' + lines.join('\n');
      ctx.withoutDataWrapping = true;
      ctx.set('Content-Type', 'text/csv; charset=utf-8');
      ctx.set('Content-Disposition', encodeFileName(`错误报告-任务${taskId}.csv`));
      ctx.body = csv;
      await next();
    },

    'retry': async (ctx, next) => {
      const taskId = Number(ctx.action.params.filterByTk);
      const task = await plugin.db.getRepository('sjgl02Tasks').findOne({ filter: { id: taskId } });
      if (!task) ctx.throw(404, '任务不存在');
      const type = task.get('type') as string;
      if (!['import', 'export'].includes(type)) {
        ctx.throw(400, '仅导入/导出任务可重新执行');
      }
      const status = task.get('status') as string;
      if (!['failed', 'canceled'].includes(status)) {
        ctx.throw(400, '仅失败或已取消的任务可重新执行');
      }
      const params = (task.get('params') || {}) as Record<string, unknown>;
      params.operatorUserId = currentUserId(ctx);
      const newTask = await plugin.taskQueue.submit(type, params, currentUserId(ctx), {
        title: `${task.get('title') || task.get('collectionName')}（重试）`,
        collectionName: task.get('collectionName') as string,
        collectionTitle: task.get('collectionTitle') as string,
        permissionConfigId: task.get('permissionConfigId') as number,
        permissionType: task.get('permissionType') as string,
        permissionLabel: task.get('permissionLabel') as string | undefined,
      });
      ctx.body = { taskId: newTask.get('id') };
      await next();
    },

    'getScope': async (ctx, next) => {
      const targetUserId = Number(ctx.action.params.userId || currentUserId(ctx));
      ctx.body = { userId: targetUserId, scope: await getScope(targetUserId) };
      await next();
    },

    'setScope': async (ctx, next) => {
      const { userId: targetUserIdRaw, scope } = ctx.action.params.values || {};
      const operatorId = currentUserId(ctx);
      const targetUserId = Number(targetUserIdRaw || operatorId);
      if (targetUserId !== operatorId) {
        const roleNames = await permissionService.getUserRoleNames(operatorId);
        if (!permissionService.isAdmin(roleNames)) {
          ctx.throw(403, '仅 admin/root 可修改其他用户的查看范围');
        }
      }
      if (!['self', 'all'].includes(scope)) {
        ctx.throw(400, 'scope 必须为 self 或 all');
      }
      const repo = plugin.db.getRepository('sjgl02UserSettings');
      const existing = await repo.findOne({ filter: { userId: targetUserId } });
      if (existing) {
        await repo.update({ filter: { userId: targetUserId }, values: { taskScope: scope } });
      } else {
        await repo.create({ values: { userId: targetUserId, taskScope: scope } });
      }
      ctx.body = { userId: targetUserId, scope };
      await next();
    },
  };
}
