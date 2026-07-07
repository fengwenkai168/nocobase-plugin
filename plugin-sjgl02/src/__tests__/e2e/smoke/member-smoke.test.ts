import { test, expect } from '../test';
import { BLOCK_PAGE_URL, ensurePluginEnabled, loginAsMember } from '../helpers/sjgl02-helpers';
import { setupE2EEnvironment } from '../helpers/admin-api';

test.beforeAll(async ({ adminApi }) => {
  await setupE2EEnvironment(adminApi);
});

test.beforeEach(async ({ page }) => {
  await loginAsMember(page);
});

test('区块页面加载并展示三个标签页', async ({ page }) => {
  await ensurePluginEnabled(page);
  await page.goto(BLOCK_PAGE_URL);

  const tabs = page.getByTestId('sjgl-block-tabs');
  await expect(tabs).toBeVisible();
  await expect(tabs.getByText(/导入/)).toBeVisible();
  await expect(tabs.getByText(/导出/)).toBeVisible();
  await expect(tabs.getByText(/任务管理/)).toBeVisible();
});
