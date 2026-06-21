import { Plugin } from '@nocobase/client';
export declare class PluginShuiyin1Client extends Plugin {
    settings: {
        text: string;
        opacity: number;
        fontSize: number;
        showTime: boolean;
        density: number;
    };
    username: string;
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
