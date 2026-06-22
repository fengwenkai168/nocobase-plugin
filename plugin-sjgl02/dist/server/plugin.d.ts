import { Plugin } from '@nocobase/server';
export declare class PluginSjgl02Server extends Plugin {
    load(): Promise<void>;
    private defineCustomResources;
    private setupACL;
    install(): Promise<void>;
}
export default PluginSjgl02Server;
