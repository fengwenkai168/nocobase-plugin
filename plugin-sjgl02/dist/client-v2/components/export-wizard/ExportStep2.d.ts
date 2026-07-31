import React from 'react';
import { ExportWizardState } from './ExportWizard';
export default function ExportStep2({ state, patch, markDirty, onPrev, onNext, }: {
    state: ExportWizardState;
    patch: (p: Partial<ExportWizardState>) => void;
    markDirty: () => void;
    onPrev: () => void;
    onNext: () => void;
}): React.JSX.Element;
