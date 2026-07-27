import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02PermissionLogs',
  title: '数据管理权限操作日志',
  createdBy: true,
  updatedBy: false,
  logging: false,
  indexes: [
    // 自定义索引名：规避 1.0.x 旧版蛇形表残留的同名列索引冲突（框架 addIndex 按字段去重，预声明后不再生成默认蛇形名）
    { name: 'idx_sjgl02plogs_created_by', fields: ['createdById'] },
    { name: 'idx_sjgl02plogs_action', fields: ['action'] },
    { name: 'idx_sjgl02plogs_target_id', fields: ['targetId'] },
    { name: 'idx_sjgl02plogs_collection', fields: ['collectionName'] },
  ],
  fields: [
    { type: 'string', name: 'action', allowNull: false, index: true, comment: 'create | update | delete | toggle' },
    { type: 'string', name: 'targetType', allowNull: false },
    { type: 'string', name: 'targetId', allowNull: false, index: true },
    { type: 'string', name: 'targetName' },
    { type: 'string', name: 'collectionName', index: true },
    { type: 'string', name: 'collectionTitle' },
    { type: 'integer', name: 'permissionId' },
    { type: 'jsonb', name: 'beforeValue', comment: '操作前快照' },
    { type: 'jsonb', name: 'afterValue', comment: '操作后快照' },
    { type: 'string', name: 'summary', comment: '变更概要' },
  ],
});
