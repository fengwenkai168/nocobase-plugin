import { cancelFlags } from './cancel-state';
import { writeTaskLog } from './taskLogs';
import { quoteIdentifier } from './import-utils';
import type { Database } from '@nocobase/database';

function buildRecordFromShadow(
  row: any,
  dataColumns: string[],
  pkColumns: string[],
  mapping: Record<string, string>,
  allColumns: string[],
  userId: number | null,
): Record<string, any> {
  const rec: Record<string, any> = {};
  for (const col of dataColumns) {
    rec[col] = row[col];
  }
  for (const pk of pkColumns) {
    if (!mapping[pk] || mapping[pk] === '__ignore__') {
      delete rec[pk];
    } else if (rec[pk] === null || rec[pk] === '' || rec[pk] === undefined) {
      delete rec[pk];
    }
  }
  const now = new Date().toISOString();
  if (allColumns.includes('createdById') && !dataColumns.includes('createdById') && userId != null) {
    rec.createdById = userId;
  }
  if (allColumns.includes('updatedById') && !dataColumns.includes('updatedById') && userId != null) {
    rec.updatedById = userId;
  }
  if (allColumns.includes('createdAt') && !dataColumns.includes('createdAt')) {
    rec.createdAt = now;
  }
  if (allColumns.includes('updatedAt') && !dataColumns.includes('updatedAt')) {
    rec.updatedAt = now;
  }
  return rec;
}

async function fixCreatedSystemFields(
  instances: any[],
  sourceRows: any[],
  options: { transaction: any },
  sequelize: any,
  dataColumns: string[],
  allColumns: string[],
  pkColumns: string[],
  userId: number | null,
  targetTableName: string,
): Promise<void> {
  if (instances.length === 0 || sourceRows.length === 0) return;
  const sysFields: string[] = [];
  if (allColumns.includes('createdById')) sysFields.push('createdById');
  if (allColumns.includes('updatedById')) sysFields.push('updatedById');
  if (allColumns.includes('createdAt')) sysFields.push('createdAt');
  if (allColumns.includes('updatedAt')) sysFields.push('updatedAt');
  if (sysFields.length === 0) return;

  const pkAttr = pkColumns[0] || 'id';
  const valueRows: string[] = [];
  const replacements: Record<string, any> = {};
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const row = sourceRows[i];
    const id = inst.get(pkAttr);
    const placeholders: string[] = [`:id${i}`];
    for (const f of sysFields) {
      const key = `${f}${i}`;
      placeholders.push(`:${key}`);
    }
    valueRows.push(`(${placeholders.join(', ')})`);
    replacements[`id${i}`] = id;
    for (const f of sysFields) {
      const key = `${f}${i}`;
      if (f === 'createdById') replacements[key] = dataColumns.includes('createdById') ? row.createdById : userId;
      if (f === 'updatedById') replacements[key] = dataColumns.includes('updatedById') ? row.updatedById : userId;
      if (f === 'createdAt') replacements[key] = dataColumns.includes('createdAt') ? row.createdAt : null;
      if (f === 'updatedAt') replacements[key] = dataColumns.includes('updatedAt') ? row.updatedAt : null;
    }
  }

  const setClauses: string[] = [];
  if (allColumns.includes('createdById')) {
    setClauses.push(`${quoteIdentifier('createdById')} = v.${quoteIdentifier('createdById')}::bigint`);
  }
  if (allColumns.includes('updatedById')) {
    setClauses.push(`${quoteIdentifier('updatedById')} = v.${quoteIdentifier('updatedById')}::bigint`);
  }
  if (allColumns.includes('createdAt')) {
    setClauses.push(
      `${quoteIdentifier('createdAt')} = COALESCE(v.${quoteIdentifier(
        'createdAt',
      )}::timestamp with time zone, m.${quoteIdentifier('createdAt')})`,
    );
  }
  if (allColumns.includes('updatedAt')) {
    setClauses.push(
      `${quoteIdentifier('updatedAt')} = COALESCE(v.${quoteIdentifier(
        'updatedAt',
      )}::timestamp with time zone, m.${quoteIdentifier('updatedAt')})`,
    );
  }

  const sql = `
    UPDATE ${quoteIdentifier(targetTableName)} AS m
    SET ${setClauses.join(', ')}
    FROM (VALUES ${valueRows.join(', ')})
    AS v(${quoteIdentifier(pkAttr)}, ${sysFields.map((f) => quoteIdentifier(f)).join(', ')})
    WHERE m.${quoteIdentifier(pkAttr)} = v.${quoteIdentifier(pkAttr)}
  `;
  await sequelize.query(sql, { replacements, transaction: options.transaction });
}

