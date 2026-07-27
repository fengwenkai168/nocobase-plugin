import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02UserSettings',
  title: '数据管理用户设置',
  createdBy: false,
  updatedBy: false,
  logging: false,
  fields: [
    { type: 'bigInt', name: 'userId', allowNull: false, unique: true, index: true },
    { type: 'string', name: 'taskScope', defaultValue: 'self', comment: 'self=仅查看自己的 | all=查看全部' },
  ],
});
