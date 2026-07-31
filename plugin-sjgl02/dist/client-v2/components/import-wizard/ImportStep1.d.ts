import React from 'react';
import { ImportWizardState } from './ImportWizard';
export default function ImportStep1({ state, patch, onNext, }: {
    state: ImportWizardState;
    patch: (p: Partial<ImportWizardState>) => void;
    onNext: () => void;
}): React.JSX.Element;
