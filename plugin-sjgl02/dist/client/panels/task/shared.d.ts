import React from 'react';
export declare const STATUS_CONFIG: Record<string, {
    color: string;
    label: string;
}>;
export declare const LOG_LEVEL_COLORS: Record<string, string>;
export declare function StatusBadge({ status }: {
    status: string;
}): React.JSX.Element;
export declare function TableTag({ name, title }: {
    name: string;
    title?: string;
}): React.JSX.Element;
export declare function FieldTag({ name, title }: {
    name: string;
    title?: string;
}): React.JSX.Element;
export declare function DataDot({ type, count }: {
    type: 'success' | 'failed' | 'total';
    count: number;
}): React.JSX.Element;
export declare function formatTime(d: string | Date | null | undefined): string;
export declare function formatFileSize(bytes: number | null | undefined): string;
export declare function formatDuration(start: string | Date, end: string | Date | null | undefined): string;
