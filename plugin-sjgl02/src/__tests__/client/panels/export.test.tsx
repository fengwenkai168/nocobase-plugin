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

vi.mock('../../../client-v2/panels/export-hooks/useExportPanel', () => ({
  useExportPanel: () => ({
    step: 0,
    loading: false,
    tables: [{ name: 'posts', title: '文章' }],
    selTable: null,
    handleSelectTable: vi.fn(),
    setStep: vi.fn(),
  }),
}));

describe('ExportPanel', () => {
  it('渲染导出步骤条', async () => {
    const ExportPanel = (await import('../../../client-v2/panels/ExportPanel')).default;
    render(<ExportPanel />, { wrapper: createWrapper() });

    expect(screen.getByText('选择数据表')).toBeInTheDocument();
    expect(screen.getByText('选择字段 & 配置')).toBeInTheDocument();
    expect(screen.getByText('执行导出')).toBeInTheDocument();
  });
});
