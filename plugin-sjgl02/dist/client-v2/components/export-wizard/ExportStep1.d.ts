import React from 'react';
import { ExportWizardState } from './ExportWizard';
export default function ExportStep1({ state, patch, onNext, }: {
    state: ExportWizardState;
    patch: (p: Partial<ExportWizardState>) => void;
    onNext: () => void;
}): React.JSX.Element;
