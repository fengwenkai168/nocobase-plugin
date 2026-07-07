import { Context } from '@nocobase/actions';

/**
 * 判断当前用户是否是 admin 或 root 角色
 */
export function isAdminOrRoot(ctx: Context): boolean {
  try {
    const roleNames = (ctx.state.currentUser?.roles || []).map((r: any) => r.name);
    return roleNames.some((n: string) => n === 'admin' || n === 'root');
  } catch {
    return false;
  }
}
