import type Plugin from '../plugin';
export declare function registerExportActions(plugin: Plugin): {
    getExportPermissions: (ctx: any, next: any) => Promise<void>;
    listExportSchemes: (ctx: any, next: any) => Promise<void>;
    exportableCollections: (ctx: any, next: any) => Promise<void>;
    export: (ctx: any, next: any) => Promise<void>;
};
