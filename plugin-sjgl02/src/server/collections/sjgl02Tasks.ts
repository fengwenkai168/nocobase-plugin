import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02Tasks',
  title: '数据管理任务',
  createdBy: true,
  updatedBy: false,
  logging: true,
  indexes: [
    // 自定义索引名：规避 1.0.x 旧版蛇形表残留的同名列索引冲突（框架 addIndex 按字段去重，预声明后不再生成默认蛇形名）
    { name: 'idx_sjgl02tasks_created_by', fields: ['createdById'] },
    { name: 'idx_sjgl02tasks_status', fields: ['status'] },
    { name: 'idx_sjgl02tasks_collection', fields: ['collectionName'] },
  ],
  fields: [
    { type: 'string', name: 'type', allowNull: false, comment: 'import | export | demo' },
    { type: 'string', name: 'status', allowNull: false, defaultValue: 'pending', index: true, comment: 'pending | running | succeeded | failed | canceled' },
    { type: 'string', name: 'title' },
    { type: 'string', name: 'collectionName', index: true },
    { type: 'string', name: 'collectionTitle' },
    { type: 'jsonb', name: 'params', comment: '任务配置全量快照' },
    { type: 'jsonb', name: 'result', comment: '完成时结果快照（含错误明细前100条、预览行前10行）' },
    { type: 'integer', name: 'progressTotal', defaultValue: 0 },
    { type: 'integer', name: 'progressCurrent', defaultValue: 0 },
    { type: 'integer', name: 'totalRows', defaultValue: 0 },
    { type: 'integer', name: 'successRows', defaultValue: 0 },
    { type: 'integer', name: 'errorRows', defaultValue: 0 },
    { type: 'string', name: 'filePath' },
    { type: 'string', name: 'fileName' },
    { type: 'bigInt', name: 'fileSize' },
    { type: 'string', name: 'errorReportPath' },
    { type: 'integer', name: 'permissionConfigId' },
    { type: 'string', name: 'permissionType' },
    { type: 'text', name: 'message' },
    { type: 'date', name: 'startedAt' },
    { type: 'date', name: 'doneAt' },
    { type: 'integer', name: 'duration', comment: '耗时（秒）' },
  ],
});
