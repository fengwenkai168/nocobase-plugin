import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePermissionFilter } from '../../../client-v2/hooks/usePermissionFilter';
import type { Permission } from '../../../client-v2/types/permission';

function makePerm(overrides: Partial<Permission> & { tableName: string }): Permission {
  return {
    targetType: 'role',
    targetId: 'r1',
    targetName: '角色1',
    canImport: true,
    canExport: false,
    importMode: ['insert'],
    uniqueFields: [],
    requiredFields: [],
    importFields: [],
    exportFields: [],
    _inherited: false,
    ...overrides,
  };
}

const tables = [
  { name: 'posts', title: '文章' },
  { name: 'users', title: '用户' },
  { name: 'comments', title: '评论' },
];

describe('usePermissionFilter', () => {
  it('默认返回全部权限并按继承状态分组', () => {
    const perms = [makePerm({ tableName: 'posts', _inherited: true }), makePerm({ tableName: 'users' })];
    const { result } = renderHook(() => usePermissionFilter(perms, tables, '', 10));
    expect(result.current.total).toBe(2);
    expect(result.current.inheritedPerms).toHaveLength(1);
    expect(result.current.customPerms).toHaveLength(1);
    expect(result.current.isEmpty).toBe(false);
  });

  it('按表名搜索并区分大小写不敏感', () => {
    const perms = [makePerm({ tableName: 'posts' }), makePerm({ tableName: 'comments' })];
    const { result } = renderHook(() => usePermissionFilter(perms, tables, 'POST', 10));
    expect(result.current.total).toBe(1);
    expect(result.current.filteredPerms[0].tableName).toBe('posts');
  });

  it('按中文标题搜索', () => {
    const perms = [makePerm({ tableName: 'posts' }), makePerm({ tableName: 'users' })];
    const { result } = renderHook(() => usePermissionFilter(perms, tables, '用户', 10));
    expect(result.current.total).toBe(1);
    expect(result.current.filteredPerms[0].tableName).toBe('users');
  });

  it('搜索变化时页码重置为 1', async () => {
    const perms = Array.from({ length: 15 }, (_, i) => makePerm({ tableName: `t${i}` }));
    const { result, rerender } = renderHook(({ search }) => usePermissionFilter(perms, tables, search, 10), {
      initialProps: { search: '' },
    });
    expect(result.current.page).toBe(1);
    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(result.current.page).toBe(2));
    rerender({ search: 't' });
    expect(result.current.page).toBe(1);
  });

  it('空结果时 isEmpty 为 true', () => {
    const { result } = renderHook(() => usePermissionFilter([], tables, '', 10));
    expect(result.current.total).toBe(0);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.totalPages).toBe(1);
  });
});
