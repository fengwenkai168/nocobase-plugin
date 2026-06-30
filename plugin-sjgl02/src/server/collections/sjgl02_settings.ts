import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'sjgl02_settings',
  title: '数据管理设置',
  fields: [
    {
      type: 'string',
      name: 'taskViewScope',
      defaultValue: 'own',
    },
    {
      type: 'integer',
      name: 'maxFileSize',
      defaultValue: 50,
    },
    {
      type: 'integer',
      name: 'batchSize',
      defaultValue: 1000,
    },
    {
   