import { Plugin } from '@nocobase/client';
import { ShuiyinSettings } from './pages/ShuiyinSettings';
import {
  WATERMARK_ID,
  defaultSettings,
  isAuthPage,
  renderWatermark,
  log,
  logWarn,
} from '../common/watermark-core';

export class PluginShuiyin1Client extends Plugin {
  settings = { ...defaultSettings };
  username = 'unknown';
  private checkTimer: number | undefined;
  private timeTimer: number | undefined;
  private refreshTimer: number | undefined;
  private observer: MutationObserver | null = null;
  private settingsChangedHandler: ((e: CustomEvent) => void) | null = null;
  private popstateHandler: (() => void) | null = null;
  private origPushState: typeof history.pushState | null = null;

  async afterDisable() {
    this.cleanup();
  }

  private cleanup() {
    if (this.checkTimer) {
      window.clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    this.clearTimeTimer();
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.settingsChangedHandler) {
      window.removeEventListener('shuiyin1:settings:changed', this.settingsChangedHandler as EventListener);
      this.settingsChangedHandler = null;
    }
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
    if (this.origPushState) {
      history.pushState = this.origPushState;
      this.origPushState = null;
    }
    const el = document.getElementById(WATERMARK_ID);
    if (el) el.remove();
  }

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

  private async fetchUser() {
    try {
      const res = await this.app.apiClient.request({ url: 'auth:check', method: 'GET' });
      const user = res?.data?.data;
      this.username = user?.nickname || user?.username || user?.email || 'unknown';
      log('[shuiyin1] user refreshed:', this.username);
    } catch (err) {
      logWarn('[shuiyin1] failed to fetch current user', err);
    }
  }

  private async fetchSettings() {
    try {
      log('[shuiyin1] fetching settings...');
      const res = await this.app.apiClient.request({
        url: 'shuiyin1_settings:list',
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        data: { __refresh: Date.now() },
      });
      log('[shuiyin1] raw settings response:', res);
      const record = res?.data?.data?.[0] || res?.data?.[0];
      if (record) {
        const parsed = {
          text: record.text ?? defaultSettings.text,
          opacity: record.opacity ?? defaultSettings.opacity,
          fontSize: record.fontSize ?? defaultSettings.fontSize,
          showTime: record.showTime ?? defaultSettings.showTime,
          density: record.density ?? defaultSettings.density,
          enabled: record.enabled ?? defaultSettings.enabled,
        };
        log('[shuiyin1] parsed settings:', parsed);
        return parsed;
      }
      logWarn('[shuiyin1] no settings record found, using defaults');
    } catch (err) {
      logWarn('[shuiyin1] failed to fetch settings', err);
    }
    return { ...defaultSettings };
  }

  private async refreshWatermark(reason?: string, newSettings?: typeof defaultSettings) {
    if (isAuthPage()) {
      this.clearTimeTimer();
      const el = document.getElementById(WATERMARK_ID);
      if (el) el.remove();
      return;
    }
    let settings: typeof defaultSettings;
    if (newSettings) {
      settings = { ...defaultSettings, ...newSettings };
    } else {
      await this.fetchUser();
      settings = await this.fetchSettings();
    }
    this.settings = settings;
    if (reason) log('[shuiyin1] watermark refreshed, reason:', reason, settings);
    this.applyWatermark(settings, reason);
  }

  private applyLatestSettings(settings: typeof defaultSettings, reason: string) {
    this.settings = { ...defaultSettings, ...settings };
    this.applyWatermark(this.settings, reason);
    log('[shuiyin1] watermark refreshed, reason:', reason, this.settings);
  }

  private applyWatermark(settings: typeof defaultSettings, reason?: string) {
    if (!settings.enabled) {
      this.clearTimeTimer();
      const el = document.getElementById(WATERMARK_ID);
      if (el) el.remove();
      if (reason) log('[shuiyin1] watermark disabled, reason:', reason);
      return;
    }
    renderWatermark(settings, this.username);
    this.clearTimeTimer();
    if (settings.showTime) this.startTimeTimer();
  }

  async load() {
    const self = this;

    this.pluginSettingsManager.add('shuiyin1', {
      title: this.t('Watermark Settings'),
      icon: 'CopyrightOutlined',
      Component: ShuiyinSettings,
    });

    if (isAuthPage()) {
      let initialized = false;
      const tryInit = () => {
        if (initialized) return;
        if (!isAuthPage()) {
          initialized = true;
          if (self.popstateHandler) {
            window.removeEventListener('popstate', self.popstateHandler);
            self.popstateHandler = null;
          }
          self.startup();
        }
      };
      this.popstateHandler = tryInit;
      window.addEventListener('popstate', tryInit);
      const origPushState = history.pushState;
      this.origPushState = origPushState;
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

    self.startup();
  }

  private async startup() {
    const self = this;

    try {
      const res = await this.app.apiClient.request({ url: 'auth:check', method: 'GET' });
      const user = res?.data?.data;
      this.username = user?.nickname || user?.username || user?.email || 'unknown';
    } catch (err) {
      logWarn('[shuiyin1] failed to fetch current user', err);
    }

    log('[shuiyin1] plugin load started');
    self.settings = await this.fetchSettings();
    log('[shuiyin1] initial settings loaded:', this.settings);

    const initWatermark = () => {
      if (!document.body) {
        log('[shuiyin1] document.body not ready, waiting DOMContentLoaded');
        window.addEventListener('DOMContentLoaded', initWatermark, { once: true });
        return;
      }
      log('[shuiyin1] applying initial watermark with settings:', self.settings, 'username:', self.username);

      if (self.settings.enabled) {
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
      }
    };

    initWatermark();

    const handler = ((e: CustomEvent) => {
      const detail = e.detail;
      if (detail) {
        self.applyLatestSettings(detail, 'settings changed');
      } else {
        self.refreshWatermark('settings changed');
      }
    }) as (e: CustomEvent) => void;
    this.settingsChangedHandler = handler;
    window.addEventListener('shuiyin1:sett