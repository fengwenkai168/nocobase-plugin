import { currentUserId } from './utils';
import type Plugin from '../plugin';
import { PermissionService } from '../services/permission';

function arr(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function summarize(values: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`导入=${values.canImport ? '是' : '否'}`);
  parts.push(`导出=${values.canExport ? '是' : '否'}`);
  if (arr(values.importModes).length) parts.push(`模式=${arr(values.importModes).join('/')}`);
  if (arr(values.uniqueFields).length) parts.push(`唯一值=${arr(values.uniqueFields).join(',')}`);
  if (arr(values.requiredFields).length) parts.push(`必填=${arr(values.requiredFields).join(',')}`);
  if (arr(values.importFields).length) parts.push(`可导入=${arr(values.importFields).length}字段`);
  if (arr(values.exportFields).length) parts.push(`可导出=${arr(values.exportFields).length}字段`);
  return parts.join(' ');
}

function diffSummary(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const changes: string[] = [];
  if (before.canImport !== after.canImport) changes.push(`canImport ${before.canImport ? '是' : '否'}->${after.canImport ? '是' : '否'}`);
  if (before.canExport !== after.canExport) changes.push(`canExport ${before.canExport ? '是' : '否'}->${after.canExport ? '是' : '否'}`);
  const fields: Array<[string, string]> = [
    ['importModes', '导入模式'],
    ['uniqueFields', '唯一值字段'],
    ['requiredFields', '必填字段'],
    ['importFields', '可导入字段'],
    ['exportFields', '可导出字段'],
    ['exportFilter', '导出筛选'],
  ];
  const changedNames: string[] = [];
  for (const [key, label] of fields) {
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
      changedNames.push(label);
    }
  }
  if (changes.length) return `切换开关:${changes.join(' ')}`;
  if (changedNames.length) return `修改权限:${changedNames.join('+')}变更`;
  return '修改权限:配置变更';
}

export function registerPermissionLogHooks(plugin: Plugin) {
  const db = plugin.db;
  const logsRepo = () => db.getRepository('sjgl02PermissionLogs');
  const beforeSnapshots = new Map<unknown, Record<string, unknown>>();

  db.on('sjgl02Permissions.beforeUpdate', async (model) => {
    const json = model.toJSON() as Record<string, unknown>;
    const previous =
      (model as unknown as { _previousDataValues?: Record<string, unknown> })._previousDataValues ||
      (typeof (model as unknown as { previous?: () => Record<string, unknown> }).previous === 'function'
        ? (model as unknown as { previous: () => Record<string, unknown> }).previous()
        : json);
    beforeSnapshots.set(json.id ?? model, { ...previous });
  });

  const writeLog = async (entry: Record<string, unknown>, operatorId?: number) => {
    try {
      await logsRepo().create({ values: { ...entry, createdById: operatorId } });
    } catch (error) {
      plugin.app.logger.error('[sjgl02] 权限日志写入失败', error);
    }
  };

  db.on('sjgl02Permissions.afterCreate', async (model, options) => {
    const values = model.toJSON() as Record<string, unknown>;
    await writeLog(
      {
        action: 'create',
        targetType: values.targetType,
        targetId: values.targetId,
        targetName: values.targetName,
        collectionName: values.collectionName,
        collectionTitle: values.collectionTitle,
        permissionId: values.id,
        beforeValue: null,
        afterValue: values,
        summary: `新增权限:${summarize(values)}`,
      },
      (options?.context as { state?: { currentUserId?: number } })?.state?.currentUserId,
    );
  });

  db.on('sjgl02Permissions.afterUpdate', async (model, options) => {
    const after = model.toJSON() as Record<string, unknown>;
    const before = beforeSnapshots.get(after.id) || after;
    beforeSnapshots.delete(after.id);
    const action = before.canImport !== after.canImport || before.canExport !== after.canExport ? 'toggle' : 'update';
    await writeLog(
      {
        action,
        targetType: after.targetType,
        targetId: after.targetId,
        targetName: after.targetName,
        collectionName: after.collectionName,
        collectionTitle: after.collectionTitle,
        permissionId: after.id,
        beforeValue: before,
        afterValue: after,
        summary: diffSummary(before, after),
      },
      (options?.context as { state?: { currentUserId?: number } })?.state?.currentUserId,
    );
  });

  db.on('sjgl02Permissions.afterDestroy', async (model, options) => {
    const values = model.toJSON() as Record<string, unknown>;
    await writeLog(
      {
        action: 'delete',
        targetType: values.targetType,
        targetId: values.targetId,
        targetName: values.targetName,
        collectionName: values.collectionName,
        collectionTitle: values.collectionTitle,
        permissionId: values.id,
        beforeValue: values,
        afterValue: null,
        summary: `移除权限:${summarize(values)}`,
      },
      (options?.context as { state?: { currentUserId?: number } })?.state?.currentUserId,
    );
  });
}

