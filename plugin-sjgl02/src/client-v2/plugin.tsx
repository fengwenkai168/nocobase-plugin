import { Application, Plugin } from '@nocobase/client-v2';

export class PluginSjgl02ClientV2 extends Plugin<any, Application> {
  async load() {
    this.flowEngine.registerModelLoaders({
      Sjgl02BlockModel: {
        loader: () => import('./models/Sjgl02BlockModel'),
      },
    });

    this.pluginSettingsManager.addMenuItem({
      key: 'sjgl02',
      title: this.t('Data Management sjgl02'),
      icon: 'DatabaseOutlined',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'sjgl02',
      key: 'index',
      title: this.t('Data Management sjgl02'),
      componentLoader: () => import('./pages/SettingsPage'),
    });
  }
}

export default PluginSjgl02ClientV2;
