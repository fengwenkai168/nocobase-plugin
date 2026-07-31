import type Plugin from '../plugin';
export declare const TASK_CHANNEL = "sjgl02:task";
export declare const TASK_STATUS: {
    readonly PENDING: "pending";
    readonly RUNNING: "running";
    readonly SUCCEEDED: "succeeded";
    readonly FAILED: "failed";
    readonly CANCELED: "canceled";
};
export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
export interface TaskHandlerContext {
    taskId: number;
    signal: AbortSignal;
    updateProgress: (current: number, total?: number) => Promise<void>;
    updateStats: (stats: {
        totalRows?: number;
        successRows?: number;
        errorRows?: number;
    }) => Promise<void>;
    throwIfAborted: () => void;
}
export type TaskHandler = (ctx: TaskHandlerContext, params: Record<string, unknown>) => Promise<unknown>;
interface SubmitOptions {
    title?: string;
    collectionName?: string;
    collectionTitle?: string;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    permissionConfigId?: number;
    permissionType?: string;
    permissionLabel?: string;
}
export declare class TaskQueueService {
    private plugin;
    private handlers;
    private controllers;
    private processing;
    constructor(plugin: Plugin);
    private get repo();
    registerHandler(type: string, handler: TaskHandler): void;
    subscribe(): void;
    submit(type: string, params: Record<string, unknown>, userId: number, options?: SubmitOptions): Promise<any>;
    cancel(taskId: number): Promise<void>;
    execute(taskId: number, options?: {
        externalSignal?: AbortSignal;
    }): Promise<void>;
    private shouldRunInWorker;
    private executeViaWorker;
    private ensureNotRunning;
    executeAsWorker(taskId: number): Promise<void>;
    recoverStaleTasks(): Promise<void>;
}
export {};
