import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02_permission_logs',
  title: '权限操作日志',
  fields: [
    { type: 'string', name: 'action', interface: 'select', uiSchema: { enum: [
      { value: 'create', label: '创建' },
      { value: 'update', label: '修改' },
      { value: 'delete', label: '删除' },
      { value: 'toggle', label: '切换' },
    ]}},
    { type: 'string', name: 'targetType' },
    { type: 'string', name: 'targetId' },
    { type: 'string', name: 'targetName' },
    { type: 'string', name: 'tableName' },
    { type: 'json', name: 'changes', description: '变更内容快照' },
    {
      type: 'belongsTo',
      name: 'operator',
      target: 'users',
      foreignKey: 'operatorId',
    },
    { type: 'date', name: 'createdAt' },
  ],
  timestamps: false,
  autoGenId: true,
  indexes: [
    { fields: ['targetType', 'targetId'] },
    { fields: ['createdAt'] },
  ],
});
