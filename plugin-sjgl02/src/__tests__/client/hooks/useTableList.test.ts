import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTableList } from '../../../client-v2/hooks/useTableList';
import { createMockApi, createWrapper } from '../helpers';

describe('useTableList', () => {
  it('加载并返回表列表', async () => {
    const api = createMockApi(({ url }) => {
      if (url === 'sjgl02Permissions:tables') {
        return [
          { name: 'posts', title: '文章' },
          { name: 'users', title: '用户' },
        ];
      }
      return {};
    });
    const { result } = renderHook(() => useTableList(api), { wrapper: createWrapper() });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tables).toEqual([
      { name: 'posts', title: '文章' },
      { name: 'users', title: '用户' },
    ]);
  });

  it('非数组响应不更新表列表', async () => {
    const api = createMockApi(() => ({ invalid: true }));
    const { result } = renderHook(() => useTableList(api), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tables).toEqual([]);
  });

  it('请求失败时保持空列表', async () => {
    const api = {
      request: () => Promise.reject(new Error('network error')),
    };
    const { result } = renderHook(() => useTableList(api), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tables).toEqual([]);
  });
});
