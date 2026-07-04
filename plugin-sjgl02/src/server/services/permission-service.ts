import type { Database } from '@nocobase/database';

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

export interface PermSource {
  type: string;
  id?: string;
}

export class PermissionService {
  constructor(private db: Database) {}

  async getUserRoleNames(userId: number | string): Promise<string[]> {
    try {
      const repo = this.db.getRepository('rolesUsers');
      const rows = await repo.find({ filter: { userId: Number(userId) } });
      return [...new Set<string>((rows || []).map((r: any) => String(r.roleName || '')).filter(Boolean))];
    } catch {
      return [];
    }
  }

  async findPermission(targetType: string, targetId: string, tableName: string): Promise<any | null> {
    try {
      const [rows] = await this.db.sequelize.query(
        'SELECT * FROM "sjgl02_table_permissions" WHERE "targetType" = $1 AND "targetId" = $2 AND "tableName" = $3',
        { bind: [targetType, targetId, tableName], raw: true },
      );
      return (rows as any[])[0] || null;
    } catch {
      return null;
    }
  }

  async findPermissionsByTarget(targetType: string, targetId: string): Promise<any[]> {
    try {
      const [rows] = await this.db.sequelize.query(
        'SELECT * FROM "sjgl02_table_permissions" WHERE "targetType" = $1 AND "targetId" = $2 ORDER BY "id"',
        { bind: [targetType, targetId], raw: true },
      );
      return (rows as any[]) || [];
    } catch {
      return [];
    }
  }

  async findPermissionsByRoles(roleNames: string[]): Promise<any[]> {
    if (roleNames.length === 0) return [];
    try {
      const placeholders = roleNames.map((_, i) => '$' + (i + 1)).join(', ');
      const [rows] = await this.db.sequelize.query(
        'SELECT * FROM "sjgl02_table_permissions" WHERE "targetType" = \'role\' AND "targetId" IN (' +
          placeholders +
          ') ORDER BY "id"',
        { bind: roleNames, raw: true },
      );
      return (rows as any[]) || [];
    } catch {
      return [];
    }
  }

