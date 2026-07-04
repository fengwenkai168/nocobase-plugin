import { Plugin } from '@nocobase/client';
import { SchemaSettings } from '@nocobase/client';
import { SchemaSettingsBlockTitleItem } from '@nocobase/client';
import { SchemaSettingsBlockHeightItem } from '@nocobase/client';
import { SchemaSettingsLinkageRules, LinkageRuleCategory } from '@nocobase/client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SjglBlockModel } from '../client-v2/models/SjglBlockModel';
import { SjglBlock } from './components/SjglBlock';
import { Sjgl02BlockInitializer } from '../client-v2/panels/Sjgl02BlockInitializer';
import Sjgl02SettingsPageV1 from '../client-v2/pages/Sjgl02SettingsPage';

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

export class PluginSjgl02Client extends Plugin {
  async load() {
    this.flowEngine.registerModels({ SjglBlockModel });
    this.app.schemaSettingsManager.add(sjgl02BlockSettings);
    this.pluginSettingsManager.add('sjgl02', {
      title: '数据管理',
      icon: 'DatabaseOutlined',
      Component: Sjgl02SettingsPageV1,
    });
    this.app.addComponents({ SjglBlock, Sjgl02BlockInitializer });
    this.app.schemaInitializerManager.addItem('page:addBlock', 'otherBlocks.sjgl02Block', {
      title: '{{t("数据管理")}}',
      Component: 'Sjgl02BlockInitializer',
    });
    this.app.schemaInitializerManager.addItem('popup:common:addBlock', 'otherBlocks.sjgl02Block', {
      title: '{{t("数据管理")}}',
      Component: 'Sjgl02BlockInitializer',
    });
    this.app.schemaInitializerManager.addItem('RecordBlockInitializers', 'otherBlocks.sjgl02Block', {
      title: '{{t("数据管理")}}',
      Component: 'Sjgl02BlockInitializer',
    });
    this.app.schemaInitializerManager.addItem('mobile:addBlock', 'otherBlocks.sjgl02Block', {
      title: '{{t("数据管理")}}',
      Component: 'Sjgl02BlockInitializer',
    });
  }
}

export default PluginSjgl02Client;
