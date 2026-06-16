import { Plugin } from '@nocobase/client';
export declare class PluginShuiyin1Client extends Plugin {
    private settings;
    private username;
    private checkTimer;
    private timeTimer;
    private refreshTimer;
    private observer;
    private clearTimeTimer;
    private startTimeTimer;
    private fetchSettings;
    private refreshWatermark;
    private applyLatestSettings;
    load(): Promise<void>;
}
export default PluginShuiyin1Client;
