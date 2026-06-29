import { Plugin } from '@nocobase/server';
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
          taskViewScope: 'all',
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
        if (name.startsWith('sjgl02_')) continue;
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
          re