import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'shuiyin1_settings',
  title: 'Watermark Settings',
  fields: [
    { type: 'string', name: 'text', defaultValue: '' },
    { type: 'float', name: 'opacity', defaultValue: 0.15 },
    { type: 'integer', name: 'fontSize', defaultValue: 10 },
    { type: 'boolean', name: 'showTime', defaultValue: true },
    { type: 'integer', name: 'density', defaultValue: 5 },
    { type