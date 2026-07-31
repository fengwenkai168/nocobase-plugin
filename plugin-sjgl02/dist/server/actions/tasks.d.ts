import type Plugin from '../plugin';
export declare function registerTaskActions(plugin: Plugin): {
    stats: (ctx: any, next: any) => Promise<void>;
    download: (ctx: any, next: any) => Promise<void>;
    exportErrorReport: (ctx: any, next: any) => Promise<void>;
    retry: (ctx: any, next: any) => Promise<void>;
    getScope: (ctx: any, next: any) => Promise<void>;
    setScope: (ctx: any, next: any) => Promise<void>;
};