async function readShadowBatch(
  sequelize: any,
  dataColumns: string[],
  quotedShadow: string,
  lastRowId: number,
  transaction: any,
): Promise<any[]> {
  const PHASE3_BATCH_SIZE = 5000;
  const [rows] = await sequelize.query(
    'SELECT ' +
      dataColumns.map((c) => quoteIdentifier(c)).join(', ') +
      ', __import_row_id__ ' +
      'FROM ' +
      quotedShadow +
      ' WHERE __import_row_id__ > :lastRowId ORDER BY __import_row_id__ LIMIT :limit',
    { replacements: { lastRowId, limit: PHASE3_BATCH_SIZE }, raw: true, transaction },
  );
  return rows as any[];
}

async function checkPkConflicts(
  sequelize: any,
  mapping: Record<string, string>,
  pkColumns: string[],
  quotedMain: string,
  quotedShadow: string,
  transaction: any,
): Promise<void> {
  const mappedPkColumns = pkColumns.filter((pk) => mapping[pk] && mapping[pk] !== '__ignore__');
  if (mappedPkColumns.length === 0) return;
  const pkNullChecks = mappedPkColumns.map((pk) => 's.' + quoteIdentifier(pk) + ' IS NOT NULL').join(' AND ');
  const pkMatchChecks = mappedPkColumns
    .map((pk) => 'm.' + quoteIdentifier(pk) + ' = s.' + quoteIdentifier(pk))
    .join(' AND ');
  const [conflicts] = await sequelize.query(
    'SELECT ' +
      mappedPkColumns.map((c) => 'm.' + quoteIdentifier(c)).join(', ') +
      ' FROM ' +
      quotedMain +
      ' m WHERE EXISTS (' +
      'SELECT 1 FROM ' +
      quotedShadow +
      ' s WHERE ' +
      pkMatchChecks +
      ' AND ' +
      pkNullChecks +
      ') LIMIT 1',
    { raw: true, transaction },
  );
  if ((conflicts as any[]).length > 0) {
    const sample = (conflicts as any[])[0];
    const sampleKey = mappedPkColumns.map((pk) => pk + '=' + sample[pk]).join(', ');
    throw new Error('主键值与数据库已有记录冲突（' + sampleKey + '）');
  }
}

async function phase3UpdateMode(
  db: Database,
  taskId: number,
  mapping: Record<string, string>,
  bCellMode: string,
  uFields: string[],
  pkColumns: string[],
  allColumns: string[],
  dataColumns: string[],
  quotedMain: string,
  quotedShadow: string,
  transaction: any,
  phase2TotalRows: number,
  userId: number | null,
): Promise<{ processedCount: number; updatedCount: number }> {
  const repo = db.getRepository('sjgl02_tasks');
  const sequelize = db.sequelize;

  const setCols = dataColumns.filter((c) => !pkColumns.includes(c));
  const setClauses: string[] = [];
  for (const col of setCols) {
    if (bCellMode === 'skip') {
      setClauses.push(
        quoteIdentifier(col) + ' = COALESCE(s.' + quoteIdentifier(col) + ', m.' + quoteIdentifier(col) + ')',
      );
    } else {
      setClauses.push(quoteIdentifier(col) + ' = s.' + quoteIdentifier(col));
    }
  }
  for (const f of ['updatedAt', 'updatedById']) {
    if (allColumns.includes(f) && !dataColumns.includes(f)) {
      setClauses.push(
        quoteIdentifier(f) +
          ' = ' +
          (f === 'updatedAt' ? 'NOW()' : (userId != null ? String(userId) : 'NULL') + '::bigint'),
      );
    }
  }
  const whereClauses = uFields.map((uf) => 'm.' + quoteIdentifier(uf) + ' = s.' + quoteIdentifier(uf)).join(' AND ');
  if (setClauses.length === 0 || !whereClauses) {
    throw new Error('更新模式缺少可更新字段或唯一值字段');
  }

  let processedCount = 0;
  let updatedCount = 0;
  let lastRowId = 0;
  let batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);

  while (batchRows.length > 0) {
    if (cancelFlags.has(taskId)) throw new Error('任务已取消');
    const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;

    const [result] = await sequelize.query(
      'UPDATE ' +
        quotedMain +
        ' m SET ' +
        setClauses.join(', ') +
        ' FROM ' +
        quotedShadow +
        ' s' +
        ' WHERE ' +
        whereClauses +
        ' AND s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId' +
        ' RETURNING m.id',
      { replacements: { lastRowId, maxRowId }, transaction },
    );
    updatedCount += (result as any[]).length;
    processedCount += batchRows.length;
    lastRowId = maxRowId;

    const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
    try {
      await repo.update({
        filterByTk: taskId,
        values: { progress: Math.min(98, prog), processedRows: processedCount },
      });
    } catch {
      /* 忽略 */
    }
    batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  }

  return { processedCount, updatedCount };
}