function cleanTitle(title: unknown, fallback: string): string {
  const text = String(title || '');
  const match = text.match(/^\{\{t\("(.+?)"\)\}\}$/);
  return match ? match[1] : text || fallback;
}

export function registerPermissionActions(plugin: Plugin) {
  const permissionService = new PermissionService(plugin);

  plugin.app.resourcer.use(
    async (ctx, next) => {
      const { resourceName, actionName } = ctx.action;
      if (
        (resourceName === 'sjgl02Permissions' && ['create', 'update', 'destroy'].includes(actionName)) ||
        (resourceName === 'sjgl02PermissionLogs' && !['list', 'get'].includes(actionName))
      ) {
        const roleNames = await permissionService.getUserRoleNames(currentUserId(ctx));
        if (!permissionService.isAdmin(roleNames)) {
          ctx.throw(403, '仅 admin/root 可管理权限配置');
        }
      }
      await next();
    },
    { tag: 'sjgl02PermGuard', after: 'auth' },
  );

  return {
    'permTargets': async (ctx, next) => {
      const users = await plugin.db.getRepository('users').find({
        fields: ['id', 'nickname', 'username'],
        appends: ['roles'],
        sort: ['id'],
        limit: 200,
      });
      const roles = await plugin.db.getRepository('roles').find({ sort: ['name'] });
      ctx.body = {
        users: users.map((u) => ({
          id: u.get('id'),
          name: (u.get('nickname') as string) || (u.get('username') as string),
          roles: ((u.get('roles') || []) as Array<{ name: string; title?: string }>).map((r) => ({ name: r.name, title: r.title })),
        })),
        roles: roles.map((r) => ({ name: r.get('name'), title: (r.get('title') as string) || r.get('name') })),
      };
      await next();
    },

    'permList': async (ctx, next) => {
      const params = { ...(ctx.action.params || {}), ...(ctx.action.params.values || {}) };
      const { targetType, targetId } = params as { targetType: 'user' | 'role'; targetId: string };
      if (!targetType || !targetId) {
        ctx.throw(400, '缺少参数 targetType/targetId');
      }
      const repo = plugin.db.getRepository('sjgl02Permissions');
      const own = await repo.find({ filter: { targetType, targetId: String(targetId) }, sort: ['sort', 'id'] });
      const result: Record<string, unknown> = {
        own: own.map((m) => m.toJSON()),
        inherited: [],
      };
      if (targetType === 'user') {
        const roleNames = await permissionService.getUserRoleNames(Number(targetId));
        const groups: Array<{ roleName: string; roleTitle: string; items: unknown[]; isAdmin: boolean }> = [];
        for (const roleName of roleNames) {
          const isAdminRole = ['admin', 'root'].includes(roleName);
          const role = await plugin.db.getRepository('roles').findOne({ filter: { name: roleName } });
          const items = isAdminRole ? [] : (await repo.find({ filter: { targetType: 'role', targetId: roleName }, sort: ['sort', 'id'] })).map((m) => m.toJSON());
          groups.push({ roleName, roleTitle: cleanTitle(role?.get('title'), roleName), items, isAdmin: isAdminRole });
        }
        result.inherited = groups;
      }
      ctx.body = result;
      await next();
    },
  };
}
