import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'afterSync';

  async up() {
    const { db } = this.context;
    const qi = db.sequelize.getQueryInterface();

    try {
      await qi.sequelize.query(`
        UPDATE sjgl02_tasks
        SET file_name = (
          SELECT filename
          FROM attachments
          WHERE attachments.id = sjgl02_tasks."importFileId"
          LIMIT 1
        )
        WHERE file_name IS NULL AND "importFileId" IS NOT NULL
      `);
    } catch {}

    try {
      await qi.sequelize.query(`
        UPDATE sjgl02_tasks
        SET file_name = (
          SELECT filename
          FROM attachments
          WHERE attachments.id = sjgl02_tasks."exportFileId"
          LIMIT 1
        )
        WHERE (file_name IS NULL OR file_name = '')
        AND "exportFileId" IS NOT NULL
      `);
    } catch {}
  }
}
