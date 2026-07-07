import { APIRequestContext } from '@playwright/test';

export async function switchActiveRole(page: any, roleName: string) {
  await page.getByTestId('user-center-button').click();
  await page.getByText(/Switch role|切换角色/).click();
  await page.getByText(roleName).click();
}

export async function getMemberUserId(api: APIRequestContext, username: string): Promise<number | null> {
  const res = await api.get(`/api/users:list?filter=${encodeURIComponent(JSON.stringify({ username }))}`);
  const data = await res.json();
  return data.data?.[0]?.id || null;
}

export async function addRoleToUser(api: APIRequestContext, userId: number, roleName: string) {
  const res = await api.post('/api/rolesUsers:create', {
    data: { userId, roleName },
  });
  return res.ok();
}

export async function removeRoleFromUser(api: APIRequestContext, userId: number, roleName: string) {
  const res = await api.post('/api/rolesUsers:destroy', {
    filter: { userId, roleName },
  });
  return res.ok();
}
