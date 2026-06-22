import { Context, Next } from '@nocobase/actions';

export async function getUserRoleList(ctx: Context, next: Next) {
  const userRepo = ctx.db.getRepository('users');
  const roleRepo = ctx.db.getRepository('roles');
  const users = await userRepo.find({ limit: 50 });
  const roles = await roleRepo.find({ limit: 20 });
  ctx.body = {
    data: {
      users: users.map((u) => ({
        id: u.id,
        nickname: u.nickname || u.username || u.email,
        type: 'user',
      })),
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        title: r.title,
        type: 'role',
      })),
    },
  };
  await next();
}

export async function getTables(ctx: Context, next: Next) {
  const collectionManager = (ctx.db as any).collectionManager || ctx.db;
  let collections: any[] = [];
  try {
    if (typeof collectionManager.getCollections === 'function') {
      collections = Array.from(collectionManager.getCollections().values() || []);
    } else if (collectionManager.collections instanceof Map) {
      collections = Array.from(collectionManager.collections.values());
    } else if (collectionManager.collections) {
      collections = Object.values(collectionManager.collections);
    }
  } catch {
    collections = [];
  }
  const tables = collections
    .filter((c: any) => {
      try { return !(c.isThrough && c.isThrough()); } catch { return true; }
    })
    .map((c: any) => ({
      name: c.name,
      title: c.options?.title || c.name,
    }));
  ctx.body = { data: tables };
  await next();
}

export async function getPermissions(ctx: Context, next: Next) {
  const { targetType, targetId } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_table_permissions');
  const permissions = await repo.find({ filter: { targetType, targetId } });
  ctx.body = { data: permissions };
  await next();
}

export async function savePermissions(ctx: Context, next: Next) {
  const { permissions } = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_table_permissions');
  for (const perm of permissions) {
    if (perm.id) {
      await repo.update({
        filterByTk: perm.id,
        values: perm,
      });
    } else {
      await repo.create({ values: perm });
    }
  }
  ctx.body = { data: { success: true } };
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
  ctx.body = { data: settings };
  await next();
}

export async function saveSettings(ctx: Context, next: Next) {
  const values = ctx.action.params;
  const repo = ctx.db.getRepository('sjgl02_settings');
  let settings = await repo.findOne();
  if (settings) {
    await repo.update({ filterByTk: settings.id, values });
  } else {
    await repo.create({ values });
  }
  ctx.body = { data: { success: true } };
  await next();
}
