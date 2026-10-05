import { expect, test, type Locator, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M1 验收：管理台外壳。
 *
 * 桌面与窄屏的**形态不同**：桌面侧栏常驻（`complementary`），窄屏收进左侧抽屉。
 * 所以定位时必须先按 project 找对容器 —— 窄屏下侧栏的那份 DOM 仍在（只是 display:none），
 * 直接 `getByRole` 会命中那份看不见的、然后一直等到超时。
 */

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** 返回「当前可见的那份侧栏」：桌面是常驻 aside，窄屏要先把抽屉打开 */
async function visibleSidebar(page: Page, projectName: string): Promise<Locator> {
  if (projectName === 'mobile') {
    await page.getByRole('button', { name: '打开导航' }).click();
    return page.getByRole('dialog');
  }

  return page.getByRole('complementary');
}

test('侧栏展示当前工作区、主导航与我的角色', async ({ page }, testInfo) => {
  await signIn(page);
  const sidebar = await visibleSidebar(page, testInfo.project.name);

  // 当前工作区来自 seed
  await expect(sidebar.getByRole('button', { name: /轻问卷演示团队/ })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: '问卷列表' })).toBeVisible();
  await expect(sidebar.getByText('所有者')).toBeVisible();
});

test('工作区切换器可以打开并列出新建入口', async ({ page }, testInfo) => {
  await signIn(page);
  const sidebar = await visibleSidebar(page, testInfo.project.name);

  await sidebar.getByRole('button', { name: /轻问卷演示团队/ }).click();

  await expect(page.getByText('切换工作区')).toBeVisible();
  await expect(page.getByRole('button', { name: '新建工作区' })).toBeVisible();
});

test('通知面板可以打开并列出通知', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: /^通知/ }).click();

  // seed 里有一条欢迎通知，任何一次运行都该看到它
  await expect(page.getByText('欢迎使用轻问卷')).toBeVisible();
});

test('账号菜单可以打开账号设置与帮助与反馈', async ({ page }, testInfo) => {
  await signIn(page);
  const sidebar = await visibleSidebar(page, testInfo.project.name);

  await sidebar.getByRole('button', { name: '账号菜单' }).click();
  await expect(page.getByRole('menuitem', { name: '个人信息' })).toBeVisible();

  await page.getByRole('menuitem', { name: '帮助与反馈' }).click();
  await expect(page.getByRole('heading', { name: '帮助与反馈' })).toBeVisible();
  // 常见问题第一条默认展开
  await expect(page.getByText('发布即冻结题目结构')).toBeVisible();
});
