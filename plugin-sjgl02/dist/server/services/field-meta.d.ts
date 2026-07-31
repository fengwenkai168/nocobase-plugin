import type { Database } from '@nocobase/database';
import type { FieldMeta } from './value-converter';
export declare function cleanTitle(title: unknown, fallback: string): string;
export declare function buildFieldMeta(db: Database, collectionName: string, fieldName: string): FieldMeta | null;
export declare function listExportableFields(db: Database, collectionName: string): FieldMeta[];
