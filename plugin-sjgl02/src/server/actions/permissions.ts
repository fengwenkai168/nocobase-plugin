import { Context, Next } from '@nocobase/actions';

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
    // fallback: return empty
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

  const repo = ctx.db.getRepository('sjgl02_table_permissions');

  if (targetType === 'user') {
    let rolePerms: any[] = [];
    try {
      const userRepo = ctx.db.getRepository('users');
      const user = await userRepo.findOne({ filterByTk: Number(targetId), appends: ['roles'] });
      const roleNames = (user?.roles || []).map((r: any) => r.name);
      if (roleNames.length > 0) {
        rolePerms = (await repo.find({ filter: { targetType: 'role', targetId: { $in: roleNames } } })).map((p: any) => ({ ...(p.toJSON ? p.toJSON() : p), _inherited: true }));
      }
    } catch {}
    const userPerms = (await repo.find({ filter: { targetType: 'user', targetId: String(targetId) } })).map((p: any) => ({ ...(p.toJSON ? p.toJSON() : p), _inherited: false }));
    ctx.body = { custom: userPerms, inherited: rolePerms };
    await next();
    return;
  }

  if (targetType === 'role') {
    try {
      const roleRepo = ctx.db.getRepository('roles');
      const role = await roleRepo.findOne({ filter: { name: targetId } });
      if (role?.name === 'admin' || role?.name === 'root') {
        const existing = await repo.find({ filter: { targetType: 'role', targetId: String(targetId) } });
        const existingNames = new Set(existing.map((p: any) => p.tableName));
        const tables = ctx.db.collections;
        const toCreate: any[] = [];
        for (const [name] of tables) {
          if (!existingNames.has(name)) {
            toCreate.push({
              targetType: 'role',
              targetId: String(targetId),
              targetName: role?.name === 'root' ? '超级管理员' : '管理员',
              tableName: name,
              canImport: true,
              canExport: true,
              importMode: ['insert', 'update', 'upsert'],
              uniqueFields: [],
              requiredFields: [],
              importFields: [],
              exportFields: [],
            });
          }
        }
        if (toCreate.length > 0) {
          for (const item of toCreate) {
            await repo.create({ values: item });
          }
        }
      }
    } catch {}
  }

  const permissions = (await repo.find({ filter: { targetType, targetId: String(targetId) } })).map((p: any) => ({ ...(p.toJSON ? p.toJSON() : p) }));
  if (targetType === 'role') {
    try {
      const r = await ctx.db.getRepository('roles').findOne({ filter: { name: targetId } });
      if (r?.name === 'admin' || r?.name === 'root') {
        permissions.forEach((p: any) => { p._inherited = true; p._systemManaged = true; });
      }
    } catch {}
  }
  ctx.body = { custom: permissions, inherited: [] };
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
    return;
  }
  const filter = { targetType: firstPerm.targetType, targetId: String(firstPerm.targetId) };
  const existingPerms = await repo.find({ filter });
  const logRepo = ctx.db.getRepository('sjgl02_permission_logs');
  const operatorId = ctx.state.currentUser?.id;
  const submittedTableNames = new Set(permissions.map((p: any) => p.tableName));
  for (const existing of existingPerms) {
    if (!submittedTableNames.has(existing.tableName)) {
      await repo.destroy({ filterByTk: existing.id });
      try {
        await logRepo.create({ values: {
          action: 'delete', targetType: existing.targetType, targetId: existing.targetId,
          targetName: existing.targetName, tableName: existing.tableName,
          changes: { before: existing.toJSON?.() || existing },
          operatorId, createdAt: new Date(),
        }});
      } catch {}
    }
  }
  for (const perm of permissions) {
    if (perm.canImport && (!perm.importMode || !Array.isArray(perm.importMode) || perm.importMode.length === 0)) {
      perm.importMode = ['insert', 'update', 'upsert'];
    }
    const existing = existingPerms.find((e: any) => e.tableName === perm.tableName);
    if (perm.id && existing) {
      await repo.update({ filterByTk: perm.id, values: perm });
      try {
        await logRepo.create({ values: {
          action: 'update', targetType: perm.targetType, targetId: perm.targetId,
          targetName: perm.targetName, tableName: perm.tableName,
          changes: { before: existing.toJSON?.() || existing, after: perm },
          operatorId, createdAt: new Date(),
        }});
      } catch {}
    } else if (!perm.id) {
      await repo.create({ values: perm });
      try {
        await logRepo.create({ values: {
          action: 'create', targetType: perm.targetType, targetId: perm.targetId,
          targetName: perm.targetName, tableName: perm.tableName,
          changes: { after: perm },
          operatorId, createdAt: new Date(),
        }});
      } catch {}
    }
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
