import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createWrapper, createMockApi } from '../helpers/wrapper';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../client-v2/utils/api', () => ({
  useAPI: () => createMockApi().request,
}));

vi.mock('../../../client-v2/hooks', () => ({
  useTargetList: () => ({ targets: [], loading: false }),
  useTableList: () => ({ tables: [] }),
  useViewScope: () => ({ viewScope: 'own', setViewScope: vi.fn() }),
  useTableFields: () => ({ fields: [], loading: false, loadFields: vi.fn() }),
  usePermissions: () => ({
    perms: [],
    inheritedPerms: [],
    customPerms: [],
    loading: false,
    isSystemManaged: false,
    toggle: vi.fn(),
    remove: vi.fn(),
    save: vi.fn(),
  }),
  usePermissionFilter: () => ({
    isEmpty: true,
    inheritedPerms: [],
    customPerms: [],
    page: 1,
    setPage: vi.fn(),
  }),
}));

describe('PermissionPanel', () => {
  it('渲染权限管理面板基础结构', async () => {
    const PermissionPanel = (await import('../../../client-v2/panels/PermissionPanel')).default;
    render(<PermissionPanel />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText('搜索用户/角色')).toBeInTheDocument();
  });
});
