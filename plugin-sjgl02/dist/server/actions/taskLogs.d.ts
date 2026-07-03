import { Context, Next } from '@nocobase/actions';
import type { Database } from '@nocobase/database';
export declare function listTaskLogs(ctx: Context, next: Next): Promise<void>;
export declare function writeTaskLog(db: Database, taskId: number, level: string, message: string): Promise<void>;
