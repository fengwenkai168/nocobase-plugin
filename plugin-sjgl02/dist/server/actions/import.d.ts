import type Plugin from '../plugin';
export declare function registerImportActions(plugin: Plugin): {
    importUpload: (ctx: any, next: any) => Promise<any>;
    previewExcel: (ctx: any, next: any) => Promise<void>;
    getImportPermissions: (ctx: any, next: any) => Promise<void>;
    importableCollections: (ctx: any, next: any) => Promise<void>;
    import: (ctx: any, next: any) => Promise<void>;
    downloadTemplate: (ctx: any, next: any) => Promise<void>;
};
