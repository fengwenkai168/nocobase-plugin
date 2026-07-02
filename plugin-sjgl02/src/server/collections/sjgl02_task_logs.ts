import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02_task_logs',
  title: '任务执行日志',
  timestamps: true,
  autoGenId: true,
  indexes: [
    { fields: ['taskId'] },
    { fields: ['timestamp'] },
  ],
  fields: [
    { type: 'integer', name: 'taskId' },
    {
      interface: 'select',
      type: 'string',
      name: 'level',
      uiSchema: {
        enum: [
          { value: 'INFO', label: '信息' },
          { value: 'SUCC', label: '成功' },
          { value: 'WARN', label: '警告' },
          { value: 'ERROR', label: '错误' },
        ],
      },
    },
    { type: 'text', name: 'message' },
    { type: 'date', name: 'timestamp' },
    { type: 'belongsTo', name: 'task', target: 'sjgl02_tasks', foreignKey: 'taskId' },
  ],
});
