import { describe, expect, it } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTableFields } from '../../../client-v2/hooks/useTableFields';
import { createMockApi, createWrapper } from '../helpers';

describe('useTableFields', () => {
  it('加载并格式化字段列表', async () => {
    const api = createMockApi(({ url, params }) => {
      if (url === 'sjgl02Import:tableFields' && params?.tableName === 'posts') {
        return [
          { name: 'title', type: 'string', uiSchema: { title: '标题' }, interface: 'input' },
          { name: 'content', type: 'text', uiSchema: {}, interface: 'textarea' },
        ];
      }
      return [];
    });
    const { result } = renderHook(() => useTableFields(api), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.loadFields('posts');
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fields).toEqual([
      {
        name: 'title',
        label: '标题(title)',
        type: 'string',
        interface: 'input',
        uiSchema: { title: '标题' },
        isAssociation: undefined,
      },
      {
        name: 'content',
        label: 'content(content)',
        type: 'text',
        interface: 'textarea',
        uiSchema: {},
        isAssociation: undefined,
      },
    ]);
  });

  it('空表名清空字段', async () => {
    const api = createMockApi();
    const { result } = renderHook(() => useTableFields(api), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.loadFields('');
    });
    expect(result.current.fields).toEqual([]);
    expect(api.calls).toHaveLength(0);
  });

  it('请求失败时清空字段', async () => {
    const api = {
      request: () => Promise.reject(new Error('fail')),
    };
    const { result } = renderHook(() => useTableFields(api), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.loadFields('posts');
    });
    expect(result.current.fields).toEqual([]);
  });
});
