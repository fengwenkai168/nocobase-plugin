import React, { useRef, useState } from 'react';
import { Modal, Tabs, Tag } from 'antd';
import { useT } from '../locale';
import TaskCenter from '../components/task-center/TaskCenter';
import ImportWizard from '../components/import-wizard/ImportWizard';
import ExportWizard from '../components/export-wizard/ExportWizard';
import PermManager from '../components/perm-manager/PermManager';
// @ts-ignore
import pkg from '../../../package.json';

export default function SettingsPage({ showPermissionTab = true }: { showPermissionTab?: boolean }) {
  const t = useT();
  const [activeKey, setActiveKey] = useState('import');
  const [refreshKeys, setRefreshKeys] = useState({ import: 0, export: 0, tasks: 0, permissions: 0 });
  // 按 Tab 注册的脏检查：仅在离开该 Tab 或切回该 Tab（旧实例仍脏、将被重置）时触发确认
  const dirtyChecks = useRef<Record<string, () => boolean>>({});

  const registerDirtyCheck = (tabKey: string, fn: () => boolean) => {
    dirtyChecks.current[tabKey] = fn;
    return () => {
      if (dirtyChecks.current[tabKey] === fn) delete dirtyChecks.current[tabKey];
    };
  };

  const activate = (key: string) => {
    // 每次激活 Tab 都重挂载对应组件：向导回到步骤 1 且状态清空，任务/权限刷新数据
    setRefreshKeys((prev) => ({ ...prev, [key]: prev[key as keyof typeof prev] + 1 }));
    setActiveKey(key);
  };

  const onTabClick = (key: string, e: React.MouseEvent | React.KeyboardEvent) => {
    if (key === activeKey) return;
    const leavingDirty = dirtyChecks.current[activeKey]?.();
    const targetDirty = dirtyChecks.current[key]?.();
    if (leavingDirty || targetDirty) {
      e.preventDefault?.();
      Modal.confirm({
        title: t('当前配置未保存'),
        content: t('确认离开？离开后已填写的配置将丢失。'),
        onOk: () => activate(key),
      });
      return;
    }
    activate(key);
  };

  const items = [
    {
      key: 'import',
      label: `⬇ ${t('Import')}`,
      children: <ImportWizard key={`import-${refreshKeys.import}`} registerDirtyCheck={registerDirtyCheck} />,
    },
    {
      key: 'export',
      label: `⬆ ${t('Export')}`,
      children: <ExportWizard key={`export-${refreshKeys.export}`} registerDirtyCheck={registerDirtyCheck} />,
    },
    { key: 'tasks', label: `☰ ${t('Task Management')}`, children: <TaskCenter key={`tasks-${refreshKeys.tasks}`} /> },
    ...(showPermissionTab
      ? [
          {
            key: 'permissions',
            label: `✓ ${t('Permission Management')}`,
            children: <PermManager key={`perms-${refreshKeys.permissions}`} />,
          },
        ]
      : []),
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100%' }}>
      <div
        style={{
          background: 'linear-gradient(135deg,#1677ff,#0958d9)',
          borderRadius: 12,
          padding: '12px 24px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#fff',
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>📊 {t('Data Management sjgl02')}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{t('导入导出 · 任务管理 · 表级权限控制')}</div>
        </div>
        <Tag
          style={{
            background: 'rgba(255,255,255,.2)',
            border: 'none',
            color: '#fff',
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 12,
          }}
        >
          数据管理-sjgl02 v{pkg.version}
        </Tag>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24 }}>
        <Tabs activeKey={activeKey} onTabClick={onTabClick} items={items} />
      </div>
    </div>
  );
}
