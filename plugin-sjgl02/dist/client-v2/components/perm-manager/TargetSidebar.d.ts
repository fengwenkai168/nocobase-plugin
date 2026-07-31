import React from 'react';
export interface PermTarget {
    type: 'user' | 'role';
    id: string;
    name: string;
    roleNames?: string[];
    roleTitles?: string;
}
export default function TargetSidebar({ selected, onSelect, }: {
    selected?: PermTarget;
    onSelect: (target: PermTarget) => void;
}): React.JSX.Element;
