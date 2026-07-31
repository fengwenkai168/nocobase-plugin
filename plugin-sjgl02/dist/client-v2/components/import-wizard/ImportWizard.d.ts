import React from 'react';
import { CollectionMeta, CollectionOption, ImportMappingItem, PermConfigInfo, PreviewResult, UploadResult } from '../../services/api';
export interface ImportWizardState {
    collection?: CollectionOption;
    upload?: UploadResult;
    sheetName: string;
    headerRow: number;
    permissions: PermConfigInfo[];
    permission?: PermConfigInfo;
    mode: string;
    uniqueFields: string[];
    blankStrategy: 'clear' | 'preserve';
    mapping: ImportMappingItem[];
    attachmentEnabled: boolean;
    attachment?: UploadResult;
    meta?: CollectionMeta;
    preview?: PreviewResult;
    previewLoading?: boolean;
    previewError?: string | null;
    dirty: boolean;
}
export declare const initialImportState: ImportWizardState;
export default function ImportWizard({ registerDirtyCheck, }: {
    registerDirtyCheck?: (tabKey: string, fn: () => boolean) => () => void;
}): React.JSX.Element;
