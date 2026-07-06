import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePermissions } from '../../hooks/usePermissions';
import { createMockApi, createWrapper } from '../helpers';
import type { Permission, Target } from '../../types/permission';

const target: Target = { id: 'r1', nickname: '测试角色', type: 'role' };

function makePerm(tableName: string, inherited = false): Permission {
  return {
    targetType: 'role',
    targetId: 'r1',
    targetName: '测试角色',
    tableName,
    canImport: true,
    canExport: false,
    importMode: ['insert'],
    uniqueFields: [],
    requiredFields: [],
    importFields: [],
    exportFields: [],
    _inherited: inherited,
  };
}

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载并合并自定义与继承权限', async () => {
    const api = createMockApi(({ url }) => {
      if (url === 'sjgl02Permissions:get') {
        return {
          custom: [makePerm('posts')],
          inherited: [makePerm('users', true)],
        };
      }
      return {};
    });
    const { result } = renderHook(() => usePermissions(api, target), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.perms).toHaveLength(2);
    expect(result.current.customPerms).toHaveLength(1);
    expect(result.current.inheritedPerms).toHaveLength(1);
    expect(result.current.isSystemManaged).toBe(false);
  });

  it('继承权限按表名去重', async () => {
    const api = createMockApi(({ url }) => {
      if (url === 'sjgl02Permissions:get') {
        return {
          custom: [],
          inherited: [makePerm('posts', true), makePerm('posts', true)],
        };
      }
      return {};
    });
    const { result } = renderHook(() => usePermissions(api, target), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.inheritedPerms).toHaveLength(1);
  });

  it('切换权限时仅对自定义权限生效并自动保存', async () => {
    const api = createMockApi(({ url }) => {
      if (url === 'sjgl02Permissions:get') {
        return { custom: [makePerm('posts')], inherited: [] };
      }
      return {};
    });
    const { result } = renderHook(() => usePermissions(api, target), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.toggle('posts', 'canExport');
    });
    await waitFor(() => expect(result.current.perms[0].canExport).toBe(true));
    const saveCall = api.calls.find((c) => c.url === 'sjgl02Permissions:save');
    expect(saveCall).toBeDefined();
    expect(saveCall?.data?.permissions[0]).toMatchObject({ tableName: 'posts', canExport: true });
  });

  it('删除自定义权限并保留继承权限', async () => {
    const api = createMockApi(({ url }) => {
      if (url === 'sjgl02Permissions:get') {
        return {
          custom: [makePerm('posts')],
          inherited: [makePerm('posts', true)],
        };
      }
      return {};
    });
    const { result } = renderHook(() => usePermissions(api, target), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.remove('posts');
    });
    await waitFor(() => expect(result.current.customPerms).toHaveLength(0));
    expect(result.current.inheritedPerms).toHaveLength(1);
  });

  it('保存新增权限', async () => {
    const api = createMockApi(({ url }) => {
      if (url === 'sjgl02Permissions:get') return { custom: [], inherited: [] };
      return {};
    });
    const { result } = renderHook(() => usePermissions(api, target), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const values = {
      tableName: 'comments',
      canImport: true,
      canExport: true,
      importMode: ['insert', 'update'],
      uniqueFields: [],
      requiredFields: [],
      importFields: [],
      exportFields: [],
    };
    let saved = false;
    await act(async () => {
      saved = await result.current.save(values);
    });
    expect(saved).toBe(true);
    const saveCall = api.calls.find((c) => c.url === 'sjgl02Permissions:save');
    expect(saveCall?.data?.permissions[0]).toMatchObject({ ...values, targetType: 'role', targetId: 'r1' });
  });
});
