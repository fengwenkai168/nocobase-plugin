import React from 'react';
import { TaskRecord } from '../../services/api';
interface TaskError {
    row: number;
    field: string;
    reason: string;
    raw: unknown;
}
export default function TaskErrorLogs({ task, errors, errorGroups, fieldLabel, }: {
    task: TaskRecord;
    errors: TaskError[];
    errorGroups: Array<{
        field: string;
        reason: string;
        count: number;
    }>;
    fieldLabel: (name: string) => string;
}): React.JSX.Element;
export {};
