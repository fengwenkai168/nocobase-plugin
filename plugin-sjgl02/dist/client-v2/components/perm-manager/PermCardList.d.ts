import React from 'react';
import { PermRecord } from '../../services/api';
export declare function PermTags({ record, labelOf, }: {
    record: PermRecord;
    labelOf: (collectionName: string, name: string) => string;
}): React.JSX.Element;
export default function PermCardList({ own, inherited, isUser, onEdit, onDelete, refreshKey, }: {
    own: PermRecord[];
    inherited: Array<{
        roleName: string;
        roleTitle: string;
        items: PermRecord[];
        isAdmin: boolean;
    }>;
    isUser: boolean;
    onEdit: (record?: PermRecord) => void;
    onDelete: (record: PermRecord) => void;
    refreshKey: number;
}): React.JSX.Element;
