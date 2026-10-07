import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '../src/config/constants';

/**
 * 外壳版式（用户实测提出）：
 *
 * 1. **侧栏高亮** —— 原先 `/app` 按前缀匹配，于是进「模板中心」「我的」这些子路由时
 *    「问卷列表」一直亮着，看起来像导航坏了
 * 2. **整页不超过视口** —— 原先整页高度跟着主区内容长，滚动条在窗口上，
 *    侧栏底部那行账号得滚到最下面才看得见；现在滚的只有主区，侧栏与顶栏不动
 * 3. **根路由** —— `/` 原先是一张品牌占位页，现在按登录态直接分流
 *
 * 这三条都是「版式与导航」层面的东西，用单测测不到，必须真的量一次几何。
 */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe('外壳版式与根路由', () => {
  /*
   * 「问卷列表」会在两种地方亮：工作台本身 `/app`，以及问卷的**工作区** `/app/q/**`
   * （编辑 / 发布设置 / 分享 / 数据 / 答卷）—— 后者由 `NAV_ITEMS` 的 `matchPrefixes`
   * 逐条登记，**不是**前缀匹配（`/app` 一旦按前缀匹配，模板中心、我的、成员页全会跟着亮）。
   * 这条用例验的是另一半：**不相关的子页面不许亮**。
   */
  test('侧栏高亮不越界：进模板中心 / 我的时「问卷列表」不再亮着', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '侧栏是桌面形态；窄屏见 mobile-shell.spec');

    await signIn(page);
    const sidebar = page.getByRole('complementary');
    const listLink = sidebar.getByRole('link', { name: '问卷列表' });
    const templateLink = sidebar.getByRole('link', { name: '模板中心' });

    // 工作台本身：「问卷列表」亮，其它不亮
    await expect(listLink).toHaveAttribute('aria-current', 'page');
    await expect(templateLink).not.toHaveAttribute('aria-current', 'page');

    // 进模板中心：亮的位置应当**跟着走过去**，而不是两个都亮
    await templateLink.click();
    await expect(page).toHaveURL(/\/app\/templates$/);
    await expect(templateLink).toHaveAttribute('aria-current', 'page');
    await expect(listLink).not.toHaveAttribute('aria-current', 'page');

    // 「我的」不在侧栏里（它在底部导航/头像），但同样不该让「问卷列表」亮着
    await page.goto('/app/me');
    await expect(listLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('整页不超过视口：滚的是主区，侧栏与顶栏不动', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '侧栏是桌面形态');

    await signIn(page);

    // ---- 1. 文档本身不滚（滚动条应当长在主区内部）----
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(overflow).toBeLessThanOrEqual(2);

    // ---- 2. 侧栏底部账号行在视口内 ----
    // 这正是用户报的现象：原先要滚到整页最下面才看得见它
    const viewport = page.viewportSize()!;
    const account = await page.getByRole('button', { name: '账号菜单' }).boundingBox();
    expect(account).not.toBeNull();
    expect(account!.y + account!.height).toBeLessThanOrEqual(viewport.height);

    // ---- 3. 滚主区：顶栏与侧栏的纵向位置一动不动 ----
    // 顶栏用标题定位：`<header>` 有两个（窄屏那个移动顶栏也渲染在 DOM 里），
    // 而「问卷列表」这个标题只在桌面顶栏上
    const topbarTitle = page.getByRole('heading', { name: '问卷列表' });
    const sidebarShell = page.getByRole('complementary');

    const titleBefore = (await topbarTitle.boundingBox())!.y;
    const sidebarBefore = (await sidebarShell.boundingBox())!.y;

    await page.getByRole('main').evaluate((element) => {
      element.scrollTop = 600;
    });
    await expect
      .poll(() => page.getByRole('main').evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    expect((await topbarTitle.boundingBox())!.y).toBe(titleBefore);
    expect((await sidebarShell.boundingBox())!.y).toBe(sidebarBefore);
  });

  test('根路由按登录态分流：未登录去登录页，已登录进工作台', async ({ page }) => {
    // 未登录
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    // 已登录
    await signIn(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/app$/);
  });
});
