import { Plugin } from '@nocobase/server';
import fs from 'fs';
import {
  getTableFields,
  uploadParse,
  preview,
  executeImport,
} from './actions/import';
import {
  getExportTableFields,
  previewCount,
  executeExport,
  getProgress,
  downloadExport,
} from './actions/export';
import {
  listTasks,
  getTaskDetail,
  cancelTask,
} from './actions/tasks';
import {
  getUserRoleList,
  getTables,
  getPermissions,
  savePermissions,
  getSettings,
  saveSettings,
} from './actions/permissions';
import {
  listTaskLogs,
} from './actions/taskLogs';

export class PluginSjgl02Server extends Plugin {
  async load() {
    this.defineCustomResources();
    this.setupACL();
    setImmediate(() => this.startupCleanup());
  }

  /** 启动清理：残留任务、影子表、导出文件 */
  private async startupCleanup() {
    try {
      const sequelize = this.db.sequelize;

      // 1. 清理残留任务（5 分钟窗口）
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      await this.db.getRepository('sjgl02_tasks').update({
        filter: {
          status: { $in: ['processing', 'pending'] },
          createdAt: { $lt: fiveMinAgo },
        },
        values: {
          status: 'failed',
          errorMessage: '服务器重启，任务中断',
          completedAt: new Date(),
        },
      });

      // 2. 清理残留影子表
      const [shadowTables] = await sequelize.query(
        `SELECT tablename FROM pg_tables WHERE tablename LIKE '_sjgl02_import_%' AND schemaname = current_schema()`,
        { raw: true },
      );
      for (const row of (shadowTables as any[])) {
        try {
          await sequelize.query(`DROP TABLE IF EXISTS "${row.tablename}"`);
        } catch {}
      }

      // 3. 清理残留导出文件
      const storageDir = process.env.LOCAL_STORAGE_BASE_URL || process.env.STORAGE_DIR || 'storage/uploads';
      const exportDir = storageDir + '/exports';
      if (fs.existsSync(exportDir)) {
        const files = fs.readdirSync(exportDir);
        for (const file of files) {
          if (file.startsWith('sjgl02_export_')) {
            try { fs.unlinkSync(exportDir + '/' + file); } catch {}
          }
        }
      }
    } catch {}
  }

  private defineCustomResources() {
    this.app.resourceManager.define({
      name: 'sjgl02Import',
      actions: {
        tableFields: getTableFields,
        uploadParse,
        preview,
        execute: executeImport,
      },
    });

    this.app.resourceManager.define({
      name: 'sjgl02Export',
      actions: {
        tableFields: getExportTableFields,
        previewCount,
        execute: executeExport,
        progress: getProgress,
        download: downloadExport,
      },
    });

    this.app.resourceManager.define({
      name: 'sjgl02Tasks',
      actions: {
        list: listTasks,
        detail: getTaskDetail,
        cancel: cancelTask,
      },
    });

    this.app.resourceManager.define({
      name: 'sjgl02Permissions',
      actions: {
        userRoleList: getUserRoleList,
        tables: getTables,
        get: getPermissions,
        save: savePermissions,
        settings: getSettings,
        saveSettings,
      },
    });

    this.app.resourceManager.define({
      name: 'sjgl02TaskLogs',
      actions: {
        list: listTaskLogs,
      },
    });
  }

  private setupACL() {
    const acl = this.app.acl;
    acl.allow('sjgl02Import', '*', 'loggedIn');
    acl.allow('sjgl02Export', '*', 'loggedIn');
    acl.allow('sjgl02Tasks', '*', 'loggedIn');
    acl.allow('sjgl02Permissions', '*', 'loggedIn');
    acl.allow('sjgl02_tasks', '*', 'loggedIn');
    acl.allow('sjgl02_table_permissions', '*', 'loggedIn');
    acl.allow('sjgl02_settings', '*', 'loggedIn');
    acl.allow('sjgl02_permission_logs', '*', 'loggedIn');
    acl.allow('sjgl02TaskLogs', '*', 'loggedIn');
    acl.allow('sjgl02_task_logs', '*', 'loggedIn');
  }

  async install() {
    const settingRepo = this.db.getRepository('sjgl02_settings');
    const existing = await settingRepo.count();
    if (existing === 0) {
      await settingRepo.create({
        values: {
          taskViewScope: 'own',
          maxFileSize: 50,
          batchSize: 1000,
        },
      });
    }

    const permRepo = this.db.getRepository('sjgl02_table_permissions');
    const permCount = await permRepo.count();
    if (permCount === 0) {
      const roleRepo = this.db.getRepository('roles');
      const adminRole = await roleRepo.findOne({ filter: { name: 'admin' } });
      const rootRole = await roleRepo.findOne({ filter: { name: 'root' } });
      const roleIds: string[] = [];
      if (adminRole) roleIds.push(adminRole.name);
      if (rootRole) roleIds.push(rootRole.name);
      if (roleIds.length === 0) return;
      const tables = this.db.collections;
      const tablePermissions: any[] = [];
      for (const [name] of tables) {
        for (const roleId of roleIds) {
          tablePermissions.push({
            targetType: 'role',
            targetId: roleId,
            targetName: roleId === 'admin' ? '管理员' : '超级管理员',
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
      if (tablePermissions.length > 0) {
        await Promise.all(tablePermissions.map(perm => permRepo.create({ values: perm })));
      }
    }
  }
}

export default PluginSjgl02Server;
