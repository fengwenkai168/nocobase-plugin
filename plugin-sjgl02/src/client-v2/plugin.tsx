import { Plugin } from '@nocobase/client-v2';

export class PluginSjgl02Client extends Plugin {
  async load() {
    this.pluginSettingsManager.addMenuItem({
      key: 'sjgl02',
      title: this.t('Data Management'),
      icon: 'DatabaseOutlined',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'sjgl02',
      key: 'index',
      title: this.t('Data Management'),
      componentLoader: () => import('./pages/Sjgl02SettingsPage'),
    });
    th