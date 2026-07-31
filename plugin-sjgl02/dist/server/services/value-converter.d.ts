import type { Database } from '@nocobase/database';
export interface FieldMeta {
    name: string;
    title: string;
    type: string;
    interface?: string;
    options?: Array<{
        label: string;
        value: string;
    }>;
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
    pkMetaCache: Map<string, {
        name: string;
        type: string;
    }>;
}
export interface ConvertResult {
    status: 'ok' | 'skip' | 'error';
    value?: unknown;
    error?: string;
}
export declare function isSystemField(name: string): boolean;
export declare function isBlank(raw: unknown): boolean;
export declare function getTargetPkMeta(ctx: ConvertContext, collectionName: string): {
    name: string;
    type: string;
};
export declare function parseDateValue(raw: unknown): Date | null;
export declare function convertFieldValue(meta: FieldMeta, raw: unknown, ctx: ConvertContext): Promise<ConvertResult>;
