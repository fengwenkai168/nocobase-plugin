import { currentUserId } from './utils';
import type Plugin from '../plugin';
import { PermissionService } from '../services/permission';
import { ExportEngine, ExportTaskParams } from '../services/export-engine';
import { cleanTitle } from '../services/field-meta';

export function registerExportActions(plugin: Plugin) {
  const permissionService = new PermissionService(plugin);
  const engine = new ExportEngine(plugin);

  plugin.taskQueue.registerHandler('export', async (ctx, params) => {
    return engine.run(ctx, params as unknown as ExportTaskParams);
  });

  return {
    'getExportPermissions': async (ctx, next) => {
      const userId = currentUserId(ctx);
      const __p = { ...(ctx.action.params || {}), ...(ctx.action.params.values || {}) };
      const { collectionName } = __p;
      const permissions = await permissionService.listExportPermissions(userId, collectionName || undefined);
      ctx.body = { permissions };
      await next();
    },

    'exportableCollections': async (ctx, next) => {
      const userId = currentUserId(ctx);
      const roleNames = await permissionService.getUserRoleNames(userId);
      const isAdmin = permissionService.isAdmin(roleNames);
      let names: Set<string>;
      if (isAdmin) {
        names = new Set([...plugin.db.collections.values()].map((c) => c.name));
      } else {
        names = new Set<string>();
        const models = await plugin.db.getRepository('sjgl02Permissions').find({
          filter: {
            canExport: true,
            $or: [
              { targetType: 'user', targetId: String(userId) },
              ...(roleNames.length ? [{ targetType: 'role', targetId: { $in: roleNames } }] : []),
            ],
          },
        });
        for (const m of models) names.add(m.get('collectionName') as string);
      }
      const collections = [...plugin.db.collections.values()]
        .filter((c) => names.has(c.name))
        .map((c) => ({ name: c.name, title: cleanTitle(c.options.title, c.name) }));
      ctx.body = { collections, isAdmin };
      await next();
    },

    'export': async (ctx, next) => {
      const values = (ctx.action.params.values || {}) as Record<string, unknown>;
      const userId = currentUserId(ctx);
      const allTables = !!values.allTables;
      let exportFilter: unknown = null;
      let permissionConfigId: number | undefined;
      let permissionType: string | undefined;
      let permissionLabel: string | undefined;

      if (allTables) {
        const roleNames = await permissionService.getUserRoleNames(userId);
        if (!permissionService.isAdmin(roleNames)) {
          ctx.throw(403, '「全部数据表（含系统表）」导出仅 admin/root 可用');
        }
      } else {
        if (!values.collectionName) {
          ctx.throw(400, '缺少参数 collectionName');
        }
        const fields = (values.fields || []) as Array<{ field: string }>;
        if (!fields.length) {
          ctx.throw(400, '未选择任何导出字段');
        }
        const { config } = await permissionService.getPermissionForExecution(
          userId,
          values.permissionConfigId === undefined || values.permissionConfigId === null
            ? null
            : Number(values.permissionConfigId),
        );
        if (!config.canExport) {
          ctx.throw(403, '该权限配置不允许导出');
        }
        if (config.exportFields.length) {
          const requested = fields.map((f) => f.field);
          const denied = requested.filter((f) => !config.exportFields.includes(f));
          if (denied.length) {
            ctx.throw(403, `字段 ${denied.join(', ')} 不在可导出字段白名单内`);
          }
        }
        exportFilter = config.exportFilter;
        permissionConfigId = config.id ?? undefined;
        permissionType = config.targetType;
        permissionLabel = config.targetName
          ? `${config.targetType === 'user' ? '👤' : '👥'} ${config.targetName}`
          : undefined;
      }

      const collectionName = allTables ? '__all__' : String(values.collectionName);
      const collection = allTables ? null : plugin.db.getCollection(collectionName);
      const collectionTitle = allTables ? '全部数据表' : String(collection?.options.title || collectionName);

      const taskParams: ExportTaskParams = {
        collectionName,
        allTables,
        fields: (values.fields || []) as ExportTaskParams['fields'],
        headerType: (values.headerType as ExportTaskParams['headerType']) || 'titleName',
        filter: (values.filter as Record<string, unknown>) || null,
        exportFilter: exportFilter as Record<string, unknown> | null,
        relationFields: (values.relationFields as string[]) || [],
        relationExportMode: (values.relationExportMode as ExportTaskParams['relationExportMode']) || 'sheet',
        exportAttachment: !!values.exportAttachment,
        globalDateFormat: (values.globalDateFormat as string) || 'YYYY-MM-DD HH:mm:ss',
        globalRelationFormat: (values.globalRelationFormat as ExportTaskParams['globalRelationFormat']) || 'display',
        operatorUserId: userId,
      };
      const task = await plugin.taskQueue.submit('export', taskParams as unknown as Record<string, unknown>, userId, {
        title: `${collectionTitle} 导出`,
        collectionName,
        collectionTitle,
        permissionConfigId,
        permissionType,
        permissionLabel,
      });
      ctx.body = { taskId: task.get('id') };
      await next();
    },
  };
}
