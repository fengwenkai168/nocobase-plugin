import { Plugin } from '@nocobase/server';
import {
  getTableFields,
  uploadFile,
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
  getTaskLogs,
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

export class PluginSjgl02Server extends Plugin {
  async load() {
    this.defineCustomResources();
    this.setupACL();
  }

  private defineCustomResources() {
    this.app.resourceManager.define({
      name: 'sjgl02Import',
      actions: {
        tableFields: getTableFields,
        upload: uploadFile,
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
        logs: getTaskLogs,
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
  }
}

export default PluginSjgl02Server;
