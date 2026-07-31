import type Plugin from '../plugin';
export declare function registerMetaActions(plugin: Plugin): {
    collectionMeta: (ctx: any, next: any) => Promise<void>;
};
