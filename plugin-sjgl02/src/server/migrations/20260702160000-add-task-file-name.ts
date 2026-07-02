import { Migration } from '@nocobase/server';
import { DataTypes } from '@nocobase/database';

export default class extends Migration {
  on = 'beforeLoad';

  async up() {
    const tableExists = await this.db.sequelize
      .getQueryInterface()
      .showAllTables()
      .then((tables: string[]) => tables.includes('sjgl02_tasks'));
    if (!tableExists) return;

    const columns = await this.db.sequelize.getQueryInterface().describeTable('sjgl02_tasks');
    if (!columns.file_name) {
      await this.db.sequelize
        .getQueryInterface()
        .addColumn('sjgl02_tasks', 'file_name', { type: DataTypes.STRING(255) });
    }
  }
}
