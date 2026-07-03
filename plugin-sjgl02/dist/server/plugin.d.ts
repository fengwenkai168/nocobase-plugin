import { Plugin } from '@nocobase/server';
export declare class PluginSjgl02Server extends Plugin {
    load(): Promise<void>;
    /** 启动清理：残留任务、影子表、导出文件 */
    private startupCleanup;
    private defineCustomResources;
    private setupACL;
    install(): Promise<void>;
}
export default PluginSjgl02Server;
