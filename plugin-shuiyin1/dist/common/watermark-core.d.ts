export declare const WATERMARK_ID = "shuiyin1-watermark-overlay";
export type WatermarkTextSource = 'nickname' | 'username' | 'custom';
export interface WatermarkUser {
    nickname?: string;
    username?: string;
    email?: string;
}
export declare const defaultSettings: {
    text: string;
    textSources: WatermarkTextSource[];
    opacity: number;
    fontSize: number;
    showTime: boolean;
    density: number;
    enabled: boolean;
};
export declare const authPages: string[];
export declare function isAuthPage(): boolean;
export declare const densityMap: Record<number, {
    width: number;
    height: number;
}>;
type WatermarkSettings = typeof defaultSettings;
export declare function resolveWatermarkText(settings: WatermarkSettings, user: WatermarkUser): string;
export declare function renderWatermark(settings: WatermarkSettings, user: WatermarkUser): void;
export declare function log(...args: unknown[]): void;
export declare function logWarn(...args: unknown[]): void;
export {};
