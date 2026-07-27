import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02Permissions',
  title: '数据管理权限配置',
  createdBy: true,
  updatedBy: true,
  logging: false,
  indexes: [
    { unique: true, fields: ['targetType', 'targetId', 'collectionName'] },
    // 自定义索引名：规避 1.0.x 旧版蛇形表残留的同名列索引冲突（框架 addIndex 按字段去重，预声明后不再生成默认蛇形名）
    { name: 'idx_sjgl02perms_created_by', fields: ['createdById'] },
    { name: 'idx_sjgl02perms_updated_by', fields: ['updatedById'] },
    { name: 'idx_sjgl02perms_collection', fields: ['collectionName'] },
  ],
  fields: [
    { type: 'string', name: 'targetType', allowNull: false, comment: 'user | role' },
    { type: 'string', name: 'targetId', allowNull: false, comment: '多态外键：userId 或 roleName（字符串形式）' },
    { type: 'string', name: 'targetName', comment: '显示名冗余（角色取 roles.title）' },
    { type: 'string', name: 'collectionName', allowNull: false, index: true },
    { type: 'string', name: 'collectionTitle' },
    { type: 'boolean', name: 'canImport', defaultValue: false },
    { type: 'boolean', name: 'canExport', defaultValue: false },
    { type: 'jsonb', name: 'importModes', comment: '允许的导入模式数组，如 ["insert","upsert"]' },
    { type: 'jsonb', name: 'uniqueFields', comment: '唯一值字段（配置即锁定；空=导入时自由选择）' },
    { type: 'jsonb', name: 'requiredFields', comment: '必填字段' },
    { type: 'jsonb', name: 'importFields', comment: '可导入字段白名单（空=全部允许）' },
    { type: 'jsonb', name: 'exportFields', comment: '可导出字段白名单（空=全部允许）' },
    { type: 'jsonb', name: 'exportFilter', comment: '导出范围筛选条件（后端强制执行）' },
    { type: 'integer', name: 'sort', defaultValue: 0 },
  ],
});
