import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'beforeLoad';

  async up() {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    if (tables.includes('sjgl02_table_permissions')) {
      const columns = await queryInterface.describeTable('sjgl02_table_permissions');
      if (columns.exportFilter) {
        await queryInterface.removeColumn('sjgl02_table_permissions', 'exportFilter');
      }
    }

    if (tables.includes('sjgl02_tasks')) {
      const columns = await queryInterface.describeTable('sjgl02_tasks');
      if (columns.exportFilter) {
        await queryInterface.removeColumn('sjgl02_tasks', 'exportFilter');
      }
    }
  }

  async down() {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    if (tables.includes('sjgl02_table_permissions')) {
      const columns = await queryInterface.describeTable('sjgl02_table_permissions');
      if (!columns.exportFilter) {
        await queryInterface.addColumn('sjgl02_table_permissions', 'exportFilter', { type: 'JSONB' });
      }
    }

    if (tables.includes('sjgl02_tasks')) {
      const columns = await queryInterface.describeTable('sjgl02_tasks');
      if (!columns.exportFilter) {
        await queryInterface.addColumn('sjgl02_tasks', 'exportFilter', { type: 'JSONB' });
      }
    }
  }
}
