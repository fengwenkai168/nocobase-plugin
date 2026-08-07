import type { Database } from '@nocobase/database';

export interface FieldMeta {
  name: string;
  title: string;
  type: string;
  interface?: string;
  options?: Array<{ label: string; value: string }>;
  target?: string;
  targetKey?: string;
  foreignKey?: string;
  through?: string;
  sourceKey?: string;
  otherKey?: string;
  multiple?: boolean;
  ignored?: boolean;
  attachment?: boolean;
}

export type ImportMode = 'insert' | 'update' | 'upsert';
export type BlankStrategy = 'clear' | 'preserve';

export interface FieldConfig {
  folder?: string;
  emptyStrategy?: 'skip' | 'clear';
  notFound?: 'fail' | 'skip';
  updateMode?: 'overwrite' | 'append';
}

export interface ConvertContext {
  db: Database;
  mode: ImportMode;
  blankStrategy: BlankStrategy;
  fieldConfigs?: Record<string, FieldConfig>;
  requiredFields: string[];
  existsCache: Map<string, boolean>;
  pkMetaCache: Map<string, { name: string; type: string }>;
}

export interface ConvertResult {
  status: 'ok' | 'skip' | 'error';
  value?: unknown;
  error?: string;
}

const SYSTEM_FIELD_NAMES = ['createdAt', 'updatedAt', 'createdById', 'updatedById'];

export function isSystemField(name: string): boolean {
  return SYSTEM_FIELD_NAMES.includes(name);
}

export function isBlank(raw: unknown): boolean {
  return raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');
}

function fail(reason: string): ConvertResult {
  return { status: 'error', error: reason };
}

const ok = (value: unknown): ConvertResult => ({ status: 'ok', value });
const skip: ConvertResult = { status: 'skip' };

export function getTargetPkMeta(ctx: ConvertContext, collectionName: string): { name: string; type: string } {
  let meta = ctx.pkMetaCache.get(collectionName);
  if (!meta) {
    const collection = ctx.db.getCollection(collectionName);
    if (!collection) {
      throw new Error(`关联表 ${collectionName} 不存在`);
    }
    const pkName = (collection.options.filterTargetKey as string) || collection.model.primaryKeyAttribute || 'id';
    const pkField = collection.getField(pkName);
    meta = { name: pkName, type: pkField?.options?.type || 'bigInt' };
    ctx.pkMetaCache.set(collectionName, meta);
  }
  return meta;
}

function coercePkValue(raw: unknown, pkType: string): string | number | null {
  if (isBlank(raw)) return null;
  if (['integer', 'bigInt', 'snowflakeId'].includes(pkType)) {
    const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
    return num;
  }
  return String(raw).trim();
}

async function ensureExists(ctx: ConvertContext, collectionName: string, value: string | number): Promise<boolean> {
  const pk = getTargetPkMeta(ctx, collectionName);
  const cacheKey = `${collectionName}:${value}`;
  const cached = ctx.existsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const repo = ctx.db.getRepository(collectionName);
  const found = await repo.findOne({ filter: { [pk.name]: value }, fields: [pk.name] });
  const exists = !!found;
  ctx.existsCache.set(cacheKey, exists);
  return exists;
}

export function parseDateValue(raw: unknown): Date | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw >= 1e12) return new Date(raw);
    if (raw >= 1e9) return new Date(raw * 1000);
    if (raw > 20000 && raw < 200000) return new Date(Math.round((raw - 25569) * 86400 * 1000));
    return null;
  }
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;
  if (/^\d{13,}$/.test(text)) return new Date(Number(text));
  if (/^\d{10}$/.test(text)) return new Date(Number(text) * 1000);
  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20000 && serial < 200000) return new Date(Math.round((serial - 25569) * 86400 * 1000));
    return null;
  }
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (match) {
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
    const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (isNaN(date.getTime())) return null;
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }
  const parsed = Date.parse(text);
  if (!isNaN(parsed)) return new Date(parsed);
  return null;
}

function parseBooleanValue(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  if (typeof raw !== 'string') return null;
  const text = raw.trim().toLowerCase();
  if (['true', '1', '是', '启用', 'yes', 'y'].includes(text)) return true;
  if (['false', '0', '否', '停用', 'no', 'n'].includes(text)) return false;
  return null;
}

