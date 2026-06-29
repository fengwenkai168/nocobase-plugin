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
    // fallback: return empty
  }
  ctx.body = collections;
  await next();
}

export async function getPermissions(ctx: Context, next: Next) {
  const { targetType, targetId } = ctx.action.params;

  if (!targetType || !targetId) {
    ctx.body = [];
    await next();
    return;
  }

  if (targetType === 'role') {
    try {
      const roleRepo = ctx.db.getRepository('roles');
      const role = await roleRepo.findOne({ filter: { name: targetId } });
      if (role?.name === 'admin' || role?.name === 'root') {
        const repo = ctx.db.getRepository('sjgl02_table_permissions');
        const existing = await repo.find({ filter: { targetType: 'role', targetId: String(targetId) } });
        const existingNames = new Set(existing.map((p: any) => p.tableName));
        const tables = ctx.db.collections;
        for (const [name] of tables) {
          if (name.startsWith('sjgl02_')) continue;
          if (!existingNames.has(name)) {
            await repo.create({
              values: {
                targetType: 'role', targetId: String(targetId), targetName: '管理员',
                tableName: name, canImport: true, canExport: true,
                importMode: ['insert', 'update', 'upsert'], uniqueFields: [], requiredFields: [],
                importFields: [], exportFields: [],
              },
            });
          }
        }
      }
    } catch {}
  }

  const repo = ctx.db.getRepository('sjgl02_table_permissions');
  const permissions = await repo.find({ filter: { targetType, targetId: String(targetId) } });
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
  if (!firstPerm.targetType || !firstPerm.targetId) {
    ctx.body = { success: true };
    await next();
