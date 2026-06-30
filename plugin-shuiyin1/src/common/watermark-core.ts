// 调试日志开关，生产环境设为 false
const DEBUG = false;

export const WATERMARK_ID = 'shuiyin1-watermark-overlay';

export const defaultSettings = {
  text: '',
  opacity: 0.15,
  fontSize: 10,
  showTime: true,
  density: 5,
  enabled: true,
};

export const authPages = [
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

export function isAuthPage(): boolean {
  const path = window.location.pathname;
  return authPages.some((p) => path === p || path.startsWith(p + '/'));
}

export const densityMap: Record<number, { width: number; height: number }> = {
  1: { width: 400, height: 280 },
  2: { width: 320, height: 220 },
  3: { width: 240, height: 160 },
  4: { width: 180, height: 120 },
  5: { width: 140, height: 90 },
};

type WatermarkSettings = typeof defaultSettings;

export function renderWatermark(
  settings: WatermarkSettings,
  username: string,
): void {
  const el = document.getElementById(WATERMARK_ID);

  if (isAuthPage()) {
    if (el) el.remove();
    return;
  }

  if (!settings.enabled) {
    if (el) el.remove();
    return;
  }

  if (!el) {
    const div = document.createElement('div');
    div.id = WATERMARK_ID;
    Object.assign(div.style, {
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
    document.body.appendChild(div);
  }

  const container = document.getElementById(WATERMARK_ID);
  if (!container) return;

  const text = settings.text || username;
  const displayText = settings.showTime
    ? `${text} ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    : text;
  const { width, height } = densityMap[settings.density] || densityMap[5];
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

  container.style.backgroundImage = `url(${canvas.toDataURL('image/png')})`;
}

export function log(...args: unknown[]): void {
  if (DEBUG) console.log(...args);
}

export function logWarn(...args: unknown[]): void {
  if (DEBUG) console.warn(...args);
}
