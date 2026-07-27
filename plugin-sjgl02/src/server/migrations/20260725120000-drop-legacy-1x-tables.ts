import { Migration } from '@nocobase/server';

// 1.0.x 旧版插件使用的蛇形表（2.0.x 已改为驼峰命名）。
// 这些旧表的索引名（如 sjgl02_permissions_created_by_id）与新版集合 sync 自动生成的索引同名，
// 已通过集合定义中预声明自定义索引名规避冲突；sync 完成后在此删除旧表（不迁移数据）。
const LEGACY_TABLES = [
  'sjgl02_permissions',
  'sjgl02_permission_logs',
  'sjgl02_settings',
  'sjgl02_task_files',
  'sjgl02_task_logs',
  'sjgl02_tasks',
];

// 已被自定义命名索引替代的旧默认索引名（2.0.x 老库升级后清理重复索引；
// 1.0.x 老库中这些索引属于旧表，已随 DROP TABLE CASCADE 删除，此处 DROP IF EXISTS 为 no-op）
const REPLACED_INDEXES = [
  'sjgl02_permissions_created_by_id',
  'sjgl02_permissions_updated_by_id',
  'sjgl02_permissions_collection_name',
  'sjgl02_permission_logs_created_by_id',
  'sjgl02_permission_logs_action',
  'sjgl02_permission_logs_target_id',
  'sjgl02_permission_logs_collection_name',
  'sjgl02_tasks_created_by_id',
  'sjgl02_tasks_status',
  'sjgl02_tasks_collection_name',
];

export default class extends Migration {
  on = 'afterSync';

  async up() {
    const tables = await this.queryInterface.showAllTables();
    const existing = LEGACY_TABLES.filter((t) => tables.includes(t));
    if (existing.length) {
      this.app.log.info(`[sjgl02] 检测到 1.0.x 旧版残留表，强制删除（不迁移数据）: ${existing.join(', ')}`);
      for (const table of existing) {
        await this.sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        this.app.log.info(`[sjgl02] 已删除旧表 ${table}`);
      }
    }
    for (const index of REPLACED_INDEXES) {
      await this.sequelize.query(`DROP INDEX IF EXISTS "${index}"`);
    }
  }
}
