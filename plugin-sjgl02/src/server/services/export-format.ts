export type RelationFormat = 'display' | 'pk' | 'displayPk';

export const DATE_FORMATS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY/MM/DD HH:mm:ss',
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD/MM/YYYY',
  'UTC ISO 8601',
  '时间戳(毫秒)',
  '时间戳(秒)',
] as const;

function pad(num: number): string {
  return String(num).padStart(2, '0');
}

export function formatDateValue(value: unknown, format: string): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return String(value);
  switch (format) {
    case 'YYYY-MM-DD HH:mm:ss':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    case 'YYYY/MM/DD HH:mm:ss':
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    case 'YYYY-MM-DD':
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    case 'YYYY/MM/DD':
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
    case 'DD/MM/YYYY':
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    case 'UTC ISO 8601':
      return date.toISOString();
    case '时间戳(毫秒)':
      return date.getTime();
    case '时间戳(秒)':
      return Math.floor(date.getTime() / 1000);
    default:
      return date.toISOString();
  }
}

export function formatBooleanValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return value ? '是' : '否';
}

export function formatSelectValue(value: unknown, options?: Array<{ label: string; value: string }>): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (!options?.length) return String(value);
  const hit = options.find((o) => o.value === String(value));
  return hit ? hit.label : String(value);
}

export function formatMultiSelectValue(value: unknown, options?: Array<{ label: string; value: string }>): string | null {
  if (value === null || value === undefined || value === '') return null;
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => formatSelectValue(v, options) ?? String(v)).join(',');
}

export function formatRelationRecord(
  record: Record<string, unknown> | null | undefined,
  pkName: string,
  titleField: string,
  format: RelationFormat,
): string | null {
  if (!record) return null;
  const pk = record[pkName];
  let display = record[titleField] ?? pk;
  if (typeof display === 'string') {
    const match = display.match(/^\{\{t\("(.+?)"\)\}\}$/);
    if (match) display = match[1];
  }
  switch (format) {
    case 'pk':
      return pk === null || pk === undefined ? null : String(pk);
    case 'displayPk':
      return `${display}(${pk})`;
    case 'display':
    default:
      return display === null || display === undefined ? null : String(display);
  }
}

export function getTitleField(collection: { options: Record<string, unknown>; getField: (name: string) => unknown }, pkName: string): string {
  const configured = collection.options.titleField as string | undefined;
  if (configured && collection.getField(configured)) return configured;
  for (const candidate of ['title', 'name', 'nickname', 'label']) {
    if (collection.getField(candidate)) return candidate;
  }
  return pkName;
}
