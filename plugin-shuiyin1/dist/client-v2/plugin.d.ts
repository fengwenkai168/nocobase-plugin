import { Plugin, Application } from '@nocobase/client-v2';
export declare class PluginShuiyin1ClientV2 extends Plugin<any, Application> {
    private settings;
    private username;
    private checkTimer;
    private timeTimer;
    private refreshTimer;
    private observer;
    private clearTimeTimer;
    private startTimeTimer;
    private fetchSettings;
    private applyLatestSettings;
    private refreshWatermark;
    load(): Promise<void>;
}
export default PluginShuiyin1ClientV2;
