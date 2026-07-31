import React from 'react';
import { ImportWizardState } from './ImportWizard';
export default function ImportAttachmentCard({ state, patch, markDirty, }: {
    state: ImportWizardState;
    patch: (p: Partial<ImportWizardState>) => void;
    markDirty: () => void;
}): React.JSX.Element;
