import React from 'react';
import { PermRecord } from '../../services/api';
import { PermTarget } from './TargetSidebar';
export default function PermEditModal({ target, record, existingCollections, onClose, onSaved, }: {
    target: PermTarget;
    record?: PermRecord | null;
    existingCollections?: string[];
    onClose: () => void;
    onSaved: () => void;
}): React.JSX.Element;
