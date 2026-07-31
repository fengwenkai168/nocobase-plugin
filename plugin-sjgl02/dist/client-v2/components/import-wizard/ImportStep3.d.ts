import React from 'react';
import { ImportWizardState } from './ImportWizard';
export default function ImportStep3({ state, patch, onPrev, onDone, }: {
    state: ImportWizardState;
    patch: (p: Partial<ImportWizardState>) => void;
    onPrev: () => void;
    onDone: () => void;
}): React.JSX.Element;
