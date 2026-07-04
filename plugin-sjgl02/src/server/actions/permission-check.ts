import { Context } from '@nocobase/actions';
import { PermissionService, type TablePermission, type PermSource } from '../services/permission-service';

export type { TablePermission, PermSource };

export async function checkImportPermission(ctx: Context, tableName: string, permSource?: PermSource | null): Promise<TablePermission> {
  const currentUser = ctx.state.currentUser;
  if (!currentUser) {
    ctx.throw(401, '请先登录');
  }
  const service = new PermissionService(ctx.db);
  try {
    return await service.checkPermission(currentUser.id, tableName, 'import', permSource);
  } catch (err: any) {
    ctx.throw(403, err.message || '导入权限校验失败');
  }
}

export async function checkExportPermission(ctx: Context, tableName: string, permSource?: PermSource | null): Promise<TablePermission> {
  const currentUser = ctx.state.currentUser;
  if (!currentUser) {
    ctx.throw(401, '请先登录');
  }
  const service = new PermissionService(ctx.db);
  try {
    return await service.checkPermission(currentUser.id, tableName, 'export', permSource);
  } catch (err: any) {
    ctx.throw(403, err.message || '导出权限校验失败');
  }
}
