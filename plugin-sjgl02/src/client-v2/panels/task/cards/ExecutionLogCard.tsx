import React from 'react';
import { ExecutionLogViewer } from '../ExecutionLogViewer';

export function ExecutionLogCard({ task, api }: any) {
  if (!task || !task.id) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <ExecutionLogViewer api={api} taskId={task.id} status={task.status} />
    </div>
  );
}
