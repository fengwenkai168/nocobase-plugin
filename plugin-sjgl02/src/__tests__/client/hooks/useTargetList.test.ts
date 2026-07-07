import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTargetList } from '../../../client-v2/hooks/useTargetList';
import { createMockApi, createWrapper } from '../helpers';

describe('useTargetList', () => {
  it('合并用户和角色并过滤空 id', async () => {
    const api = createMockApi(({ url }) => {
      if (url === 'sjgl02Permissions:userRoleList') {
        return {
          users: [
            { id: 1, nickname: '用户1', roles: [{ name: 'member', title: '成员' }] },
            { id: 2, name: '用户2', roles: [] },
          ],
          roles: [
            { name: 'admin', title: '管理员' },
            { name: '', title: '空角色' },
          ],
        };
      }
      return {};
    });
    const { result } = renderHook(() => useTargetList(api), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targets).toHaveLength(3);
    expect(result.current.targets[0]).toMatchObject({ id: '1', type: 'user', nickname: '用户1' });
    expect(result.current.targets[1]).toMatchObject({ id: '2', type: 'user', nickname: '用户2' });
    expect(result.current.targets[2]).toMatchObject({ id: 'admin', type: 'role', nickname: '管理员' });
  });

  it('请求失败返回空列表', async () => {
    const api = { request: () => Promise.reject(new Error('fail')) };
    const { result } = renderHook(() => useTargetList(api), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targets).toEqual([]);
  });
});
