/// <reference types="react" />
import type { Permission } from '../types/permission';
export declare function usePermissionFilter(perms: Permission[], tables: Array<{
    name: string;
    title: string;
}>, searchText: string, pageSize?: number): {
    filteredPerms: Permission[];
    inheritedPerms: Permission[];
    customPerms: Permission[];
    total: number;
    totalPages: number;
    page: number;
    setPage: import("react").Dispatch<import("react").SetStateAction<number>>;
    isEmpty: boolean;
};
