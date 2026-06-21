import { Plugin } from '@nocobase/server';
export declare class PluginShuiyin1Server extends Plugin {
    afterAdd(): Promise<void>;
    beforeLoad(): Promise<void>;
    load(): Promise<void>;
    install(): Promise<void>;
    upgrade(): Promise<void>;
    private syncVersion;
    private readPackageJson;
    private createDefaultSettings;
    afterEnable(): Promise<void>;
    afterDisable(): Promise<void>;
    remove(): Promise<void>;
}
export default PluginShuiyin1Server;
