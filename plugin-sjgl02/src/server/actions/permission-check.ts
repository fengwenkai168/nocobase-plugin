import { Context } from '@nocobase/actions';

export interface TablePermission {
  canImport: boolean;
  canExport: boolean;
  importMode: string[];
  importFields: string[];
  exportFields: string[];
  exportFilter: Record<string, unknown> | null;
  uniqueFields: string[];
  requiredFields: string[];
}

export async function checkImportPermission(ctx: Context, tableName: string): Promise<TablePermission> {
  return checkTablePermission(ctx, tableName, 'import');
}

export async function checkExportPermission(ctx: Context, tableName: string): Promise<TablePermission> {
  return checkTablePermission(ctx, tableName, 'export');
}

async function checkTablePermission(
  ctx: Context,
  tableName: string,
  actionType: 'import' | 'export',
): Promise<TablePermission> {
  const currentUser = ctx.state.currentUser;
  if (!currentUser) {
    ctx.throw(401, '请先登录');
  }

  const permRepo = ctx.db.getRepository('sjgl02_table_permissions');

  const userRepo = ctx.db.getRepository('users');
  let user: any = null;
  let roleNames: string[] = [];
  try {
    user = await userRepo.findOne({ filterByTk: currentUser.id, appends: ['roles'] });
    roleNames = (user?.roles || []).map((r: any) => r.name);
  } catch {
    // 查询角色失败，继续判断权限
  }

  const roleRepo = ctx.db.getRepository('roles');
  let isAdminOrRoot = false;
  try {
    if (roleNames.length > 0) {
      const roles = await roleRepo.find({ filter: { name: { $in: roleNames } } });
      isAdminOrRoot = roles.some((r: any) => r.name === 'admin' || r.name === 'root');
    }
  } catch {
    // 忽略角色查询失败
  }

  if (isAdminOrRoot) {
    return {
      canImport: true,
      canExport: true,
      importMode: ['insert', 'update', 'upsert'],
      importFields: [],
      exportFields: [],
      exportFilter: null,
      uniqueFields: [],
      requiredFields: [],
    };
  }

  let userPerm: any = null;
  try {
    userPerm = await permRepo.findOne({
      filter: { targetType: 'user', targetId: String(currentUser.id), tableName },
    });
  } catch {
    // 忽略查询失败
  }

  if (userPerm) {
    const fieldName = actionType === 'import' ? 'canImport' : 'canExport';
    if (!userPerm[fieldName]) {
      ctx.throw(403, `您没有对数据表「${tableName}」的${actionType === 'import' ? '导入' : '导出'}权限，请联系管理员`);
    }
    return {
      canImport: userPerm.canImport ?? false,
      canExport: userPerm.canExport ?? false,
      importMode: Array.isArray(userPerm.importMode) ? userPerm.importMode : [userPerm.importMode || 'insert'],
      importFields: userPerm.importFields || [],
      exportFields: userPerm.exportFields || [],
      exportFilter: userPerm.exportFilter || null,
      uniqueFields: userPerm.uniqueFields || [],
      requiredFields: userPerm.requiredFields || [],
    };
  }

  if (roleNames.length > 0) {
    let rolePerm: any = null;
    try {
      const rolePerms = await permRepo.find({
        filter: { targetType: 'role', targetId: { $in: roleNames }, tableName },
      });
      const fieldName = actionType === 'import' ? 'canImport' : 'canExport';
      const allowedPerms = rolePerms.filter((p: any) => p[fieldName] === true);
      if (allowedPerms.length > 0) {
        rolePerm = { ...allowedPerms[0] };
        rolePerm.importMode = [...new Set(allowedPerms.flatMap((p: any) => p.importMode || []))];
      }
    } catch {
      // 忽略查询失败
    }

    if (rolePerm) {
      const fieldName = actionType === 'import' ? 'canImport' : 'canExport';
      if (!rolePerm[fieldName]) {
        ctx.throw(403, `您的角色没有对数据表「${tableName}」的${actionType === 'import' ? '导入' : '导出'}权限，请联系管理员`);
      }
      return {
        canImport: rolePerm.canImport ?? false,
        canExport: rolePerm.canExport ?? false,
        importMode: Array.isArray(rolePerm.importMode) ? rolePerm.importMode : [rolePerm.importMode || 'insert'],
        importFields: rolePerm.importFields || [],
        exportFields: rolePerm.exportFields || [],
        exportFilter: rolePerm.exportFilter || null,
        uniqueFields: rolePerm.uniqueFields || [],
        requiredFields: rolePerm.requiredFields || [],
      };
    }
  }

  ctx.throw(403, `您没有对数据表「${tableName}」的${actionType === 'import' ? '导入' : '导出'}权限，请联系管理员`);
}
