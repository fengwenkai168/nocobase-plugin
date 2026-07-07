import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTablePermission } from '../../../client-v2/hooks/useTablePermission';
import { createMockApi, createWrapper } from '../helpers';

vi.mock('@nocobase/client-v2', async () => {
  const actual = await vi.importActual('@nocobase/client-v2');
  return {
    ...actual,
    useCurrentUserContext: vi.fn(),
  };
});

import { useCurrentUserContext } from '@nocobase/client-v2';

function setContextUser(user: any) {
  (useCurrentUserContext as ReturnType<typeof vi.fn>).mockReturnValue({ data: user });
}

describe('useTablePermission', () => {
  it('管理员直接返回全部导入模式', async () => {
    setContextUser({ id: 1, roles: [{ name: 'admin' }] });
    const api = createMockApi();
    const { result } = renderHook(() => useTablePermission(api, 'posts'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowedModes).toEqual(['insert', 'update', 'upsert']);
    expect(api.calls).toHaveLength(0);
  });

  it('普通用户根据用户权限返回允许模式', async () => {
    setContextUser({ id: 2, roles: [{ name: 'member' }] });
    const api = createMockApi(({ url, params }) => {
      if (url === 'sjgl02Permissions:get' && params?.targetType === 'user') {
        return {
          custom: [{ tableName: 'posts', canImport: true, importMode: ['insert', 'update'] }],
          inherited: [],
        };
      }
      return {};
    });
    const { result } = renderHook(() => useTablePermission(api, 'posts'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowedModes).toEqual(['insert', 'update']);
  });

  it('无用户权限时合并继承权限', async () => {
    setContextUser({ id: 3, roles: [{ name: 'member' }] });
    const api = createMockApi(({ url, params }) => {
      if (url === 'sjgl02Permissions:get' && params?.targetType === 'user') {
        return {
          custom: [],
          inherited: [
            { tableName: 'posts', canImport: true, importMode: 'insert' },
            { tableName: 'posts', canImport: true, importMode: ['update'] },
          ],
        };
      }
      return {};
    });
    const { result } = renderHook(() => useTablePermission(api, 'posts'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowedModes).toEqual(['insert', 'update']);
  });

  it('无上下文用户时通过 auth:check 获取用户', async () => {
    setContextUser(null);
    const api = createMockApi(({ url }) => {
      if (url === 'auth:check') {
        return { id: 4, roles: [{ name: 'member' }] };
      }
      if (url === 'sjgl02Permissions:get') {
        return { custom: [{ tableName: 'posts', canImport: true, importMode: ['upsert'] }], inherited: [] };
      }
      return {};
    });
    const { result } = renderHook(() => useTablePermission(api, 'posts'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowedModes).toEqual(['upsert']);
  });
});
