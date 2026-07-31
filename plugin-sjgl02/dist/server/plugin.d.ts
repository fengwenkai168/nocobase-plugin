import { Plugin } from '@nocobase/server';
import { TaskQueueService } from './services/task-queue';
export declare class PluginSjgl02Server extends Plugin {
    taskQueue: TaskQueueService;
    beforeLoad(): Promise<void>;
    load(): Promise<void>;
    install(): Promise<void>;
    private registerAcl;
    private registerActions;
    private registerDemoHandler;
}
export default PluginSjgl02Server;
