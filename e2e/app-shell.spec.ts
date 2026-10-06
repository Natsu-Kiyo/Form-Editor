import { expect, test, type Locator, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M1 验收：管理台外壳（**桌面形态**）。
 *
 * 这三条说的是「侧栏」，而侧栏是桌面端的东西：窄屏下 M10 把 `/app` 换成了
 * P04 移动工作台（顶栏三个入口 + 底部三格），那里**没有汉堡、也没有侧栏** ——
 * 导航在底部条里、账号在 P09「我的」里、工作区切换在顶栏。
 * 所以它们只跑 desktop，窄屏的等价覆盖在 `mobile-shell.spec.ts`。
 */

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** 常驻侧栏。窄屏下这份 DOM 仍在但 `display:none`，所以这个 helper 只在 desktop 用 */
function sidebar(page: Page): Locator {
  return page.getByRole('complementary');
}

test('侧栏展示当前工作区、主导航与我的角色', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '侧栏是桌面形态，窄屏见 mobile-shell.spec.ts');
  await signIn(page);

  // 当前工作区来自 seed
  await expect(sidebar(page).getByRole('button', { name: /轻问卷演示团队/ })).toBeVisible();
  await expect(sidebar(page).getByRole('link', { name: '问卷列表' })).toBeVisible();
  await expect(sidebar(page).getByText('所有者')).toBeVisible();
});

test('工作区切换器可以打开并列出新建入口', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '侧栏是桌面形态，窄屏见 mobile-shell.spec.ts');
  await signIn(page);

  await sidebar(page)
    .getByRole('button', { name: /轻问卷演示团队/ })
    .click();

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
  test.skip(testInfo.project.name !== 'desktop', '账号行在侧栏底部；窄屏在 P09「我的」里');
  await signIn(page);

  await sidebar(page).getByRole('button', { name: '账号菜单' }).click();
  await expect(page.getByRole('menuitem', { name: '个人信息' })).toBeVisible();

  await page.getByRole('menuitem', { name: '帮助与反馈' }).click();
  await expect(page.getByRole('heading', { name: '帮助与反馈' })).toBeVisible();
  // 常见问题第一条默认展开
  await expect(page.getByText('发布即冻结题目结构')).toBeVisible();
});
