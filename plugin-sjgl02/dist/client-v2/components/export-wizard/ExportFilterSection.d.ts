import React from 'react';
import { ExportWizardState, FilterCondition } from './ExportWizard';
export default function FilterSection({ state, onChange, }: {
    state: ExportWizardState;
    onChange: (next: FilterCondition[]) => void;
}): React.JSX.Element;
