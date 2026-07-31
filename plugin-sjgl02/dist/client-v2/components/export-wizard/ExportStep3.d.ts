import React from 'react';
import { ExportWizardState } from './ExportWizard';
export default function ExportStep3({ state, patch, onPrev, onDone, }: {
    state: ExportWizardState;
    patch: (p: Partial<ExportWizardState>) => void;
    onPrev: () => void;
    onDone: () => void;
}): React.JSX.Element;
