import type { FieldMetaInfo } from '../../services/api';

export const DATE_TYPES = ['date', 'datetimeTz', 'datetimeNoTz', 'dateOnly', 'unixTimestamp'];
export const RELATION_TYPES = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'];

export function dateFormatOptions(t: (s: string) => string) {
  return [
    { value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss（2026-07-09 15:30:00）' },
    { value: 'YYYY/MM/DD HH:mm:ss', label: 'YYYY/MM/DD HH:mm:ss（2026/07/09 15:30:00）' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD（2026-07-09）' },
    { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD（2026/07/09）' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY（09/07/2026）' },
    { value: 'UTC ISO 8601', label: 'UTC ISO 8601（2026-07-09T07:30:00.000Z）' },
    { value: '时间戳(毫秒)', label: `${t('时间戳(毫秒)')}（1752058200000）` },
    { value: '时间戳(秒)', label: `${t('时间戳(秒)')}（1752058200）` },
  ];
}

export function relationFormatOptions(t: (s: string) => string) {
  return [
    { value: 'display', label: t('显示值（如: 管理员）') },
    { value: 'pk', label: t('主键值（如: 1/UUID）') },
    { value: 'displayPk', label: t('显示值+主键值（如: 管理员(1)）') },
  ];
}

export function groupExportFields(fields: FieldMetaInfo[], order: string[]) {
  const orderedFields = order.length
    ? (order.map((name) => fields.find((f) => f.name === name)).filter(Boolean) as FieldMetaInfo[])
    : fields;
  return {
    regular: orderedFields.filter(
      (f) => !f.ignored && !DATE_TYPES.includes(f.type) && !RELATION_TYPES.includes(f.type) && !f.attachment,
    ),
    dates: orderedFields.filter((f) => !f.ignored && DATE_TYPES.includes(f.type)),
    relations: orderedFields.filter((f) => !f.ignored && RELATION_TYPES.includes(f.type) && !f.attachment),
    attachments: orderedFields.filter((f) => !f.ignored && f.attachment),
  };
}

export type ExportFieldGroups = ReturnType<typeof groupExportFields>;
