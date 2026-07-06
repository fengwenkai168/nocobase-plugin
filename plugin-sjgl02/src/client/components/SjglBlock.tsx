import React, { Suspense, lazy } from 'react';
import { Tabs, Card } from 'antd';
import { VERSION } from '../../client-v2/panels/shared';

const ImportPanel = lazy(() => import('../../client-v2/panels/ImportPanel'));
const ExportPanel = lazy(() => import('../../client-v2/panels/ExportPanel'));
const TaskPanel = lazy(() => import('../../client-v2/panels/TaskPanel'));

export const SjglBlock = () => (
  <div style={{ padding: 16 }}>
    <div
      style={{
        background: 'linear-gradient(135deg,#1677ff,#0958d9)',
        borderRadius: 10,
        padding: '10px 20px',
        color: '#fff',
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 16 }}>📊 数据管理</div>
      <div style={{ opacity: 0.7, fontSize: 11 }}>@my-project/plugin-sjgl02 {VERSION}</div>
    </div>
    <Card style={{ borderRadius: 10, minHeight: 400 }}>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>}>
        <Tabs
          data-testid="sjgl-block-tabs"
          destroyInactiveTabPane
          items={[
            { key: 'import', label: '⬇ 导入', children: <ImportPanel /> },
            { key: 'export', label: '⬆ 导出', children: <ExportPanel /> },
            { key: 'tasks', label: '☰ 任务管理', children: <TaskPanel /> },
          ]}
        />
      </Suspense>
    </Card>
  </div>
);
