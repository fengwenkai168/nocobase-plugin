import React, { useState } from 'react';
import { Card, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFlowContext } from '@nocobase/flow-engine';
import { NAMESPACE } from '../locale';

const TABS = {
  import: { key: 'import', label: '⬇ 导入', loader: () => import('./ImportTab') },
  export: { key: 'export', label: '⬆ 导出', loader: () => import('./ExportTab') },
  tasks: { key: 'tasks', label: '☰ 任务管理', loader: () => import('./TaskTab') },
  permissions: { key: 'permissions', label: '✓ 权限管理', loader: () => import('./PermissionTab') },
};

export default function Sjgl02SettingsPage() {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const ctx = useFlowContext();
  const [activeKey, setActiveKey] = useState('import');

  const tabItems = Object.values(TABS).map((tab) => ({
    key: tab.key,
    label: <span>{tab.label}</span>,
    children: (
      <LazyTab tabKey={tab.key} activeKey={activeKey} loader={tab.loader} ctx={ctx} />
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
          @my-project/plugin-sjgl02 v1.0.0
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

function LazyTab({ tabKey, activeKey, loader, ctx }: {
  tabKey: string;
  activeKey: string;
  loader: () => Promise<any>;
  ctx: any;
}) {
  const [Comp, setComp] = React.useState<any>(null);

  React.useEffect(() => {
    if (activeKey === tabKey && !Comp) {
      loader().then((mod) => setComp(() => mod.default));
    }
  }, [activeKey, tabKey, loader, Comp]);

  if (activeKey !== tabKey) return null;
  if (!Comp) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>;
  return <Comp ctx={ctx} />;
}
