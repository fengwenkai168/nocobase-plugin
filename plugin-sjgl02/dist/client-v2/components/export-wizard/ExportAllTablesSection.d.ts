import React from 'react';
import { ExportWizardState } from './ExportWizard';
export default function ExportAllTablesSection({ state, onChange, }: {
    state: ExportWizardState;
    onChange: (p: Partial<ExportWizardState>) => void;
}): React.JSX.Element;
