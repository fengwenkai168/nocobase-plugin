import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02_tasks',
  title: '导入导出任务',
  fields: [
    {
      type: 'string',
      name: 'taskType',
      defaultValue: 'import',
    },
    {
      type: 'string',
      name: 'tableName',
    },
    {
      type: 'string',
      name: 'status',
      defaultValue: 'pending',
    },
    {
      type: 'json',
      name: 'fieldMapping',
    },
    {
      type: 'json',
      name: 'selectedFields',
    },
    {
      type: 'json',
      name: 'exportFilter',
    },
    {
      type: 'json',
      name: 'errorLogs',
    },
    {
      type: 'integer',
      name: 'progress',
      defaultValue: 0,
    },
    {
      type: 'integer',
      name: 'totalRows',
      defaultValue: 0,
    },
    {
      type: 'integer',
      name: 'processedRows',
      defaultValue: 0,
    },
    {
      type: 'string',
      name: 'importMode',
      defaultValue: 'insert',
    },
    {
      type: 'string',
      name: 'sheetName',
    },
    {
      type: 'integer',
      name: 'headerRow',
      defaultValue: 1,
    },
    {
      type: 'integer',
      name: 'importFileId',
    },
    {
      type: 'integer',
      name: 'exportFileId',
    },
    {
      type: 'text',
      name: 'errorMessage',
    },
    {
      type: 'boolean',
      name: 'includeAssociationSheet',
      defaultValue: false,
    },
    {
      type: 'json',
      name: 'associationSheetTables',
    },
    {
      type: 'json',
      name: 'associationDisplayMode',
    },
    {
      type: 'date',
      name: 'completedAt',
    },
    {
      type: 'belongsTo',
      name: 'createdBy',
      target: 'users',
      foreignKey: 'createdById',
    },
  ],
});
