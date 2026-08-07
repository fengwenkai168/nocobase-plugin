import React from 'react';
import { CollectionMeta, CollectionOption, PermConfigInfo } from '../../services/api';
export declare const ALL_TABLES = "__all__";
/** 编译后的 NocoBase filter（系统筛选面板输出），undefined 表示未设置 */
export type CompiledExportFilter = Record<string, unknown> | undefined;
export interface ExportWizardState {
    collection?: CollectionOption;
    allTables: boolean;
    isAdmin: boolean;
    meta?: CollectionMeta;
    permissions: PermConfigInfo[];
    permission?: PermConfigInfo;
    selectedFields: string[];
    dateFormats: Record<string, string>;
    relationFormats: Record<string, string>;
    relationExportEnabled: boolean;
    relationFields: string[];
    relationExportMode: 'sheet' | 'file';
    headerType: 'titleName' | 'title' | 'name';
    dataRange: 'all' | 'filtered';
    filter: CompiledExportFilter;
    sorts: Array<{
        field: string;
        order: 'asc' | 'desc';
    }>;
    exportAttachment: boolean;
    globalDateFormat: string;
    globalRelationFormat: string;
    dirty: boolean;
}
export declare const initialExportState: ExportWizardState;
export default function ExportWizard({ registerDirtyCheck, }: {
    registerDirtyCheck?: (tabKey: string, fn: () => boolean) => () => void;
}): React.JSX.Element;
