import { Plugin } from '@nocobase/client';
import { SchemaSettings } from '@nocobase/client';
import { SchemaSettingsBlockTitleItem } from '@nocobase/client';
import { SchemaSettingsBlockHeightItem } from '@nocobase/client';
import { SchemaSettingsLinkageRules, LinkageRuleCategory } from '@nocobase/client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Tabs } from 'antd';
import ImportPanel from './panels/ImportPanel';
import ExportPanel from './panels/ExportPanel';
import TaskPanel from './panels/TaskPanel';
import PermissionPanel from './panels/PermissionPanel';
import Sjgl02Block from './panels/Sjgl02Block';
import { Sjgl02BlockInitializer } from './panels/Sjgl02BlockInitializer';
import { VERSION } from './panels/shared';
import { SjglBlockModel } from '../client-v2/models/SjglBlockModel';

const sjgl02BlockSettings = new SchemaSettings({
  name: 'blockSettings:sjgl02',
  items: [
    {
      name: 'setBlockTitle',
      Component: SchemaSettingsBlockTitleItem,
    },
    {
      name: 'setBlockHeight',
      Component: SchemaSettingsBlockHeightItem,
    },
    {
      name: 'blockLinkageRules',
      Component: SchemaSettingsLinkageRules,
      useComponentProps() {
        const { t } = useTranslation();
        return {
          category: LinkageRuleCategory.block,
        };
      },
    },
    {
      name: 'divider',
      type: 'divider',
    },
    {
      name: 'remove',
      type: 'remove',
      componentProps: {
        removeParentsIfNoChildren: true,
        breakRemoveOn: { 'x-component': 'Grid' },
      },
    },
  ],
});

function Sjgl02SettingsPageV1() {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{
        background: 'linear-gradient(135deg,#1677ff,#0958d9)', borderRadius: 12,
        padding: '14px 24px', color: '#fff', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>📊 数据管理</div>
          <div style={{ opacity: 0.8, fontSize: 12, marginTop: 2 }}>导入 · 导出 · 任务管理 · 权限管理</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 14px', fontSize: 11 }}>
          @my-project/plugin-sjgl02 {VERSION}
        </div>
      </div>
      <Card style={{ borderRadius: 10, minHeight: 600 }}>
        <Tabs destroyInactiveTabPane items={[
          { key: 'import', label: '⬇ 导入', children: <ImportPanel /> },
          { key: 'export', label: '⬆ 导出', children: <ExportPanel /> },
          { key: 'tasks', label: '☰ 任务管理', children: <TaskPanel /> },
          { key: 'permissions', label: '✓ 权限管理', children: <PermissionPanel /> },
        ]} />
      </Card>
    </div>
  );
}

export class PluginSjgl02Client extends Plugin {
  async load() {
    this.flowEngine.registerModels({ SjglBlockModel });
    this.app.schemaSettingsManager.add(sjgl02BlockSettings);
    this.pluginSettingsManager.add('sjgl02', {
      title: '数据管理',
      icon: 'DatabaseOutlined',
      Component: Sjgl02SettingsPageV1,
    });
    this.app.addComponents({ SjglBlock: Sjgl02Block, Sjgl02BlockInitializer });
    this.app.schemaInitializerManager.addItem('page:addBlock', 'otherBlocks.sjgl02Block', { title: '{{t("数据管理")}}', Component: 'Sjgl02BlockInitializer' });
    this.app.schemaInitializerManager.addItem('popup:common:addBlock', 'otherBlocks.sjgl02Block', { title: '{{t("数据管理")}}', Component: 'Sjgl02BlockInitializer' });
    this.app.schemaInitializerManager.addItem('RecordBlockInitializers', 'otherBlocks.sjgl02Block', { title: '{{t("数据管理")}}', Component: 'Sjgl02BlockInitializer' });
    this.app.schemaInitializerManager.addItem('mobile:addBlock', 'otherBlocks.sjgl02Block', { title: '{{t("数据管理")}}', Component: 'Sjgl02BlockInitializer' });
  }
}

export default PluginSjgl02Client;
