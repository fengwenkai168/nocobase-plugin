import type Plugin from '../plugin';

export interface PermConfig {
  id: number | null;
  targetType: 'user' | 'role';
  targetId: string;
  targetName: string;
  canImport: boolean;
  canExport: boolean;
  importModes: string[];
  uniqueFields: string[];
  requiredFields: string[];
  importFields: string[];
  exportFields: string[];
  exportFilter: unknown;
}

export const ADMIN_ROLES = ['admin', 'root'];

export class PermissionService {
  constructor(private plugin: Plugin) {}

  private get repo() {
    return this.plugin.db.getRepository('sjgl02Permissions');
  }

  async getUserRoleNames(userId: number): Promise<string[]> {
    if (!userId) return [];
    const user = await this.plugin.db.getRepository('users').findOne({
      filter: { id: userId },
      appends: ['roles'],
    });
    const roles = (user?.get('roles') || []) as Array<{ name: string }>;
    return roles.map((r) => r.name);
  }

  isAdmin(roleNames: string[]): boolean {
    return roleNames.some((r) => ADMIN_ROLES.includes(r));
  }

  private toConfig(model: Record<string, unknown>): PermConfig {
    const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
    return {
      id: model.id as number,
      targetType: model.targetType as 'user' | 'role',
      targetId: String(model.targetId ?? ''),
      targetName: String(model.targetName ?? ''),
      canImport: !!model.canImport,
      canExport: !!model.canExport,
      importModes: arr(model.importModes),
      uniqueFields: arr(model.uniqueFields),
      requiredFields: arr(model.requiredFields),
      importFields: arr(model.importFields),
      exportFields: arr(model.exportFields),
      exportFilter: model.exportFilter ?? null,
    };
  }

  private adminConfig(roleName: string): PermConfig {
    return {
      id: null,
      targetType: 'role',
      targetId: roleName,
      targetName: roleName === 'root' ? '超级管理员(root)' : '管理员(admin)',
      canImport: true,
      canExport: true,
      importModes: ['insert', 'update', 'upsert'],
      uniqueFields: [],
      requiredFields: [],
      importFields: [],
      exportFields: [],
      exportFilter: null,
    };
  }

  async listImportPermissions(userId: number, collectionName?: string): Promise<PermConfig[]> {
    const roleNames = await this.getUserRoleNames(userId);
    if (this.isAdmin(roleNames)) {
      const all = await this.listAllPermissions(collectionName, 'import');
      return [...all, this.adminConfig(ADMIN_ROLES.find((r) => roleNames.includes(r))!)];
    }
    return this.listConfiguredPermissions(userId, roleNames, collectionName, 'import');
  }

  async listExportPermissions(userId: number, collectionName?: string): Promise<PermConfig[]> {
    const roleNames = await this.getUserRoleNames(userId);
    if (this.isAdmin(roleNames)) {
      const all = await this.listAllPermissions(collectionName, 'export');
      return [...all, this.adminConfig(ADMIN_ROLES.find((r) => roleNames.includes(r))!)];
    }
    return this.listConfiguredPermissions(userId, roleNames, collectionName, 'export');
  }

  private async listConfiguredPermissions(
    userId: number,
    roleNames: string[],
    collectionName: string | undefined,
    kind: 'import' | 'export',
  ): Promise<PermConfig[]> {
    const flagField = kind === 'import' ? 'canImport' : 'canExport';
    const filter: Record<string, unknown> = {
      [flagField]: true,
      $or: [
        { targetType: 'user', targetId: String(userId) },
        ...(roleNames.length ? [{ targetType: 'role', targetId: { $in: roleNames } }] : []),
      ],
    };
    if (collectionName) {
      filter.collectionName = collectionName;
    }
    const models = await this.repo.find({ filter, sort: ['sort', 'id'] });
    return models.map((m) => this.toConfig(m.toJSON() as Record<string, unknown>));
  }

  private async listAllPermissions(collectionName: string | undefined, kind: 'import' | 'export'): Promise<PermConfig[]> {
    const flagField = kind === 'import' ? 'canImport' : 'canExport';
    const filter: Record<string, unknown> = { [flagField]: true };
    if (collectionName) {
      filter.collectionName = collectionName;
    }
    const models = await this.repo.find({ filter, sort: ['sort', 'id'] });
    return models.map((m) => this.toConfig(m.toJSON() as Record<string, unknown>));
  }

  async getPermissionForExecution(
    userId: number,
    permissionId: number | null | undefined,
  ): Promise<{ config: PermConfig; roleNames: string[] }> {
    const roleNames = await this.getUserRoleNames(userId);
    if (permissionId === null || permissionId === undefined) {
      if (!this.isAdmin(roleNames)) {
        throw new Error('仅 admin/root 可不指定权限配置执行');
      }
      return { config: this.adminConfig(ADMIN_ROLES.find((r) => roleNames.includes(r))!), roleNames };
    }
    const model = await this.repo.findOne({ filter: { id: permissionId } });
    if (!model) {
      throw new Error(`权限配置 #${permissionId} 不存在`);
    }
    const config = this.toConfig(model.toJSON() as Record<string, unknown>);
    if (!this.isAdmin(roleNames)) {
      const owned =
        (config.targetType === 'user' && config.targetId === String(userId)) ||
        (config.targetType === 'role' && roleNames.includes(config.targetId));
      if (!owned) {
        throw new Error('无权使用该权限配置');
      }
    }
    return { config, roleNames };
  }

  assertImportParams(
    config: PermConfig,
    params: { mode: string; mappingFields: string[]; uniqueFields: string[] },
  ): void {
    if (!config.canImport) {
      throw new Error('该权限配置不允许导入');
    }
    if (config.importModes.length && !config.importModes.includes(params.mode)) {
      throw new Error(`导入模式 ${params.mode} 不在权限允许范围内（${config.importModes.join('/')}）`);
    }
    if (config.importFields.length) {
      const denied = params.mappingFields.filter((f) => !config.importFields.includes(f));
      if (denied.length) {
        throw new Error(`字段 ${denied.join(', ')} 不在可导入字段白名单内`);
      }
    }
    if (config.uniqueFields.length) {
      const same =
        config.uniqueFields.length === params.uniqueFields.length &&
        config.uniqueFields.every((f) => params.uniqueFields.includes(f));
      if (!same) {
        throw new Error('唯一值字段由权限配置锁定，必须为：' + config.uniqueFields.join(', '));
      }
    }
    if ((params.mode === 'update' || params.mode === 'upsert') && params.uniqueFields.length === 0) {
      throw new Error('update/upsert 模式必须至少选择 1 个唯一值字段');
    }
  }
}
