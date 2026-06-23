import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02_table_permissions',
  title: '表级权限配置',
  fields: [
    {
      interface: 'select',
      type: 'string',
      name: 'targetType',
      uiSchema: { enum: [{ value: 'user', label: '用户' }, { value: 'role', label: '角色' }] },
    },
    { type: 'string', name: 'targetId' },
    { type: 'string', name: 'targetName' },
    { type: 'string', name: 'tableName' },
    { type: 'boolean', name: 'canImport', defaultValue: false },
    { type: 'boolean', name: 'canExport', defaultValue: false },
    {
      interface: 'select',
      type: 'string',
      name: 'importMode',
      defaultValue: 'insert',
      uiSchema: { enum: [
        { value: 'insert', label: '新增' },
        { value: 'update', label: '更新' },
        { value: 'upsert', label: '新增+更新' },
      ]},
    },
    { type: 'json', name: 'uniqueFields' },
    { type: 'json', name: 'required