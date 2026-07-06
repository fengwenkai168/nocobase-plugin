import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAPI } from '../../utils/api';
import { createWrapper } from '../helpers';

vi.mock('@nocobase/client-v2', async () => {
  const actual = await vi.importActual('@nocobase/client-v2');
  return {
    ...actual,
    useApp: vi.fn(),
  };
});

import { useApp } from '@nocobase/client-v2';

describe('useAPI', () => {
  it('优先返回 apiClient', () => {
    const apiClient = { request: vi.fn() };
    (useApp as ReturnType<typeof vi.fn>).mockReturnValue({ apiClient });
    const { result } = renderHook(() => useAPI(), { wrapper: createWrapper() });
    expect(result.current).toBe(apiClient);
  });

  it('没有 apiClient 时返回 app 自身', () => {
    const app = { request: vi.fn() };
    (useApp as ReturnType<typeof vi.fn>).mockReturnValue(app);
    const { result } = renderHook(() => useAPI(), { wrapper: createWrapper() });
    expect(result.current).toBe(app);
  });
});
