import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createWrapper, createMockApi } from '../helpers/wrapper';

vi.mock('../../../client-v2/utils/api', () => ({
  useAPI: () => createMockApi().request,
}));

vi.mock('../../../client-v2/panels/task/TaskList', () => ({
  TaskList: () => <div data-testid="task-list">任务列表</div>,
}));

vi.mock('../../../client-v2/panels/task/TaskDetail', () => ({
  TaskDetail: () => null,
}));

describe('TaskPanel', () => {
  it('渲染任务列表面板', async () => {
    const TaskPanel = (await import('../../../client-v2/panels/TaskPanel')).default;
    render(<TaskPanel />, { wrapper: createWrapper() });

    expect(screen.getByTestId('task-list')).toBeInTheDocument();
  });
});
