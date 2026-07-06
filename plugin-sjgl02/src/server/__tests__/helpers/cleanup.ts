import { MockServer } from '@nocobase/test';

/**
 * 清理测试产生的业务数据
 */
export async function cleanupBusinessData(app: MockServer) {
  const db = app.db;
  const repos = ['sjgl02_tasks', 'sjgl02_task_logs', 'sjgl02_table_permissions', 'sjgl02_permission_logs'];

  for (const name of repos) {
    try {
      await db.getRepository(name).destroy({ filter: {} });
    } catch {
      // ignore
    }
  }
}

/**
 * 清理测试目标表数据
 */
export async function cleanupTargetTable(app: MockServer, tableName: string) {
  try {
    await app.db.getRepository(tableName).destroy({ filter: {} });
  } catch {
    // ignore
  }
}

/**
 * 清理导入产生的影子表
 */
export async function cleanupShadowTables(app: MockServer) {
  try {
    const [rows] = await app.db.sequelize.query(
      "SELECT tablename FROM pg_tables WHERE tablename LIKE '_sjgl02\\_import\\_%' ESCAPE '\\' AND schemaname = current_schema()",
      { raw: true },
    );

    for (const row of rows as any[]) {
      try {
        const quoted = '"' + String(row.tablename).replace(/"/g, '""') + '"';
        await app.db.sequelize.query('DROP TABLE IF EXISTS ' + quoted + ' CASCADE');
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

/**
 * 清理临时导出文件
 */
export function cleanupExportFiles() {
  const exportDir = '/tmp/sjgl02-test-exports';
  try {
    if (fs.existsSync(exportDir)) {
      const files = fs.readdirSync(exportDir);
      for (const file of files) {
        if (file.startsWith('sjgl02_export_')) {
          try {
            fs.unlinkSync(path.join(exportDir, file));
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // ignore
  }
}

import * as fs from 'fs';
import * as path from 'path';
