import React from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';
import { VERSION } from './shared';
import ImportPanel from './ImportPanel';
import ExportPanel from './ExportPanel';
import TaskPanel from './TaskPanel';

export default function Sjgl02Block() {
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
      <Tabs
        destroyInactiveTabPane
        items={[
          { key: 'import', label: `⬇ ${t('Import')}`, children: <ImportPanel /> },
          { key: 'export', label: `⬆ ${t('Export')}`, children: <ExportPanel /> },
          { key: 'tasks', label: `☰ ${t('Task Management')}`, children: <TaskPanel /> },
        ]}
      />
    </div>
  );
}
