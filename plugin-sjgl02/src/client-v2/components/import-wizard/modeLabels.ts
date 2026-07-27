const MODE_KEYS: Record<string, string> = {
  insert: '新增(insert)',
  update: '更新(update)',
  upsert: '新增+更新(upsert)',
};

export function modeLabel(t: (s: string) => string, mode: string): string {
  return MODE_KEYS[mode] ? t(MODE_KEYS[mode]) : mode;
}

export function modeShortLabel(t: (s: string) => string, mode: string): string {
  const shortKeys: Record<string, string> = { insert: '新增', update: '更新', upsert: '新增+更新' };
  return shortKeys[mode] ? t(shortKeys[mode]) : mode;
}
