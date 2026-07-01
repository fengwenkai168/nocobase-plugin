import React, { Suspense, lazy } from 'react';
import { Tabs, Card } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { BlockModel } from '@nocobase/client-v2';
import { tExpr } from '../locale';

const ImportPanel = lazy(() => import('../../client/panels/ImportPanel'));
const ExportPanel = lazy(() => import('../../client/panels/ExportPanel'));
const TaskPanel = lazy(() => import('../../client/panels/TaskPanel'));

export class SjglBlockModel extends BlockModel {
  renderComponent() {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ background: 'linear-gradient(135deg,#1677ff,#0958d9)', borderRadius: 10, padding: '10px 20px', color: '#fff', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>📊 数据管理</div>
          <div style={{ opacity: 0.7, fontSize: 11 }}>@my-project/plugin-sjgl02</div>
        </div>
        <Card style={{ borderRadius: 10, minHeight: 400 }}>
          <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>}>
            <Tabs destroyInactiveTabPane items={[
              { key: 'import', label: '⬇ 导入', children: <ImportPanel /> },
              { key: 'export', label: '⬆ 导出', children: <ExportPanel /> },
              { key: 'tasks', label: '☰ 任务管理', children: <TaskPanel /> },
            ]} />
          </Suspense>
        </Card>
      </div>
    );
  }
}

// @ts-ignore TS 声明生成时可能无法解析 define 静态方法
SjglBlockModel.define({
  label: tExpr('数据管理'),
  icon: DatabaseOutlined,
});
