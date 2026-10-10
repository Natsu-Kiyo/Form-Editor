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

  /*
   * 只断言「面板里有内容」，**不指定某一条**。
   *
   * 原先断言的是 seed 的「欢迎使用轻问卷」，R43 这轮它被打红了：通知会随着 E2E
   * 一轮轮累积（每次「成员加入」都写两条），而面板只取**最近 20 条** —— 数了一下，
   * 所有者名下已经 23 条，seed 那三条早被挤出窗口。用例不该依赖会被挤掉的种子数据。
   */
  await expect(page.getByText('通知', { exact: true })).toBeVisible();
  await expect(page.getByText('暂时没有通知。')).toHaveCount(0);
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

test('切换工作区有等待态：行内「切换中…」，弹层等新工作区落地才关', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '侧栏是桌面形态，窄屏见 mobile-shell.spec.ts');
  test.setTimeout(120_000);

  const demo = '轻问卷演示团队';
  /*
   * 名字**不要**用「切换工作区」这个界面词（模板中心那条用例踩过同一个坑）：
   * Playwright 的 name / text 都是子串匹配，工作区叫「E2E 切换工作区」时，
   * `getByText('切换工作区')` 会连它一起命中（strict mode violation）。
   */
  const target = 'E2E 第二工作区';

  await signIn(page);

  /** 侧栏那个切换器触发按钮（文本里带工作区名，两个名字都可能） */
  const trigger = () =>
    sidebar(page).getByRole('button', { name: new RegExp(`${demo}|${target}`) });
  /** 弹层里的工作区行：名字后面跟着「N 位成员 · 角色」，与侧栏按钮区分得开 */
  const optionRow = (name: string) =>
    page.getByRole('button', { name: new RegExp(`^${name}.*所有者`) });

  // ---- 基准：先确保当前是演示团队（上一次运行可能停在别的工作区）----
  await trigger().click();
  await optionRow(demo).click();
  await expect(sidebar(page).getByRole('button', { name: new RegExp(demo) })).toBeVisible();

  // ---- 备好第二个工作区（幂等：上一次运行留下的同名那份直接复用）----
  await trigger().click();
  if ((await optionRow(target).count()) === 0) {
    await page.getByRole('button', { name: '新建工作区' }).click();
    await page.getByLabel('工作区名称').fill(target);
    await page.getByRole('button', { name: '创建', exact: true }).click();
  } else {
    await optionRow(target).click();
  }
  // 此刻当前工作区 = 上面那份（侧栏显示它；新工作区里没有问卷）
  await expect(sidebar(page).getByRole('button', { name: new RegExp(target) })).toBeVisible();

  /*
   * 按住这次切换（server action 的 POST），1.2 秒后才放行。
   * 与「列表切筛选」那条同款手法：真机上等待态只闪一两百毫秒，按住它才验得稳。
   */
  await page.route('**/app*', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.fulfill({ response });
  });

  await trigger().click();
  await optionRow(demo).click();

  // 等待态：那一行就地换成「切换中…」+ spinner；弹层**不提前关**（数据还没换）
  await expect(page.getByText('切换中…')).toBeVisible();
  await expect(page.getByText('切换工作区')).toBeVisible();

  // 放行 → 落地：弹层关闭、侧栏换成演示团队、列表数据也回来了
  await expect(page.getByText('切换工作区')).toHaveCount(0);
  await expect(page.getByText('切换中…')).toHaveCount(0);
  await expect(sidebar(page).getByRole('button', { name: new RegExp(demo) })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2026 秋季社团招新报名' })).toBeVisible();

  await page.unroute('**/app*');
});
