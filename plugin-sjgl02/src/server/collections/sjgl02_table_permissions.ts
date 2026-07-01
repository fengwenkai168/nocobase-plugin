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
    { type: 'json', name: 'importMode', defaultValue: ['insert', 'update', 'upsert'] },
    { type: 'json', name: 'uniqueFields' },
    { type: 'json', name: 'requiredFields' },
    { type: 'json', name: 'importFields' },
    { type: 'json', name: 'exportFields' },
    { type: 'json', name: 'exportFilter' },
    {
      type: 'json',
      name: 'permissions',
      description: '扩展权限 JSON（未来替代分散的布尔字段）',
    },
    {
      type: 'integer',
      name: 'priority',
      defaultValue: 0,
      description: '优先级（用户级 > 角色级继承，数值越大优先级越高）',
    },
    {
      type: 'belongsTo',
      name: 'createdBy',
      target: 'users',
      foreignKey: 'createdById',
      description: '权限创建人',
    },
    {
      type: 'date',
      name: 'createdAt',
    },
    {
      type: 'date',
      name: 'updatedAt',
    },
  ],
  autoGenId: true,
  timestamps: true,
  indexes: [
    {
      type: 'UNIQUE',
      fields: ['targetType', 'targetId', 'tableName'],
      name: 'sjgl02_perms_unique_target_table',
    },
  ],
});
