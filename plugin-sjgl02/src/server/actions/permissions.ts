import { Context, Next } from '@nocobase/actions';

export async function getUserRoleList(ctx: Context, next: Next) {
  const userRepo = ctx.db.getRepository('users');
  const roleRepo = ctx.db.getRepository('roles');
  const users = await userRepo.find({ limit: 500, sort: ['id'] });
  const roles = await roleRepo.find({ limit: 200, sort: ['name'] });
  ctx.body = {
    users: users.map((u: any) => ({
      id: String(u.id),
      nickname: u.nickname || u.username || u.email,
      type: 'user',
    })),
    roles: roles.map((r: any) => ({
      id: String(r.name),
      name: r.name,
      title: r.title,
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
    // fallback: return empty
  }
  ctx.body = collections;
  await next();
}

export async function getPermissions(ctx: Context, next: Next) {
  const { targetType, targetId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_table_permissions');
  const permissions = await repo.find({ filter: { targetType, targetId } });
  ctx.body = permissions;
  await next();
}

export async function savePermissions(ctx: Context, next: Next) {
  const params = ctx.action.params.values || ctx.action.params;
  const { permissions } = params;
  if (!permissions || !Array.isArray(permissions)) {
    ctx.body = { success: true };
    await next();
    return;
  }
  const repo = ctx.db.getRepository('sjgl02_table_permissions');
  if (permissions.length === 0) {
    ctx.body = { success: true };
    await next();
    return;
  }
  const firstPerm = permissions[0];
  const filter = { targetType: firstPerm.targetType, targetId: firstPerm.targetId };
  const existingPerms = await repo.find({ filter });
  const submittedTableNames = new Set(permissions.map((p: any) => p.tableName));
  for (const existing of existingPerms) {
    if (!submittedTableNames.has(existing.tableName)) {
      await repo.destroy({ filterByTk: existing.id });
    }
  }
  for (const perm of permissions) {
    if (perm.id) {
      await repo.update({ filterByTk: perm.id, values: perm });
    } else {
      await repo.create({ values: perm });
    }
  }
  ctx.body = { success: true };
  await next();
}

export async function getSettings(ctx: Context, next: Next) {
  const repo = ctx.db.getRepository('sjgl02_settings');
  let settings = await repo.findOne();
  if (!settings) {
    settings = await repo.create({
      values: { taskViewScope: 'own', maxFileSize: 50, batchSize: 1000 },
    });
  }
  ctx.body = settings;
  await next();
}

export async function saveSettings(ctx: Context, next: Next) {
  const values = ctx.action.params.values || ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_settings');
  let settings = await repo.findOne();
  if (settings) {
    await repo.update({ filterByTk: settings.id, values });
  } else {
    await repo.create({ values });
  }
  ctx.body = { success: true };
  await next();
}
