import React from 'react';
export default function TaskDrawer({ taskId, onClose, onChanged, }: {
    taskId: number | null;
    onClose: () => void;
    onChanged: () => void;
}): React.JSX.Element;
