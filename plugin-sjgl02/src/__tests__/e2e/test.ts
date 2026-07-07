import { test as base, request } from '@playwright/test';
import { getAdminToken, getMemberToken } from './helpers/sjgl02-helpers';

const baseURL = process.env.APP_BASE_URL || 'http://127.0.0.1:20000';

export const test = base.extend<{
  adminApi: Awaited<ReturnType<typeof request.newContext>>;
  memberApi: Awaited<ReturnType<typeof request.newContext>>;
}>({
  adminApi: async ({ request: _request }, use) => {
    const token = await getAdminToken(baseURL);
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await use(api);
    await api.dispose();
  },
  memberApi: async ({ request: _request }, use) => {
    const token = await getMemberToken(baseURL);
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await use(api);
    await api.dispose();
  },
});

export { expect } from '@playwright/test';
