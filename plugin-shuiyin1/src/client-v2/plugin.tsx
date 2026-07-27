import { Plugin } from '@nocobase/client-v2';
import { createWatermarkController, WatermarkController } from '../common/watermark-controller';

export class PluginShuiyin1ClientV2 extends Plugin {
  private controller: WatermarkController | null = null;

  async load() {
    this.pluginSettingsManager.addMenuItem({
      key: 'shuiyin1',
      title: this.t('Watermark Settings'),
      icon: 'CopyrightOutlined',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'shuiyin1',
      key: 'index',
      title: this.t('Watermark Settings'),
      componentLoader: () => import('./pages/ShuiyinSettings'),
    });

    this.controller = createWatermarkController(this.app.apiClient.request.bind(this.app.apiClient));
    this.controller.load();
  }
}

export default PluginShuiyin1ClientV2;
