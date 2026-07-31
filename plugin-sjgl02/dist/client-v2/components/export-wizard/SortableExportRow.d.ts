import React from 'react';
export default function SortableExportRow({ id, index, label, total, extra, onRemove, onMove, onJumpTo, }: {
    id: string;
    index: number;
    label: string;
    total: number;
    extra?: React.ReactNode;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onJumpTo?: (targetIndex: number) => void;
}): React.JSX.Element;
