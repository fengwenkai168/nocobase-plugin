// 调试日志开关，生产环境设为 false
const DEBUG = false;

export const WATERMARK_ID = 'shuiyin1-watermark-overlay';

export type WatermarkTextSource = 'nickname' | 'username' | 'custom';

export interface WatermarkUser {
  nickname?: string;
  username?: string;
  email?: string;
}

export const defaultSettings = {
  text: '',
  textSources: ['nickname'] as WatermarkTextSource[],
  opacity: 0.15,
  fontSize: 10,
  showTime: true,
  density: 5,
  enabled: true,
};

export const authPages = ['/signin', '/signup', '/forgot-password', '/reset-password'];

export function isAuthPage(): boolean {
  const path = window.location.pathname.replace(/^\/v(?=\/|$)/, '');
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

export function resolveWatermarkText(settings: WatermarkSettings, user: WatermarkUser): string {
  const sources =
    Array.isArray(settings.textSources) && settings.textSources.length
      ? settings.textSources
      : (['nickname'] as WatermarkTextSource[]);
  const parts = sources
    .map((s) => {
      if (s === 'nickname') return user.nickname || '';
      if (s === 'username') return user.username || '';
      return settings.text || '';
    })
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.join(' ') || user.nickname || user.username || user.email || '';
}

const MIN_FONT_SIZE = 6;
const ROTATE_ANGLE = -Math.PI / 6;
const MAX_TILE_SCALE = 3;

function computeTileLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  baseFontSize: number,
  tileWidth: number,
  tileHeight: number,
): { width: number; height: number; fontSize: number } {
  ctx.font = `${baseFontSize}px sans-serif`;
  const projectedTextWidth = ctx.measureText(text).width * Math.cos(ROTATE_ANGLE);

  let width = tileWidth;
  const neededWidth = projectedTextWidth / 0.9;
  if (neededWidth > width) {
    width = Math.min(Math.ceil(neededWidth), tileWidth * MAX_TILE_SCALE);
  }

  let fontSize = baseFontSize;
  if (projectedTextWidth > width * 0.9) {
    fontSize = Math.max(MIN_FONT_SIZE, Math.floor((baseFontSize * (width * 0.9)) / projectedTextWidth));
  }

  return { width, height: Math.round((width * tileHeight) / tileWidth), fontSize };
}

export function renderWatermark(settings: WatermarkSettings, user: WatermarkUser): void {
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

  const text = resolveWatermarkText(settings, user);
  const now = new Date();
  const displayText = settings.showTime
    ? `${text} ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(
        2,
        '0',
      )} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    : text;
  const { width: baseWidth, height: baseHeight } = densityMap[settings.density] || densityMap[5];
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return;
  const layout = computeTileLayout(measureCtx, displayText, settings.fontSize, baseWidth, baseHeight);

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.globalAlpha = settings.opacity;
  ctx.font = `${layout.fontSize}px sans-serif`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(layout.width / 2, layout.height / 2);
  ctx.rotate(ROTATE_ANGLE);
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
