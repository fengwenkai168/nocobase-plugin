import { Context, Next } from '@nocobase/actions';
import { PermissionService } from '../services/permission-service';

function isAdminOrRoot(ctx: Context): boolean {
  try {
    const roleNames = (ctx.state.currentUser?.roles || []).map((r: any) => r.name);
    return roleNames.some((n: string) => n === 'admin' || n === 'root');
  } catch {
    return false;
  }
}

export async function getExportScopes(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { tableName } = params;
  const currentUserId = ctx.state.currentUser?.id;
  if (!currentUserId) {
    ctx.throw(401, 'Unauthorized');
  }
  if (!tableName) {
    ctx.throw(400, 'tableName is required');
  }
  const service = new PermissionService(ctx.db);
  let permSource = null;
  if (isAdminOrRoot(ctx)) {
    const { permSourceType, permSourceId } = params;
    if (permSourceType && permSourceId) {
      permSource = { type: permSourceType, id: String(permSourceId) };
    }
  }
  const scopes = await service.getExportScopes(Number(currentUserId), tableName, permSource);
  ctx.body = { options: scopes };
  await next();
}

export async function getUserRoleList(ctx: Context, next: Next) {
  const userRepo = ctx.db.getRepository('users');
  const roleRepo = ctx.db.getRepository('roles');
  const users = await userRepo.find({ limit: 500, sort: ['id'], appends: ['roles'] });
  const roles = await roleRepo.find({ limit: 200, sort: ['name'] });
  ctx.body = {
    users: users.map((u: any) => ({
      id: String(u.id),
      nickname: u.nickname || u.username || u.email,
      type: 'user',
      roles: (u.roles || []).map((r: any) => ({
        name: r.name,
        title: r.title && !/^\{\{/.test(r.title) ? r.title : r.name,
      })),
    })),
    roles: roles.map((r: any) => ({
      id: r.name,
      name: r.name,
      title: r.title && !/^\{\{/.test(r.title) ? r.title : r.name,
      type: 'role',
    })),
  };
  await next();
}

export async function getTables(ctx: Context, next: Next) {
  const collections: any[] = [];
  try {
    const dbCollections = ctx.db.collections;
    if (dbCollections instanceof Map) {
      for (const [name, coll] of dbCollections) {
        try {
          const isThrough = (coll as any).isThrough ? (coll as any).isThrough() : false;
          if (!isThrough) {
            collections.push({
              name,
              title: (coll as any).options?.title || name,
            });
          }
        } catch {
          collections.push({
            name,
            title: (coll as any).options?.title || name,
          });
        }
      }
    }
  } catch {}
  ctx.body = collections;
  await next();
}

export async function getPermissions(ctx: Context, next: Next) {
  const { targetType, targetId } = ctx.action.params;

  if (!targetType || !targetId) {
    ctx.body = { custom: [], inherited: [] };
    await next();
    return;
  }

  const service = new PermissionService(ctx.db);

  if (targetType === 'role') {
    ctx.body = await service.getRolePermissions(String(targetId));
    await next();
    return;
  }

  if (targetType === 'user') {
    ctx.body = await service.getUserPermissions(Number(targetId));
    await next();
    return;
  }

  ctx.body = { custom: [], inherited: [] };
  await next();
}

export async function savePermissions(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { permissions } = params;
  const repo = ctx.db.getRepository('sjgl02_table_permissions');
  const logRepo = ctx.db.getRepository('sjgl02_permission_logs');
  const sequelize = ctx.db.sequelize;

  let targetType = '';
  let targetId = '';
  if (permissions && permissions.length > 0) {
    targetType = permissions[0].targetType || '';
    targetId = String(permissions[0].targetId || '');
  } else {
    targetType = ctx.action.params.values?.targetType || ctx.request.query?.targetType || '';
    targetId = ctx.action.params.values?.targetId || ctx.request.query?.targetId || '';
  }

  if (targetType === 'role' && (targetId === 'admin' || targetId === 'root')) {
    ctx.body = { success: true };
    await next();
    return;
  }

  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    ctx.body = { success: true };
    await next();
    return;
  }

  const filter = { targetType, targetId: String(targetId) };
  const existingPerms = await repo.find({ filter });
  const operatorId = ctx.state.currentUser?.id;

  const transaction = await sequelize.transaction();
  try {
    const submittedTableNames = new Set(permissions.map((p: any) => p.tableName));
    for (const existing of existingPerms) {
      if (!submittedTableNames.has(existing.tableName)) {
        await repo.destroy({ filterByTk: existing.id, transaction });
        try {
          await logRepo.create({ values: {
            action: 'delete', targetType: existing.targetType, targetId: existing.targetId,
            targetName: existing.targetName, tableName: existing.tableName,
            changes: { before: existing.toJSON?.() || existing },
            operatorId, createdAt: new Date(),
          }, transaction });
        } catch {}
      }
    }
    for (const perm of permissions) {
      if (perm.canImport && (!perm.importMode || !Array.isArray(perm.importMode) || perm.importMode.length === 0)) {
        perm.importMode = ['insert', 'update', 'upsert'];
      }
      const existing = existingPerms.find((e: any) => e.tableName === perm.tableName);
      if (perm.id && existing) {
        await repo.update({ filterByTk: perm.id, values: perm, transaction });
        try {
          await logRepo.create({ values: {
            action: 'update', targetType: perm.targetType, targetId: perm.targetId,
            targetName: perm.targetName, tableName: perm.tableName,
            changes: { before: existing.toJSON?.() || existing, after: perm },
            operatorId, createdAt: new Date(),
          }, transaction });
        } catch {}
      } else if (!perm.id) {
        await repo.create({ values: { ...perm, targetType, targetId: String(targetId), operatorId }, transaction });
        try {
          await logRepo.create({ values: {
            action: 'create', targetType, targetId: String(targetId),
            tableName: perm.tableName, changes: { after: perm },
            operatorId, createdAt: new Date(),
          }, transaction });
        } catch {}
      }
    }
    await transaction.commit();
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    throw err;
  }
  ctx.body = { success: true };
  await next();
}

export async function getSettings(ctx: Context, next: Next) {
  const repo = ctx.db.getRepository('sjgl02_settings');
  const userId = ctx.action.params.userId || ctx.state.currentUser?.id;
  let settings = null;
  if (userId) settings = await repo.findOne({ filter: { userId } });
  if (!settings) {
    settings = await repo.findOne({ filter: { userId: { $is: null } } });
  }
  ctx.body = settings || { taskViewScope: 'own', maxFileSize: 50, batchSize: 1000 };
  await next();
}

export async function saveSettings(ctx: Context, next: Next) {
  const values = ctx.action.params.values || ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_settings');
  const userId = values.userId || ctx.state.currentUser?.id;
  let settings = null;
  if (userId) settings = await repo.findOne({ filter: { userId } });
  if (settings) {
    await repo.update({ filterByTk: settings.id, values: { ...values, userId } });
  } else {
    await repo.create({ values: { ...values, userId: userId || null } });
  }
  ctx.body = { success: true };
  await next();
}
