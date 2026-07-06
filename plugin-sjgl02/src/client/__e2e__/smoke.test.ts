import { test, expect } from '@nocobase/test/e2e';

const PLUGIN_NAME = '@my-project/plugin-sjgl02';
const SETTINGS_URL = '/admin/settings/sjgl02';

async function ensurePluginEnabled(page: any) {
  await page.goto(SETTINGS_URL);
  if (page.url().includes(SETTINGS_URL)) return;
  // 如果插件未启用，通过管理接口启用后重试
  const res = await page.request.post(
    `/api/pm:enable?filterByTk=${encodeURIComponent(PLUGIN_NAME)}&awaitResponse=true`,
  );
  if (!res.ok() && res.status() !== 200) {
    // eslint-disable-next-line no-console
    console.warn('启用插件接口返回非 200:', res.status(), await res.text().catch(() => ''));
  }
  await page.goto(SETTINGS_URL);
}

test.describe('数据管理插件设置页（E2E 冒烟）', () => {
  test('设置页加载并展示四个标签页', async ({ page }) => {
    await ensurePluginEnabled(page);
    await expect(page.getByText('Data Management')).toBeVisible();
    await expect(page.getByRole('tab', { name: /导入/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /导出/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /任务管理/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /权限管理/ })).toBeVisible();
  });

  test('权限管理标签可选择用户并展示新增权限按钮', async ({ page }) => {
    await ensurePluginEnabled(page);
    await page.getByRole('tab', { name: /权限管理/ }).click();
    await expect(page.getByText('请选择左侧用户或角色')).toBeVisible();
    const userItems = page.locator('div[style*="cursor: pointer"]');
    await expect(userItems.first()).toBeVisible();
    await userItems.first().click();
    await expect(page.getByRole('button', { name: /Add Permission/ })).toBeVisible();
  });
});
