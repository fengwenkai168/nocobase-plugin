import type { Database } from '@nocobase/database';
import type { FieldMeta } from './value-converter';

const IGNORED_INTERFACES = ['subTable', 'subForm'];
const IGNORED_TYPES = ['formula', 'sequenceField', 'virtual'];

export function cleanTitle(title: unknown, fallback: string): string {
  const text = String(title || '');
  const match = text.match(/^\{\{t\("(.+?)"\)\}\}$/);
  return match ? match[1] : text || fallback;
}

export function buildFieldMeta(db: Database, collectionName: string, fieldName: string): FieldMeta | null {
  const collection = db.getCollection(collectionName);
  const field = collection?.getField(fieldName);
  if (!collection || !field) return null;
  const options = field.options as Record<string, unknown>;
  const uiSchema = (options.uiSchema || {}) as Record<string, unknown>;
  const componentProps = (uiSchema['x-component-props'] || {}) as Record<string, unknown>;
  const rawOptions =
    (componentProps.options as Array<{ label: string; value: string }>) ||
    (uiSchema.enum as Array<{ label: string; value: string }>) ||
    undefined;
  const type = String(options.type || 'string');
  const iface = (options.interface as string) || (uiSchema['x-component'] as string) || undefined;
  return {
    name: fieldName,
    title: cleanTitle(uiSchema.title, fieldName),
    type,
    interface: iface,
    options: rawOptions?.map((o) => ({ label: String(o.label), value: String(o.value) })),
    target: options.target as string | undefined,
    targetKey: options.targetKey as string | undefined,
    foreignKey: options.foreignKey as string | undefined,
    through: options.through as string | undefined,
    sourceKey: options.sourceKey as string | undefined,
    otherKey: options.otherKey as string | undefined,
    multiple: type === 'hasMany' || type === 'belongsToMany',
    ignored: IGNORED_TYPES.includes(type) || (iface ? IGNORED_INTERFACES.includes(iface) : false),
    attachment: iface === 'attachment',
  };
}

export function listExportableFields(db: Database, collectionName: string): FieldMeta[] {
  const collection = db.getCollection(collectionName);
  if (!collection) return [];
  const relationForeignKeys = new Set<string>();
  for (const field of collection.fields.values()) {
    const options = field.options as Record<string, unknown>;
    if (['belongsTo', 'hasOne'].includes(String(options.type)) && options.foreignKey) {
      relationForeignKeys.add(String(options.foreignKey));
    }
  }
  const names = new Set<string>([...collection.fields.keys()]);
  for (const attr of Object.keys(collection.model.rawAttributes || {})) {
    if (!relationForeignKeys.has(attr)) names.add(attr);
  }
  const out: FieldMeta[] = [];
  for (const name of names) {
    const meta = buildFieldMeta(db, collectionName, name);
    if (meta && !meta.ignored) out.push(meta);
  }
  return out;
}
