import {
  WATERMARK_ID,
  WatermarkUser,
  defaultSettings,
  isAuthPage,
  renderWatermark,
  log,
  logWarn,
} from './watermark-core';

type RequestFn = (options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
}) => Promise<unknown>;

type WatermarkSettings = typeof defaultSettings;

export interface WatermarkController {
  load(): void;
  cleanup(): void;
}

export function createWatermarkController(request: RequestFn): WatermarkController {
  let settings: WatermarkSettings = { ...defaultSettings };
  let user: WatermarkUser = {};
  let checkTimer: number | undefined;
  let timeTimer: number | undefined;
  let refreshTimer: number | undefined;
  let observer: MutationObserver | null = null;
  let settingsChangedHandler: ((e: CustomEvent) => void) | null = null;
  let popstateHandler: (() => void) | null = null;
  let origPushState: typeof history.pushState | null = null;

  function clearTimeTimer() {
    if (timeTimer) {
      window.clearInterval(timeTimer);
      timeTimer = undefined;
    }
  }

  function startTimeTimer() {
    clearTimeTimer();
    timeTimer = window.setInterval(() => {
      renderWatermark(settings, user);
    }, 60000);
  }

  async function fetchUser() {
    try {
      const res = (await request({ url: 'auth:check', method: 'GET' })) as {
        data?: { data?: WatermarkUser };
      };
      user = res?.data?.data || {};
      log('[shuiyin1] user refreshed:', user.nickname || user.username);
    } catch (err) {
      logWarn('[shuiyin1] failed to fetch current user', err);
    }
  }

  async function fetchSettings(): Promise<WatermarkSettings> {
    try {
      log('[shuiyin1] fetching settings...');
      const res = (await request({
        url: 'shuiyin1_settings:list',
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        data: { __refresh: Date.now() },
      })) as { data?: { data?: Array<Partial<WatermarkSettings>> } & Array<Partial<WatermarkSettings>> };
      log('[shuiyin1] raw settings response:', res);
      const record = res?.data?.data?.[0] || res?.data?.[0];
      if (record) {
        const parsed = {
          text: record.text ?? defaultSettings.text,
          textSources:
            Array.isArray(record.textSources) && record.textSources.length
              ? record.textSources
              : [...defaultSettings.textSources],
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

  function startWatchers() {
    if (!checkTimer) {
      checkTimer = window.setInterval(() => {
        if (!document.getElementById(WATERMARK_ID)) {
          renderWatermark(settings, user);
        }
      }, 2000);
    }
    if (!observer) {
      observer = new MutationObserver(() => {
        if (!document.getElementById(WATERMARK_ID)) {
          renderWatermark(settings, user);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function stopWatchers() {
    if (checkTimer) {
      window.clearInterval(checkTimer);
      checkTimer = undefined;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function applyWatermark(next: WatermarkSettings, reason?: string) {
    if (!next.enabled) {
      clearTimeTimer();
      stopWatchers();
      const el = document.getElementById(WATERMARK_ID);
      if (el) el.remove();
      if (reason) log('[shuiyin1] watermark disabled, reason:', reason);
      return;
    }
    renderWatermark(next, user);
    startWatchers();
    clearTimeTimer();
    if (next.showTime) startTimeTimer();
  }

  async function refreshWatermark(reason?: string, newSettings?: WatermarkSettings) {
    if (isAuthPage()) {
      clearTimeTimer();
      const el = document.getElementById(WATERMARK_ID);
      if (el) el.remove();
      return;
    }
    let next: WatermarkSettings;
    if (newSettings) {
      next = { ...defaultSettings, ...newSettings };
    } else {
      await fetchUser();
      next = await fetchSettings();
    }
    settings = next;
    if (reason) log('[shuiyin1] watermark refreshed, reason:', reason, next);
    applyWatermark(next, reason);
  }

  function applyLatestSettings(next: WatermarkSettings, reason: string) {
    settings = { ...defaultSettings, ...next };
    applyWatermark(settings, reason);
    log('[shuiyin1] watermark refreshed, reason:', reason, settings);
  }

  async function startup() {
    await fetchUser();

    log('[shuiyin1] plugin load started');
    settings = await fetchSettings();
    log('[shuiyin1] initial settings loaded:', settings);

    const initWatermark = () => {
      if (!document.body) {
        log('[shuiyin1] document.body not ready, waiting DOMContentLoaded');
        window.addEventListener('DOMContentLoaded', initWatermark, { once: true });
        return;
      }
      log('[shuiyin1] applying initial watermark with settings:', settings, 'user:', user);

      if (settings.enabled) {
        renderWatermark(settings, user);
        startWatchers();
        if (settings.showTime) startTimeTimer();
      }
    };

    initWatermark();

    const handler = ((e: CustomEvent) => {
      const detail = e.detail;
      if (detail) {
        applyLatestSettings(detail, 'settings changed');
      } else {
        refreshWatermark('settings changed');
      }
    }) as (e: CustomEvent) => void;
    settingsChangedHandler = handler;
    window.addEventListener('shuiyin1:settings:changed', handler as EventListener);

    refreshTimer = window.setInterval(() => {
      refreshWatermark('periodic refresh');
    }, 30000);
  }

  function load() {
    if (isAuthPage()) {
      let initialized = false;
      const tryInit = () => {
        if (initialized) return;
        if (!isAuthPage()) {
          initialized = true;
          if (popstateHandler) {
            window.removeEventListener('popstate', popstateHandler);
            popstateHandler = null;
          }
          startup();
        }
      };
      popstateHandler = tryInit;
      window.addEventListener('popstate', tryInit);
      origPushState = history.pushState;
      const orig = origPushState;
      history.pushState = function (...args) {
        orig.apply(this, args);
        tryInit();
      };
      const frameCheck = () => {
        tryInit();
        if (!initialized) requestAnimationFrame(frameCheck);
      };
      requestAnimationFrame(frameCheck);
      return;
    }

    startup();
  }

  function cleanup() {
    stopWatchers();
    clearTimeTimer();
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
    if (settingsChangedHandler) {
      window.removeEventListener('shuiyin1:settings:changed', settingsChangedHandler as EventListener);
      settingsChangedHandler = null;
    }
    if (popstateHandler) {
      window.removeEventListener('popstate', popstateHandler);
      popstateHandler = null;
    }
    if (origPushState) {
      history.pushState = origPushState;
      origPushState = null;
    }
    const el = document.getElementById(WATERMARK_ID);
    if (el) el.remove();
  }

  return { load, cleanup };
}
