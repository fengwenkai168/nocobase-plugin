import React, { Suspense, lazy } from 'react';
import { Tabs, Card } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { BlockModel } from '@nocobase/client-v2';
import { useTranslation } from 'react-i18next';
import { tExpr, NAMESPACE } from '../locale';
import { VERSION } from '../panels/shared';

const ImportPanel = lazy(() => import('../panels/ImportPanel'));
const ExportPanel = lazy(() => import('../panels/ExportPanel'));
const TaskPanel = lazy(() => import('../panels/TaskPanel'));

export class SjglBlockModel extends BlockModel {
  renderComponent() {
    return <SjglBlockContent />;
  }
}

function SjglBlockContent() {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  return (
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
        <div style={{ fontWeight: 600, fontSize: 16 }}>📊 {t('Data Management')}</div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>@my-project/plugin-sjgl02 {VERSION}</div>
      </div>
      <Card style={{ borderRadius: 10, minHeight: 400 }}>
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>{t('Loading')}...</div>}>
          <Tabs
            destroyInactiveTabPane
            items={[
              { key: 'import', label: `⬇ ${t('Import')}`, children: <ImportPanel /> },
              { key: 'export', label: `⬆ ${t('Export')}`, children: <ExportPanel /> },
              { key: 'tasks', label: `☰ ${t('Task Management')}`, children: <TaskPanel /> },
            ]}
          />
        </Suspense>
      </Card>
    </div>
  );
}

// @ts-expect-error TS 声明生成时可能无法解析 define 静态方法
SjglBlockModel.define({
  label: tExpr('Data Management'),
  icon: DatabaseOutlined,
});
