import { Context, Next } from '@nocobase/actions';
import { PermissionService } from '../services/permission-service';

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
  } catch {
    /* 忽略 */
  }
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
    targetType = permissions[0].targetType || params.targetType || '';
    targetId = String(permissions[0].targetId || params.targetId || '');
  } else {
    targetType = params.targetType || ctx.request.query?.targetType || '';
    targetId = params.targetId || ctx.request.query?.targetId || '';
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
          await logRepo.create({
            values: {
              action: 'delete',
              targetType: existing.targetType,
              targetId: existing.targetId,
              targetName: existing.targetName,
              tableName: existing.tableName,
              changes: { before: existing.toJSON?.() || existing },
              operatorId,
              createdAt: new Date(),
            },
            transaction,
          });
        } catch {
          /* 忽略 */
        }
      }
    }
    for (const perm of permissions) {
      if (perm.canImport && (!perm.importMode || !Array.isArray(perm.importMode) || perm.importMode.length === 0)) {
        perm.importMode = ['insert', 'update', 'upsert'];
      }
      const existing = existingPerms.find((e: any) => e.tableName === perm.tableName);
      if (existing) {
        await repo.update({
          filterByTk: existing.id,
          values: { ...perm, targetType, targetId: String(targetId) },
          transaction,
        });
        try {
          await logRepo.create({
            values: {
              action: 'update',
              targetType,
              targetId: String(targetId),
              targetName: perm.targetName || existing.targetName,
              tableName: perm.tableName,
              changes: { before: existing.toJSON?.() || existing, after: perm },
              operatorId,
              createdAt: new Date(),
            },
            transaction,
          });
        } catch {
          /* 忽略 */
        }
      } else {
        await repo.create({ values: { ...perm, targetType, targetId: String(targetId), operatorId }, transaction });
        try {
          await logRepo.create({
            values: {
              action: 'create',
              targetType,
              targetId: String(targetId),
              targetName: perm.targetName,
              tableName: perm.tableName,
              changes: { after: perm },
              operatorId,
              createdAt: new Date(),
            },
            transaction,
          });
        } catch {
          /* 忽略 */
        }
      }
    }
    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      /* 忽略 */
    }
    throw err;
  }
  ctx.body = { success: true };
  await next();
}

export async function getSettings(ctx: Context, next: Next) {
  const repo = ctx.db.getRepository('sjgl02_settings');
  const currentUserId = ctx.state.currentUser?.id;
  const requestedUserId = ctx.action.params.userId;
  const isAdmin = (ctx.state.currentUser?.roles || []).some((r: any) => r.name === 'admin' || r.name === 'root');
  if (!isAdmin && requestedUserId != null && requestedUserId !== currentUserId) {
    ctx.throw(403, 'Access denied');
  }
  const userId = requestedUserId ?? currentUserId;
  let settings = null;
  if (userId != null) settings = await repo.findOne({ filter: { userId } });
  if (!settings) {
    settings = await repo.findOne({ filter: { userId: { $is: null } } });
  }
  ctx.body = settings || { taskViewScope: 'own', maxFileSize: 50, batchSize: 1000 };
  await next();
}

export async function saveSettings(ctx: Context, next: Next) {
  const values = ctx.action.params.values || ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_settings');
  const currentUserId = ctx.state.currentUser?.id;
  const isAdmin = (ctx.state.currentUser?.roles || []).some((r: any) => r.name === 'admin' || r.name === 'root');
  const userId = values.userId ?? currentUserId;
  if (!isAdmin && values.userId != null && values.userId !== currentUserId) {
    ctx.throw(403, 'Access denied');
  }
  let settings = null;
  if (userId != null) settings = await repo.findOne({ filter: { userId } });
  if (settings) {
    await repo.update({ filterByTk: settings.id, values: { ...values, userId } });
  } else {
    await repo.create({ values: { ...values, userId: userId ?? null } });
  }
  ctx.body = { success: true };
  await next();
}
