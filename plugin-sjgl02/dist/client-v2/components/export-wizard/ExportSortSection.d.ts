import React from 'react';
import { ExportWizardState } from './ExportWizard';
/** 导出排序配置：最多 3 级（字段 + 升/降序） */
export default function ExportSortSection({ state, onChange, }: {
    state: ExportWizardState;
    onChange: (sorts: Array<{
        field: string;
        order: 'asc' | 'desc';
    }>) => void;
}): React.JSX.Element;
