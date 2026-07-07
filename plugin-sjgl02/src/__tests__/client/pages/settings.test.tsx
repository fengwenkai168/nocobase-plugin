import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Sjgl02SettingsPage from '../../../client-v2/pages/Sjgl02SettingsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('Sjgl02SettingsPage', () => {
  it('渲染 4 个标签页', () => {
    render(<Sjgl02SettingsPage />);

    expect(screen.getByText('Data Management')).toBeInTheDocument();
    expect(screen.getByText(/导入/)).toBeInTheDocument();
    expect(screen.getByText(/导出/)).toBeInTheDocument();
    expect(screen.getByText(/任务管理/)).toBeInTheDocument();
    expect(screen.getByText(/权限管理/)).toBeInTheDocument();
  });
});
