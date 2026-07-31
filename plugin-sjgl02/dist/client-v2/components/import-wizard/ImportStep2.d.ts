import React from 'react';
import { UploadResult } from '../../services/api';
import { ImportWizardState } from './ImportWizard';
export default function ImportStep2({ state, patch, markDirty, reloadPreview, onPrev, onNext, }: {
    state: ImportWizardState;
    patch: (p: Partial<ImportWizardState>) => void;
    markDirty: () => void;
    reloadPreview: (upload: UploadResult, sheetName: string, headerRow: number) => Promise<unknown>;
    onPrev: () => void;
    onNext: () => void;
}): React.JSX.Element;
