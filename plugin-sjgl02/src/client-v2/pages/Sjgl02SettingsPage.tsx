import React, { useState, useEffect } from 'react';
import { Card, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';

const TABS = {
  import: { key: 'import', label: '⬇ 导入', loader: () => import('../../client/panels/ImportPanel') },
  export: { key: 'export', label: '⬆ 导出', loader: () => import('../../client/panels/ExportPanel') },
  tasks: { key: 'tasks', label: '☰ 任务管理', loader: () => import('../../client/panels/TaskPanel') },
  permissions: { key: 'permissions', label: '✓ 权限管理', loader: () => import('./PermissionTab') },
};

export default function Sjgl02SettingsPage() {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [activeKey, setActiveKey] = useState('import');

  const tabItems = Object.values(TABS).map((tab) => ({
    key: tab.key,
    label: <span>{tab.label}</span>,
    children: tab.key === activeKey ? (
      <TabRenderer key={tab.key} loader={tab.loader} />
    ) : (
      <div style={{ minHeight: 400 }} />
    ),
  }));

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{
        background: 'linear-gradient(135deg,#1677ff,#0958d9)',
        borderRadius: 12,
        padding: '14px 24px',
        color: '#fff',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>📊 {t('Data Management')}</div>
          <div style={{ opacity: 0.8, fontSize: 12, marginTop: 2 }}>
            {t('Import')} · {t('Export')} · {t('Task Management')} · {t('Permission Management')}
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 20,
          padding: '4px 14px',
          fontSize: 11,
        }}>
          @my-project/plugin-sjgl02 v1.0.53
        </div>
      </div>
      <Card style={{ borderRadius: 10, minHeight: 600 }}>
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
}

function TabRenderer({ loader }: {
  loader: () => Promise<{ default: React.ComponentType }>;
}) {
  const [Comp, setComp] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    loader().then((mod) => {
      if (!cancelled) setComp(() => mod.default);
    });
    return () => { cancelled = true; };
  }, [loader]);

  if (!Comp) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>;
  return <Comp />;
}