  private fullPermission(): TablePermission {
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

  private permissionFromRecord(record: any): TablePermission {
    return {
      canImport: record?.canImport ?? false,
      canExport: record?.canExport ?? false,
      importMode: Array.isArray(record?.importMode) ? record.importMode : [record?.importMode || 'insert'],
      importFields: record?.importFields || [],
      exportFields: record?.exportFields || [],
      exportFilter: record?.exportFilter || null,
      uniqueFields: record?.uniqueFields || [],
      requiredFields: record?.requiredFields || [],
    };
  }

  private mergePermissions(perms: any[]): TablePermission {
    if (perms.length === 0) {
      return this.fullPermission();
    }
    const allowed = perms.filter((p) => p.canImport === true || p.canExport === true);
    if (allowed.length === 0) {
      return {
        canImport: false,
        canExport: false,
        importMode: [],
        importFields: [],
        exportFields: [],
        exportFilter: null,
        uniqueFields: [],
        requiredFields: [],
      };
    }
    const canImport = allowed.some((p) => p.canImport === true);
    const canExport = allowed.some((p) => p.canExport === true);
    const importMode = [
      ...new Set<string>(
        allowed.flatMap((p: any) => (Array.isArray(p.importMode) ? p.importMode : [p.importMode].filter(Boolean))),
      ),
    ];
    const hasFullImport = allowed.some((p) => !p.importFields || p.importFields.length === 0);
    const importFields = hasFullImport ? [] : [...new Set<string>(allowed.flatMap((p: any) => p.importFields || []))];
    const hasFullExport = allowed.some((p) => !p.exportFields || p.exportFields.length === 0);
    const exportFields = hasFullExport ? [] : [...new Set<string>(allowed.flatMap((p: any) => p.exportFields || []))];
    const uniqueFields = [...new Set<string>(allowed.flatMap((p: any) => p.uniqueFields || []))];
    const requiredFields = [...new Set<string>(allowed.flatMap((p: any) => p.requiredFields || []))];
    const hasNoFilter = allowed.some((p) => !p.exportFilter || Object.keys(p.exportFilter).length === 0);
    const exportFilter = hasNoFilter ? null : allowed[0].exportFilter || null;
    return {
      canImport,
      canExport,
      importMode,
      importFields,
      exportFields,
      exportFilter,
      uniqueFields,
      requiredFields,
    };
  }

  async checkPermission(
    currentUserId: number,
    tableName: string,
    actionType: 'import' | 'export',
    permSource?: PermSource | null,
  ): Promise<TablePermission> {
    const roleNames = await this.getUserRoleNames(currentUserId);
    const isAdmin = roleNames.includes('admin') || roleNames.includes('root');

    if (isAdmin) {
      if (permSource && permSource.id) {
        // admin 选择「管理员完整权限」直接放行
        if (permSource.type === 'admin') {
          return this.fullPermission();
        }
        // admin 切换为其他用户/角色时，按该目标的真实权限校验（支持继承）
        if (permSource.type === 'user') {
          const targetPerms = await this.getUserPermissions(Number(permSource.id));
          const allPerms = [...(targetPerms.custom || []), ...(targetPerms.inherited || [])];
          const perm = allPerms.find((p: any) => p.tableName === tableName);
          if (!perm || !perm[actionType === 'import' ? 'canImport' : 'canExport']) {
            throw new Error(
              '所选权限方案没有对数据表「' + tableName + '」的' + (actionType === 'import' ? '导入' : '导出') + '权限',
            );
          }
          return this.permissionFromRecord(perm);
        }
        // admin 切换为角色时，允许 admin/root 系统角色直接放行；其他角色按真实记录校验
        if (permSource.type === 'role' && (permSource.id === 'admin' || permSource.id === 'root')) {
          return this.fullPermission();
        }
        const targetPerm = await this.findPermission(permSource.type, String(permSource.id), tableName);
        if (!targetPerm) {
          throw new Error(
            '所选权限方案没有对数据表「' + tableName + '」的' + (actionType === 'import' ? '导入' : '导出') + '权限',
          );
        }
        const fieldName = actionType === 'import' ? 'canImport' : 'canExport';
        if (!targetPerm[fieldName]) {
          throw new Error(
            '所选权限方案没有对数据表「' + tableName + '」的' + (actionType === 'import' ? '导入' : '导出') + '权限',
          );
        }
        return this.permissionFromRecord(targetPerm);
      }
      return this.fullPermission();
    }

    if (permSource && permSource.id) {
      if (permSource.type === 'user' && String(permSource.id) === String(currentUserId)) {
        // 降级为自身权限查询
      } else {
        const targetPerm = await this.findPermission(
          permSource.type,
          permSource.type === 'user' ? String(permSource.id) : permSource.id,
          tableName,
        );
        if (!targetPerm) {
          throw new Error(
            '所选权限方案没有对数据表「' + tableName + '」的' + (actionType === 'import' ? '导入' : '导出') + '权限',
          );
        }
        const fieldName = actionType === 'import' ? 'canImport' : 'canExport';
        if (!targetPerm[fieldName]) {
          throw new Error(
            '所选权限方案没有对数据表「' + tableName + '」的' + (actionType === 'import' ? '导入' : '导出') + '权限',
          );
        }
        return this.permissionFromRecord(targetPerm);
      }
    }

    const userPerm = await this.findPermission('user', String(currentUserId), tableName);
    if (userPerm) {
      const fieldName = actionType === 'import' ? 'canImport' : 'canExport';
      if (!userPerm[fieldName]) {
        throw new Error(
          '您没有对数据表「' + tableName + '」的' + (actionType === 'import' ? '导入' : '导出') + '权限，请联系管理员',
        );
      }
      return this.permissionFromRecord(userPerm);
    }

    if (roleNames.length > 0) {
      const rolePerms = await this.findPermissionsByRoles(roleNames);
      const filtered = rolePerms.filter((p: any) => p.tableName === tableName);
      const merged = this.mergePermissions(filtered);
      const fieldName = actionType === 'import' ? 'canImport' : 'canExport';
      if (!merged[fieldName]) {
        throw new Error(
          '您的角色没有对数据表「' +
            tableName +
            '」的' +
            (actionType === 'import' ? '导入' : '导出') +
            '权限，请联系管理员',
        );
      }
      return merged;
    }

    throw new Error(
      '您没有对数据表「' + tableName + '」的' + (actionType === 'import' ? '导入' : '导出') + '权限，请联系管理员',
    );
  }

  async getAdminAllPermissions(): Promise<any[]> {
    const tables = this.getAllTableNames();
    return tables.map((name) => ({
      targetType: 'role',
      targetId: 'admin',
      targetName: '管理员',
      tableName: name,
      canImport: true,
      canExport: true,
      importMode: ['insert', 'update', 'upsert'],
      uniqueFields: [],
      requiredFields: [],
      importFields: [],
      exportFields: [],
      _inherited: true,
      _systemManaged: true,
    }));
  }

  async getRolePermissions(roleName: string): Promise<{ custom: any[]; inherited: any[] }> {
    if (roleName === 'admin' || roleName === 'root') {
      const perms = await this.getAdminAllPermissions();
      return {
        custom: [],
        inherited: perms.map((p) => ({
          ...p,
          targetId: roleName,
          targetName: roleName === 'root' ? '超级管理员' : '管理员',
        })),
      };
    }
    const perms = await this.findPermissionsByTarget('role', roleName);
    return { custom: perms, inherited: [] };
  }

  async getUserPermissions(userId: number | string): Promise<{ custom: any[]; inherited: any[] }> {
    const roleNames = await this.getUserRoleNames(userId);
    const uid = String(userId);

    if (roleNames.includes('admin') || roleNames.includes('root')) {
      const tables = this.getAllTableNames();
      const roleName = roleNames.includes('root') ? 'root' : 'admin';
      const inherited = tables.map((name) => ({
        targetType: 'role',
        targetId: roleName,
        targetName: roleName === 'root' ? '超级管理员' : '管理员',
        tableName: name,
        canImport: true,
        canExport: true,
        importMode: ['insert', 'update', 'upsert'],
        uniqueFields: [],
        requiredFields: [],
        importFields: [],
        exportFields: [],
        exportFilter: null,
        _inherited: true,
        _systemManaged: true,
      }));
      const custom = await this.findPermissionsByTarget('user', uid);
      return { custom, inherited };
    }

    let inherited: any[] = [];
    if (roleNames.length > 0) {
      const rolePerms = await this.findPermissionsByRoles(roleNames);
      inherited = rolePerms.map((p) => ({ ...p, _inherited: true }));
    }
    const custom = await this.findPermissionsByTarget('user', uid);
    return { custom, inherited };
  }

  async getExportScopes(
    currentUserId: number,
    tableName: string,
    permSource?: PermSource | null,
  ): Promise<
    { type: string; id: string; label: string; canExport: boolean; exportFilter: Record<string, unknown> | null }[]
  > {
    const effectiveUserId = permSource?.type === 'user' && permSource.id ? Number(permSource.id) : currentUserId;
    const roleNames = await this.getUserRoleNames(effectiveUserId);
    const isAdmin = roleNames.includes('admin') || roleNames.includes('root');
    const result: {
      type: string;
      id: string;
      label: string;
      canExport: boolean;
      exportFilter: Record<string, unknown> | null;
    }[] = [];

    const userPerm = await this.findPermission('user', String(effectiveUserId), tableName);
    if (userPerm || isAdmin) {
      result.push({
        type: 'user',
        id: String(effectiveUserId),
        label: '当前用户',
        canExport: userPerm ? userPerm.canExport === true : true,
        exportFilter: userPerm ? userPerm.exportFilter || null : null,
      });
    }

    if (roleNames.length > 0) {
      const rolePerms = await this.findPermissionsByRoles(roleNames);
      const roleRecords = rolePerms.filter((p: any) => p.tableName === tableName);
      const roleNameSet = new Set(roleNames);
      for (const rName of roleNameSet) {
        const perm = roleRecords.find((p: any) => p.targetId === rName);
        if (perm || isAdmin) {
          result.push({
            type: 'role',
            id: rName,
            label: rName,
            canExport: perm ? perm.canExport === true : true,
            exportFilter: perm ? perm.exportFilter || null : null,
          });
        }
      }
    }

    if (isAdmin) {
      result.unshift({
        type: 'admin',
        id: 'admin',
        label: '管理员完整权限',
        canExport: true,
        exportFilter: null,
      });
    }

    return result.filter((item) => item.canExport);
  }

  private getAllTableNames(): string[] {
    const names: string[] = [];
    try {
      const dbCollections = this.db.collections;
      if (dbCollections instanceof Map) {
        for (const [name, coll] of dbCollections) {
          try {
            const isThrough = (coll as any).isThrough ? (coll as any).isThrough() : false;
            if (!isThrough) names.push(name);
          } catch {
            names.push(name);
          }
        }
      }
    } catch {
      // ignore
    }
    return names;
  }
}
