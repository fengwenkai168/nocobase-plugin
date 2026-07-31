import React from 'react';
export default function CopyFromConfigModal({ open, collectionName, fieldOptions, onClose, onCopy, }: {
    open: boolean;
    collectionName: string;
    fieldOptions: Array<{
        value: string;
        label: string;
    }>;
    onClose: () => void;
    onCopy: (fields: string[]) => void;
}): React.JSX.Element;
