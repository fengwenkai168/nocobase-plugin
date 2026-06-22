import { Plugin } from '@nocobase/client';
import { ShuiyinSettings } from '../client/pages/ShuiyinSettings';

const WATERMARK_ID = 'shuiyin1-watermark-overlay';

const defaultSettings = {
  text: '',
  opacity: 0.15,
  fontSize: 10,
  showTime: true,
  density: 5,
};

const authPages = [
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

function isAuthPage() {
  const path = window.location.pathname;
  return authPages.some((p) => path === p || path.startsWith(p + '/'));
}

const densityMap: Record<number, { width: number; height: number }> = {
  1: { width: 400, height: 280 },
  2: { width: 320, height: 220 },
  3: { width: 240, height: 160 },
  4: { width: 180, height: 120 },
  5: { width: 140, height: 90 },
};

function renderWatermark(
  settings: typeof defaultSettings,
  username: string,
) {
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

  const text = settings.text || username;
  const displayText = settings.showTime
    ? `${text} ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    : text;
  const { width, height } = densityMap[settings.density] || densityMap[3];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = settings.opacity;
  ctx.font = `${settings.fontSize}px sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillText(displayText, 0, 0);
  ctx.restore();

  el.style.backgroundImage = `url(${canvas.toDataURL('image/png')})`;
}

export class PluginShuiyin1ClientV2 extends Plugin {
  settings = { ...defaultSettings };
  username = 'unknown';
  private checkTimer: number | undefined;
  private timeTimer: number | undefined;
  private refreshTimer: number | undefined;
  private observer: MutationObserver | null = null;

  private clearTimeTimer() {
    if (this.timeTimer) {
      window.clearInterval(this.timeTimer);
      this.timeTimer = undefined;
    }
  }

  private startTimeTimer() {
    this.clearTimeTimer();
    this.timeTimer = window.setInterval(() => {
      renderWatermark(this.settings, this.username);
    }, 60000);
  }

  private async fetchSettings() {
    try {
      console.log('[shuiyin1] fetching settings...');
      const res = await this.app.apiClient.request({
        url: 'shuiyin1_settings:list',
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        data: { __refresh: Date.now() },
      });
      console.log('[shuiyin1] raw settings response:', res);
      const record = res?.data?.data?.[0] || res?.data?.[0];
      if (record) {
        const parsed = {
          text: record.text ?? defaultSettings.text,
          opacity: record.opacity ?? defaultSettings.opacity,
          fontSize: record.fontSize ?? defaultSettings.fontSize,
          showTime: record.showTime ?? defaultSettings.showTime,
          density: record.density ?? defaultSettings.density,
        };
        console.log('[shuiyin1] parsed settings:', parsed);
        return parsed;
      }
      console.warn('[shuiyin1] no settings record found, using defaults');
    } catch (err) {
      console.warn('[shuiyin1] failed to fetch settings', err);
    }
    return { ...defaultSettings };
  }

  private async refreshWatermark(reason?: string, newSettings?: typeof defaultSettings) {
    const s = this;
    let settings: typeof defaultSettings;
    if (newSettings) {
      settings = { ...defaultSettings, ...newSettings };
    } else {
      settings = await this.fetchSettings();
    }
    s.settings = settings;
    if (reason) console.log('[shuiyin1] watermark refreshed, reason:', reason, settings);
    renderWatermark(settings, this.username);
    this.clearTimeTimer();
    if (settings.showTime) this.startTimeTimer();
  }

  private applyLatestSettings(settings: typeof defaultSettings, reason: string) {
    this.settings = { ...defaultSettings, ...settings };
    renderWatermark(this.settings, this.username);
    this.clearTimeTimer();
    if (this.settings.showTime) this.startTimeTimer();
    console.log('[shuiyin1] watermark refreshed, reason:', reason, this.settings);
  }

  async load() {
    const self = this;

    // 始终注册设置菜单（修复：登录页面刷新后登录，菜单和水印不显示的问题）
    this.pluginSettingsManager.add('shuiyin1', {
      title: this.t('Watermark Settings'),
      icon: 'CopyrightOutlined',
      Component: ShuiyinSettings,
    });

    if (isAuthPage()) {
      // 认证页面：等待用户登录后再初始化水印
      let initialized = false;
      const tryInit = () => {
        if (initialized) return;
        if (!isAuthPage()) {
          initialized = true;
          self.startup();
        }
      };
      window.addEventListener('popstate', tryInit);
      const origPushState = history.pushState;
      history.pushState = function (...args) {
        origPushState.apply(this, args);
        tryInit();
      };
      const frameCheck = () => {
        tryInit();
        if (!initialized) requestAnimationFrame(frameCheck);
      };
      requestAnimationFrame(frameCheck);
      return;
    }

    // 非认证页面：直接初始化
    self.startup();
  }

  private async startup() {
    const self = this;

    try {
      const res = await this.app.apiClient.request({ url: 'auth:check', method: 'GET' });
      const user = res?.data?.data;
      this.username = user?.nickname || user?.username || user?.email || 'unknown';
    } catch (err) {
      console.warn('[shuiyin1] failed to fetch current user', err);
    }

    console.log('[shuiyin1] plugin load started');
    self.settings = await this.fetchSettings();
    console.log('[shuiyin1] initial settings loaded:', this.settings);

    const initWatermark = () => {
      if (!document.body) {
        console.log('[shuiyin1] document.body not ready, waiting DOMContentLoaded');
        window.addEventListener('DOMContentLoaded', initWatermark, { once: true });
        return;
      }
      console.log('[shuiyin1] applying initial watermark with settings:', self.settings, 'username:', self.username);
      renderWatermark(self.settings, self.username);

      self.checkTimer = window.setInterval(() => {
        if (!document.getElementById(WATERMARK_ID)) {
          renderWatermark(self.settings, self.username);
        }
      }, 2000);

      if (self.settings.showTime) self.startTimeTimer();

      self.observer = new MutationObserver(() => {
        if (!document.getElementById(WATERMARK_ID)) {
          renderWatermark(self.settings, self.username);
        }
      });
      self.observer.observe(document.body, { childList: true, subtree: true });
    };

    initWatermark();

    window.addEventListener('shuiyin1:settings:changed', ((e: CustomEvent) => {
      const detail = e.detail;
      if (detail) {
        self.applyLatestSettings(detail, 'settings changed');
      } else {
        self.refreshWatermark('settings changed');
      }
    }) as EventListener);

    this.refreshTimer = window.setInterval(() => {
      self.refreshWatermark('periodic refresh');
    }, 30000);
  }
}
