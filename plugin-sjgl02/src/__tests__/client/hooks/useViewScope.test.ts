import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useViewScope } from '../../../client-v2/hooks/useViewScope';
import { createMockApi, createWrapper } from '../helpers';

describe('useViewScope', () => {
  it('加载设置并应用 taskViewScope', async () => {
    const api = createMockApi(({ url }) => {
      if (url === 'sjgl02Permissions:settings') return { taskViewScope: 'mine' };
      return {};
    });
    const { result } = renderHook(() => useViewScope(api), { wrapper: createWrapper() });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.viewScope).toBe('mine');
  });

  it('针对用户目标时携带 userId 参数', async () => {
    const api = createMockApi(({ url, params }) => {
      if (url === 'sjgl02Permissions:settings') {
        return { taskViewScope: 'all', userId: params?.userId };
      }
      return {};
    });
    const { result } = renderHook(() => useViewScope(api, { type: 'user', id: '42' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.viewScope).toBe('all');
  });

  it('切换视图范围时提交保存', async () => {
    const api = createMockApi(({ url, data }) => {
      if (url === 'sjgl02Permissions:saveSettings') return { saved: data };
      if (url === 'sjgl02Permissions:settings') return { taskViewScope: 'all' };
      return {};
    });
    const { result } = renderHook(() => useViewScope(api, { type: 'user', id: '42' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setViewScope('mine');
    });
    await waitFor(() => expect(result.current.viewScope).toBe('mine'));
    const saveCall = api.calls.find((c) => c.url === 'sjgl02Permissions:saveSettings');
    expect(saveCall).toBeDefined();
    expect(saveCall?.data).toMatchObject({ taskViewScope: 'mine', userId: '42' });
  });
});
