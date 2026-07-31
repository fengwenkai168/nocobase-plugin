import React from 'react';
export declare function ChipsSelect({ options, value, onChange, color, placeholder, }: {
    options: Array<{
        value: string;
        label: string;
    }>;
    value: string[];
    onChange: (v: string[]) => void;
    color: string;
    placeholder: string;
}): React.JSX.Element;
export declare function SortableFieldList({ options, value, onChange, placeholder, }: {
    options: Array<{
        value: string;
        label: string;
    }>;
    value: string[];
    onChange: (v: string[]) => void;
    placeholder: string;
}): React.JSX.Element;
export declare function FieldBlock({ title, required, children, defaultOpen, extra, }: {
    title: string;
    required?: boolean;
    children: React.ReactNode;
    defaultOpen?: boolean;
    extra?: React.ReactNode;
}): React.JSX.Element;