async function phase3InsertMode(
  db: Database,
  taskId: number,
  mapping: Record<string, string>,
  uFields: string[],
  coll: any,
  pkColumns: string[],
  allColumns: string[],
  dataColumns: string[],
  quotedMain: string,
  quotedShadow: string,
  transaction: any,
  phase2TotalRows: number,
  userId: number | null,
): Promise<{ processedCount: number; updatedCount: number }> {
  const repo = db.getRepository('sjgl02_tasks');
  const sequelize = db.sequelize;
  const targetRepo = db.getRepository(coll.name);

  await checkPkConflicts(sequelize, mapping, pkColumns, quotedMain, quotedShadow, transaction);

  let processedCount = 0;
  let lastRowId = 0;
  let batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);

  while (batchRows.length > 0) {
    if (cancelFlags.has(taskId)) throw new Error('任务已取消');
    const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;

    const records = batchRows.map((row) =>
      buildRecordFromShadow(row, dataColumns, pkColumns, mapping, allColumns, userId),
    );
    const instances = await targetRepo.create({
      values: records,
      transaction,
      context: { state: { currentUser: { id: userId } } },
    } as any);
    await fixCreatedSystemFields(
      instances,
      batchRows,
      { transaction },
      sequelize,
      dataColumns,
      allColumns,
      pkColumns,
      userId,
      coll.name,
    );
    processedCount += batchRows.length;

    lastRowId = maxRowId;
    const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
    try {
      await repo.update({
        filterByTk: taskId,
        values: { progress: Math.min(98, prog), processedRows: processedCount },
      });
    } catch {
      /* 忽略 */
    }
    batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  }

  return { processedCount, updatedCount: 0 };
}

async function phase3UpsertMode(
  db: Database,
  taskId: number,
  mapping: Record<string, string>,
  bCellMode: string,
  uFields: string[],
  coll: any,
  pkColumns: string[],
  allColumns: string[],
  dataColumns: string[],
  quotedMain: string,
  quotedShadow: string,
  transaction: any,
  phase2TotalRows: number,
  userId: number | null,
): Promise<{ processedCount: number; updatedCount: number }> {
  const repo = db.getRepository('sjgl02_tasks');
  const sequelize = db.sequelize;
  const targetRepo = db.getRepository(coll.name);

  let processedCount = 0;
  let updatedCount = 0;
  let lastRowId = 0;
  let batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);

  while (batchRows.length > 0) {
    if (cancelFlags.has(taskId)) throw new Error('任务已取消');
    const maxRowId = batchRows[batchRows.length - 1].__import_row_id__;

    const setCols = dataColumns.filter((c) => !uFields.includes(c) && !pkColumns.includes(c));
    const setClauses: string[] = [];
    for (const col of setCols) {
      if (bCellMode === 'skip') {
        setClauses.push(
          quoteIdentifier(col) + ' = COALESCE(s.' + quoteIdentifier(col) + ', m.' + quoteIdentifier(col) + ')',
        );
      } else {
        setClauses.push(quoteIdentifier(col) + ' = s.' + quoteIdentifier(col));
      }
    }
    for (const f of ['updatedAt', 'updatedById']) {
      if (allColumns.includes(f) && !dataColumns.includes(f)) {
        setClauses.push(
          quoteIdentifier(f) +
            ' = ' +
            (f === 'updatedAt' ? 'NOW()' : (userId != null ? String(userId) : 'NULL') + '::bigint'),
        );
      }
    }
    const whereClauses = uFields.map((uf) => 'm.' + quoteIdentifier(uf) + ' = s.' + quoteIdentifier(uf)).join(' AND ');
    if (uFields.length > 0 && setClauses.length > 0) {
      const [updateResult] = await sequelize.query(
        'UPDATE ' +
          quotedMain +
          ' m SET ' +
          setClauses.join(', ') +
          ' FROM ' +
          quotedShadow +
          ' s' +
          ' WHERE ' +
          whereClauses +
          ' AND s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId' +
          ' RETURNING m.id',
        { replacements: { lastRowId, maxRowId }, transaction },
      );
      updatedCount += (updateResult as any[]).length;
    }

    const [newRows] = await sequelize.query(
      'SELECT s.* FROM ' +
        quotedShadow +
        ' s' +
        ' WHERE s.__import_row_id__ > :lastRowId AND s.__import_row_id__ <= :maxRowId' +
        (uFields.length > 0
          ? ' AND NOT EXISTS (SELECT 1 FROM ' +
            quotedMain +
            ' m WHERE ' +
            uFields.map((uf) => 'm.' + quoteIdentifier(uf) + ' = s.' + quoteIdentifier(uf)).join(' AND ') +
            ')'
          : ''),
      { replacements: { lastRowId, maxRowId }, raw: true, transaction },
    );
    const records = (newRows as any[]).map((row) =>
      buildRecordFromShadow(row, dataColumns, pkColumns, mapping, allColumns, userId),
    );
    if (records.length > 0) {
      const instances = await targetRepo.create({
        values: records,
        transaction,
        context: { state: { currentUser: { id: userId } } },
      } as any);
      await fixCreatedSystemFields(
        instances,
        newRows,
        { transaction },
        sequelize,
        dataColumns,
        allColumns,
        pkColumns,
        userId,
        coll.name,
      );
    }
    processedCount += batchRows.length;

    lastRowId = maxRowId;
    const prog = 90 + Math.floor(Math.min(processedCount / Math.max(phase2TotalRows, 1), 1) * 8);
    try {
      await repo.update({
        filterByTk: taskId,
        values: { progress: Math.min(98, prog), processedRows: processedCount },
      });
    } catch {
      /* 忽略 */
    }
    batchRows = await readShadowBatch(sequelize, dataColumns, quotedShadow, lastRowId, transaction);
  }

  return { processedCount, updatedCount };
}

