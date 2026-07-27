import { Plugin } from '@nocobase/client';
import { ShuiyinSettings } from './pages/ShuiyinSettings';
import { createWatermarkController, WatermarkController } from '../common/watermark-controller';

export class PluginShuiyin1Client extends Plugin {
  private controller: WatermarkController | null = null;

  async load() {
    this.pluginSettingsManager.add('shuiyin1', {
      title: this.t('Watermark Settings'),
      icon: 'CopyrightOutlined',
      Component: ShuiyinSettings,
    });

    this.controller = createWatermarkController(this.app.apiClient.request.bind(this.app.apiClient));
    this.controller.load();
  }

  async afterDisable() {
    this.controller?.cleanup();
    this.controller = null;
  }
}
