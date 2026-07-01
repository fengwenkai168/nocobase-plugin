import { useState, useEffect } from 'react';
import type { Permission } from '../types/permission';

export function usePermissionFilter(
  perms: Permission[],
  tables: Array<{ name: string; title: string }>,
  searchText: string,
  pageSize: number = 10,
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [searchText]);

  const filterFn = (p: Permission) => {
    if (!searchText) return true;
    const t = tables.find((x) => x.name === p.tableName);
    return p.tableName.toLowerCase().includes(searchText.toLowerCase()) ||
      (t?.title || '').toLowerCase().includes(searchText.toLowerCase());
  };

  const inheritedPerms = perms.filter((p) => p._inherited && filterFn(p));
  const customPerms = perms.filter((p) => !p._inherited && filterFn(p));
  const allFiltered = [...inheritedPerms, ...customPerms];
  const total = allFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = allFiltered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    filteredPerms: paged,
    inheritedPerms: inheritedPerms,
    customPerms: customPerms,
    total,
    totalPages,
    page: safePage,
    setPage,
    isEmpty: total === 0,
  };
}