export async function phase3Migrate(
  db: Database,
  taskId: number,
  mapping: Record<string, string>,
  bCellMode: string,
  mode: string,
  uFields: string[],
  coll: any,
  pkColumns: string[],
  allColumns: string[],
  dataColumns: string[],
  shadowTableName: string,
  quotedMain: string,
  quotedShadow: string,
  transaction: any,
  phase2TotalRows: number,
  userId: number | null,
): Promise<void> {
  const repo = db.getRepository('sjgl02_tasks');
  const sequelize = db.sequelize;
  await writeTaskLog(db, taskId, 'INFO', '阶段三：原子迁移开始...');
  try {
    await sequelize.query("SET LOCAL statement_timeout = '30min'", { transaction });
  } catch {
    /* 忽略 */
  }

  let processedCount = 0;
  let updatedCount = 0;

  if (mode === 'update') {
    const result = await phase3UpdateMode(
      db,
      taskId,
      mapping,
      bCellMode,
      uFields,
      pkColumns,
      allColumns,
      dataColumns,
      quotedMain,
      quotedShadow,
      transaction,
      phase2TotalRows,
      userId,
    );
    processedCount = result.processedCount;
    updatedCount = result.updatedCount;
  } else if (mode === 'upsert') {
    const result = await phase3UpsertMode(
      db,
      taskId,
      mapping,
      bCellMode,
      uFields,
      coll,
      pkColumns,
      allColumns,
      dataColumns,
      quotedMain,
      quotedShadow,
      transaction,
      phase2TotalRows,
      userId,
    );
    processedCount = result.processedCount;
    updatedCount = result.updatedCount;
  } else {
    const result = await phase3InsertMode(
      db,
      taskId,
      mapping,
      uFields,
      coll,
      pkColumns,
      allColumns,
      dataColumns,
      quotedMain,
      quotedShadow,
      transaction,
      phase2TotalRows,
      userId,
    );
    processedCount = result.processedCount;
    updatedCount = result.updatedCount;
  }

  await sequelize.query('DROP TABLE IF EXISTS ' + quotedShadow, { transaction });

  const successMsg =
    mode === 'update'
      ? '迁移完成，更新 ' + updatedCount + ' 行，影子表已删除'
      : mode === 'upsert'
        ? '迁移完成，更新 ' + updatedCount + ' 行，新增 ' + (processedCount - updatedCount) + ' 行，影子表已删除'
        : '迁移完成，共 ' + processedCount + ' 行，影子表已删除';

  await writeTaskLog(db, taskId, 'SUCC', successMsg);
  await repo.update({
    filterByTk: taskId,
    values: { status: 'completed', progress: 100, processedRows: processedCount, completedAt: new Date() },
  });
}
