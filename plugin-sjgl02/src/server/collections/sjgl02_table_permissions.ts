import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02_table_permissions',
  title: '表级权限配置',
  fields: [
    {
      type: 'string',
      name: 'targetType',
    },
    {
      type: 'integer',
      name: 'targetId',
    },
    {
      type: 'string',
      name: 'targetName',
    },
    {
      type: 'string',
      name: 'tableName',
    },
    {
      type: 'boolean',
      name: 'canImport',
      defaultValue: false,
    },
    {
      type: 'boolean',
      name: 'canExport',
      defaultValue: false,
    },
    {
      type: 'string',
      name: 'importMode',
      defaultValue: 'insert',
    },
    {
      type: 'json',
      name: 'uniqueFields',
    },
    {
      type: 'json',
      name: 'requiredFields',
    },
    {
      type: 'json',
      name: 'importFields',
    },
    {
      type: 'json',
      name: 'exportFields',
    },
    {
      type: 'json',
      name: 'exportFilter',
    },
  ],
});
