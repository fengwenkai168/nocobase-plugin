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

vi.mock('../../../client-v2/panels/import-hooks/useImportPanel', () => ({
  useImportPanel: () => ({
    step: 0,
    loading: false,
    tables: [{ name: 'posts', title: '文章' }],
    selectedTable: null,
    setSelectedTable: vi.fn(),
    setStep: vi.fn(),
  }),
}));

describe('ImportPanel', () => {
  it('渲染导入步骤条', async () => {
    const ImportPanel = (await import('../../../client-v2/panels/ImportPanel')).default;
    render(<ImportPanel />, { wrapper: createWrapper() });

    expect(screen.getByText('选择数据表')).toBeInTheDocument();
    expect(screen.getByText('上传文件 & 字段映射')).toBeInTheDocument();
    expect(screen.getByText('预览 & 执行')).toBeInTheDocument();
  });
});
