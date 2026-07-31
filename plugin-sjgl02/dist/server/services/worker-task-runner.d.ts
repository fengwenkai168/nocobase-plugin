import type Plugin from '../plugin';
export declare class WorkerTaskRunner {
    private plugin;
    constructor(plugin: Plugin);
    run(taskId: number, signal: AbortSignal): Promise<void>;
}
