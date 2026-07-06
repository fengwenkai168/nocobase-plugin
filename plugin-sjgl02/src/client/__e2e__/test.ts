import { test as base, request } from '@playwright/test';
import { getAdminToken } from './helpers/sjgl02-helpers';

const baseURL = process.env.APP_BASE_URL || 'http://127.0.0.1:20000';

async function getMemberToken(): Promise<string> {
  const res = await fetch(`${baseURL}/api/auth:signIn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e_sjgl02_member@nocobase.com', password: 'member123' }),
  });
  const data = await res.json();
  return data.data?.token;
}

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
    const token = await getMemberToken();
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await use(api);
    await api.dispose();
  },
});

export { expect } from '@playwright/test';