function splitMultiValue(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  return String(raw)
    .split(/[,，]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function matchOption(meta: FieldMeta, label: string): string | null {
  const options = meta.options || [];
  const hit = options.find((o) => o.label === label);
  return hit ? hit.value : null;
}

const RELATION_EFFECTIVE_TYPES = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'];

function fieldCfg(ctx: ConvertContext, name: string): FieldConfig {
  return ctx.fieldConfigs?.[name] || {};
}

// 宽松数字解析：先按标准 Number 转换，失败时剥离货币符号（¥￥$€£）、千分位逗号、空白后重试。
// 如 "¥39.9" → 39.9、"1,234.56" → 1234.56；纯数字行为不变。
function parseNumericValue(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const text = String(raw).trim();
  if (!text) return null;
  let num = Number(text);
  if (Number.isFinite(num)) return num;
  const cleaned = text.replace(/[¥￥$€£,\s]/g, '');
  if (!cleaned) return null;
  num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

// 日期对象转为标准文本（本地时区）：Wed Jul 15 2026 11:44:52 GMT+0800 → 2026-07-15 11:44:52
function formatDateToText(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(
    date.getMinutes(),
  )}:${p(date.getSeconds())}`;
}

export async function convertFieldValue(meta: FieldMeta, raw: unknown, ctx: ConvertContext): Promise<ConvertResult> {
  if (meta.ignored) return skip;
  const required = ctx.requiredFields.includes(meta.name);
  const effectiveType =
    meta.interface === 'select' || meta.type === 'select'
      ? 'select'
      : meta.interface === 'multipleSelect'
        ? 'multipleSelect'
        : meta.type;
  const cfg = fieldCfg(ctx, meta.name);
  const notFoundSkip = cfg.notFound === 'skip';

  if (isBlank(raw)) {
    if (ctx.mode === 'insert') {
      if (required) return fail(`必填字段 ${meta.title}(${meta.name}) 为空`);
      return skip;
    }
    if (RELATION_EFFECTIVE_TYPES.includes(effectiveType)) {
      // 字段级空值处理：默认跳过不更新（保留原值/原关联），配置 clear 时清空（解除关联）
      if (cfg.emptyStrategy === 'clear') {
        return effectiveType === 'hasMany' || effectiveType === 'belongsToMany' ? ok([]) : ok(null);
      }
      return skip;
    }
    if (ctx.blankStrategy === 'preserve') return skip;
    if (required) return fail(`必填字段 ${meta.title}(${meta.name}) 为空`);
    return ok(null);
  }

  switch (effectiveType) {
    case 'string':
    case 'text':
    case 'uid':
      // 日期单元格（cellDates 解析为 Date）写入文本字段时格式化为标准文本，避免输出
      // "Wed Jul 15 2026 11:44:52 GMT+0800 (China Standard Time)" 这类脏格式
      if (raw instanceof Date && !isNaN(raw.getTime())) return ok(formatDateToText(raw));
      return ok(String(raw));
    case 'integer':
    case 'bigInt':
    case 'sort': {
      const num = parseNumericValue(raw);
      if (num === null || !Number.isInteger(num)) return fail(`整数转换失败: "${raw}"`);
      return ok(num);
    }
    case 'float':
    case 'double':
    case 'real':
    case 'decimal':
    case 'percent': {
      const num = parseNumericValue(raw);
      if (num === null) return fail(`数字转换失败: "${raw}"`);
      return ok(num);
    }
    case 'boolean':
    case 'radio': {
      const val = parseBooleanValue(raw);
      if (val === null) return fail(`无法识别为布尔值: "${raw}"`);
      return ok(val);
    }
    case 'date':
    case 'datetimeTz':
    case 'datetimeNoTz':
    case 'dateOnly':
    case 'unixTimestamp': {
      const date = parseDateValue(raw);
      if (!date) return fail(`日期格式无法解析: "${raw}"`);
      return ok(date);
    }
    case 'select': {
      const label = String(raw).trim();
      const value = matchOption(meta, label);
      if (value === null) return fail(`选项不存在: "${label}"`);
      return ok(value);
    }
    case 'checkbox':
    case 'array':
    case 'set':
    case 'multipleSelect': {
      const labels = splitMultiValue(raw);
      if (meta.options?.length) {
        const values: string[] = [];
        for (const label of labels) {
          const value = matchOption(meta, label);
          if (value === null) return fail(`选项不存在: "${label}"`);
          values.push(value);
        }
        return ok(values);
      }
      return ok(labels);
    }
    case 'belongsTo':
    case 'hasOne': {
      const pk = getTargetPkMeta(ctx, meta.target!);
      const value = coercePkValue(raw, pk.type);
      if (value === null) return fail(`与目标表 ${meta.target} 主键(${pk.type})类型不匹配: "${raw}"`);
      if (!(await ensureExists(ctx, meta.target!, value))) {
        if (notFoundSkip) return skip;
        return fail(`关联记录不存在: ${meta.target}.${pk.name}="${raw}"`);
      }
      return ok(value);
    }
    case 'hasMany':
    case 'belongsToMany': {
      const pk = getTargetPkMeta(ctx, meta.target!);
      const parts = splitMultiValue(raw);
      const values: Array<string | number> = [];
      for (const part of parts) {
        const value = coercePkValue(part, pk.type);
        if (value === null) return fail(`与目标表 ${meta.target} 主键(${pk.type})类型不匹配: "${part}"`);
        if (!(await ensureExists(ctx, meta.target!, value))) {
          // 跳过该字段：多值中任一匹配不到 → 整字段跳过，行继续导入
          if (notFoundSkip) return skip;
          return fail(`关联记录不存在: ${meta.target}.${pk.name}="${part}"`);
        }
        values.push(value);
      }
      return ok(values);
    }
    case 'json':
    case 'jsonb': {
      if (typeof raw === 'object') return ok(raw);
      try {
        return ok(JSON.parse(String(raw)));
      } catch {
        return fail(`JSON 格式错误: "${raw}"`);
      }
    }
    case 'password':
      return ok(String(raw));
    default:
      return ok(typeof raw === 'string' ? raw : raw);
  }
}
