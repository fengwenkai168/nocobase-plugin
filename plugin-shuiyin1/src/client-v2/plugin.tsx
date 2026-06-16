import { Plugin, Application } from '@nocobase/client-v2';

const WATERMARK_ID = 'shuiyin1-watermark-overlay';
const CHECK_INTERVAL = 2000;
const TIME_INTERVAL = 60000;
const REFRESH_INTERVAL = 30000;
const SETTINGS_CHANGED_EVENT = 'shuiyin1:settings:changed';

interface WatermarkSettings {
  text?: string;
  opacity?: number;
  fontSize?: number;
  showTime?: boolean;
  density?: number;
}

const defaultSettings: Required<WatermarkSettings> = {
  text: '',
  opacity: 0.15,
  fontSize: 10,
  showTime: true,
  density: 5,
};

function formatTime(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${m}`;
}

const DENSITY_SIZES: Record<number, { width: number; height: number }> = {
  1: { width: 400, height: 280 },
  2: { width: 320, height: 220 },
  3: { width: 240, height: 160 },
  4: { width: 180, height: 120 },
  5: { width: 140, height: 90 },
};

function getDensitySize(density: number): { width: number; height: number } {
  return DENSITY_SIZES[density] ?? DENSITY_SIZES[3];
}

function generateWatermarkBackground(
  text: string,
  opacity: number,
  fontSize: number,
  density: number,
): string {
  const { width, height } = getDensitySize(density);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) {
    return '';
  }
  ctx2d.clearRect(0, 0, width, height);
  ctx2d.globalAlpha = opacity;
  ctx2d.font = `${fontSize}px sans-serif`;
  ctx2d.fillStyle = '#000000';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.save();
  ctx2d.translate(width / 2, height / 2);
  ctx2d.rotate(-Math.PI / 6);
  ctx2d.fillText(text, 0, 0);
  ctx2d.restore();
  return canvas.toDataURL('image/png');
}

function applyWatermark(settings: Required<WatermarkSettings>, username: string) {
  let el = document.getElementById(WATERMARK_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = WATERMARK_ID;
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '999999',
      backgroundRepeat: 'repeat',
      opacity: '1',
    });
    document.body.appendChild(el);
  }
  const baseText = settings.text || username;
  const displayText = settings.showTime ? `${baseText} ${formatTime(new Date())}` : baseText;
  const dataUrl = generateWatermarkBackground(displayText, settings.opacity, settings.fontSize, settings.density);
  (el as HTMLElement).style.backgroundImage = `url(${dataUrl})`;
}

export class PluginShuiyin1ClientV2 extends Plugin<any, Application> {
  private settings: Required<WatermarkSettings> = { ...defaultSettings };
  private username = 'unknown';
  private checkTimer: any;
  private timeTimer: any;
  private refreshTimer: any;
  private observer: MutationObserver | null = null;

  private clearTimeTimer() {
    if (this.timeTimer) {
      window.clearInterval(this.timeTimer);
      this.timeTimer = null;
    }
  }

  private startTimeTimer() {
    this.clearTimeTimer();
    this.timeTimer = window.setInterval(() => {
      applyWatermark(this.settings, this.username);
    }, TIME_INTERVAL);
  }

  private async fetchSettings(): Promise<Required<WatermarkSettings>> {
    try {
      // eslint-disable-next-line no-console
      console.log('[shuiyin1] fetching settings...');
      const res = await this.context.api.request({
        url: 'shuiyin1_settings:list',
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        data: { __refresh: Date.now() },
      });
      // eslint-disable-next-line no-console
      console.log('[shuiyin1] raw settings response:', res);
      const record = res?.data?.data?.[0] ?? res?.data?.[0];
      if (record) {
        const settings = {
          text: record.text ?? defaultSettings.text,
          opacity: record.opacity ?? defaultSettings.opacity,
          fontSize: record.fontSize ?? defaultSettings.fontSize,
          showTime: record.showTime ?? defaultSettings.showTime,
          density: record.density ?? defaultSettings.density,
        };
        // eslint-disable-next-line no-console
        console.log('[shuiyin1] parsed settings:', settings);
        return settings;
      }
      // eslint-disable-next-line no-console
      console.warn('[shuiyin1] no settings record found, using defaults');
    } catch (err) {
      this.context.logger?.warn?.('[shuiyin1] failed to fetch settings', err);
    }
    return { ...defaultSettings };
  }

  private applyLatestSettings(settings: Required<WatermarkSettings>, reason: string) {
    this.settings = { ...defaultSettings, ...settings };
    applyWatermark(this.settings, this.username);
    this.clearTimeTimer();
    if (this.settings.showTime) {
      this.startTimeTimer();
    }
    // eslint-disable-next-line no-console
    console.log('[shuiyin1] watermark refreshed, reason:', reason, this.settings);
  }

  private async refreshWatermark(reason?: string) {
    this.settings = await this.fetchSettings();
    if (reason) {
      // eslint-disable-next-line no-console
      console.log('[shuiyin1] watermark refreshed, reason:', reason, this.settings);
    }
    applyWatermark(this.settings, this.username);
    this.clearTimeTimer();
    if (this.settings.showTime) {
      this.startTimeTimer();
    }
  }

  async load() {
    // Register plugin settings page
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

    // Fetch current user
    try {
      const userRes = await this.context.api.request({ url: 'auth:check', method: 'GET' });
      const user = userRes?.data?.data;
      this.username = user?.nickname || user?.username || user?.email || 'unknown';
    } catch (err) {
      this.context.logger?.warn?.('[shuiyin1] failed to fetch current user', err);
    }

    // Initial load
    // eslint-disable-next-line no-console
    console.log('[shuiyin1] plugin load started');
    this.settings = await this.fetchSettings();
    // eslint-disable-next-line no-console
    console.log('[shuiyin1] initial settings loaded:', this.settings);

    const start = () => {
      if (!document.body) {
        // eslint-disable-next-line no-console
        console.log('[shuiyin1] document.body not ready, waiting DOMContentLoaded');
        window.addEventListener('DOMContentLoaded', start, { once: true });
        return;
      }
      // eslint-disable-next-line no-console
      console.log('[shuiyin1] applying initial watermark with settings:', this.settings, 'username:', this.username);
      applyWatermark(this.settings, this.username);
      this.checkTimer = window.setInterval(() => {
        if (!document.getElementById(WATERMARK_ID)) {
          applyWatermark(this.settings, this.username);
        }
      }, CHECK_INTERVAL);
      if (this.settings.showTime) {
        this.startTimeTimer();
      }
      this.observer = new MutationObserver(() => {
        if (!document.getElementById(WATERMARK_ID)) {
          applyWatermark(this.settings, this.username);
        }
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    };

    start();

    // Listen for settings changes from settings page
    window.addEventListener(SETTINGS_CHANGED_EVENT, (event: Event) => {
      const detail = (event as CustomEvent<Required<WatermarkSettings>>).detail;
      if (detail) {
        this.applyLatestSettings(detail, 'settings changed');
      } else {
        this.refreshWatermark('settings changed');
      }
    });

    // Periodically refresh settings as a fallback
    this.refreshTimer = window.setInterval(() => {
      this.refreshWatermark('periodic refresh');
    }, REFRESH_INTERVAL);
  }
}

export default PluginShuiyin1ClientV2;
