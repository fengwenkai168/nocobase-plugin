import type Plugin from '../plugin';
export declare function registerPermissionLogHooks(plugin: Plugin): void;
export declare function registerPermissionActions(plugin: Plugin): {
    permTargets: (ctx: any, next: any) => Promise<void>;
    permList: (ctx: any, next: any) => Promise<void>;
    permListByCollection: (ctx: any, next: any) => Promise<void>;
};
