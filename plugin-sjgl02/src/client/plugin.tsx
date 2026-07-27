import { Plugin } from '@nocobase/client';
import { lazy } from 'react';
import models from './models';

const SettingsPage = lazy(() => import('../client-v2/pages/SettingsPage'));

export class PluginSjgl02Client extends Plugin {
  async load() {
    this.flowEngine.registerModels(models);
    // v1 运行时（/admin 路径）设置中心入口，与 v2 的 /v/admin/settings/sjgl02 并存
    this.app.pluginSettingsManager.add('sjgl02', {
      title: this.t('数据管理 sjgl02'),
      icon: 'DatabaseOutlined',
      Component: SettingsPage,
    });
  }
}

export default PluginSjgl02Client;
