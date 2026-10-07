import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '../src/config/constants';

/**
 * G5：**通知的产生端**的端到端覆盖。
 *
 * 通知的读 / 已读 / 面板链路在 M10-a 就验过了（`mobile-shell.spec.ts` 读的是 seed 预置的
 * 三条），但**应用内真正会写通知的两个地方**此前只有人工验证：
 *
 * 1. 成员接受邀请 → 通知工作区的所有者与管理员（`accept-invitation.ts`）
 * 2. 答卷量达到回收上限 → 通知问卷所有者（`submit-response.ts`）
 *
 * 所以这两条用例盯的是「**事件发生了，通知真的被写出来、并且点得动**」——
 * 只看面板里有没有字是不够的：`linkUrl` 给错的话，用户点进去落在无关页面上，
 * 那和没有通知一样糟。
 *
 * 两条都**自己造数据、自己收拾**：成员那条用完就移除，问卷那条用完就删掉。
 */
async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(account.email);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function signOut(page: Page) {
  // 先回管理台：接受邀请成功后落在的是一个**不带侧栏**的独立页面，
  // 那里没有账号菜单（直接找它会一直等到超时）
  await page.goto('/app');
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitem', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** 清掉同名残留：上一次失败留下的卡片会让后面的定位命中多个元素 */
async function clearLeftovers(page: Page, title: string) {
  const menu = page.getByRole('button', { name: `「${title}」更多操作` });

  for (let remaining = await menu.count(); remaining > 0; remaining -= 1) {
    await menu.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(menu).toHaveCount(remaining - 1);
  }
}

test.describe('通知的产生端', () => {
  test.setTimeout(300_000);

  test('成员加入 → 所有者收到通知，且点得进成员页', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');

    // 每次跑换个新邮箱：注册接口对已存在的邮箱会拒绝，固定邮箱第二次跑必红
    const invitedEmail = `e2e.notify.${Date.now()}@example.com`;

    await signIn(page, DEMO_ACCOUNTS.owner);
    await page.getByRole('link', { name: '成员与权限' }).click();
    await expect(page).toHaveURL(/\/app\/members$/);

    // ---- 邀请（与 members.spec 同一条路径；这里只关心它产生了什么通知）----
    await page.getByRole('button', { name: '邀请成员' }).click();
    await page.getByLabel('邮箱').fill(invitedEmail);
    await page.getByRole('button', { name: '编辑者' }).click();
    await page.getByRole('button', { name: '生成邀请链接' }).click();

    const link = page.getByText(/\/invite\/[\w-]+/);
    await expect(link).toBeVisible();
    // 只取路径：链接域名来自 NEXT_PUBLIC_APP_URL，而 E2E 跑在 3100（见 members.spec 的说明）
    const invitePath = new URL((await link.textContent()) ?? '').pathname;
    await page.getByRole('button', { name: '完成' }).click();

    // ---- 用一个新账号注册并接受 ----
    await signOut(page);
    await page.goto('/register');
    await page.getByLabel('姓名', { exact: true }).fill('E2E 通知成员');
    await page.getByLabel('邮箱', { exact: true }).fill(invitedEmail);
    await page.getByLabel('设置密码', { exact: true }).fill('demo1234');
    await page.getByLabel('确认密码', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: '创建账号' }).click();
    await expect(page).not.toHaveURL(/\/register$/);

    await page.goto(invitePath);
    await page.getByRole('button', { name: /接受邀请，以「编辑者」身份加入/ }).click();
    await expect(page.getByText(/已加入「轻问卷演示团队」/)).toBeVisible();

    // ---- 回所有者：铃铛上必须有这一条 ----
    await signOut(page);
    await signIn(page, DEMO_ACCOUNTS.owner);
    // 重新进一次首页：服务端组件不重新请求就还是旧的 HTML，看不到刚写进去的通知
    await page.goto('/app');

    const bell = page.getByRole('button', { name: /^通知/ });
    // 红点 = 真实未读数，这一条刚写进去必然未读
    await expect(bell).toHaveAttribute('aria-label', /条未读/);
    await bell.click();

    /*
     * 一律用 `.first()`：列表按 `createdAt desc` 排（`api/notifications.ts`），
     * 所以**刚刚写出来的这条一定在第一条**。
     *
     * 不能用「正文唯一」来定位 —— 上一轮跑失败留下的同名通知，正文与这一条一模一样
     * （同一个人名、同一个角色），会命中两个元素。
     */
    await expect(page.getByText('新成员加入').first()).toBeVisible();
    await expect(
      page.getByText('E2E 通知成员 以「编辑者」身份加入了工作区。').first(),
    ).toBeVisible();

    // `linkUrl` 不是假入口：点它要落在成员页
    await page
      .getByRole('link', { name: /E2E 通知成员 以「编辑者」身份加入了工作区/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/members$/);

    // ---- 收尾：把这位临时成员移出去（账号留着，与 members.spec 一致）----
    const row = page.getByRole('row', { name: new RegExp(invitedEmail.replace('.', '\\.')) });
    await row.getByRole('button', { name: '移除' }).click();
    await page.getByRole('button', { name: '确认移除' }).click();
    await expect(page.getByText(invitedEmail)).toHaveCount(0);
  });

  test('答卷达到回收上限 → 所有者收到通知，且点得进数据页', async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');

    /*
     * 上限设成 1 是最省的一条路：一份答卷就触发「收满」。
     * （另一条路是提交够多份，但那要多跑几十次提交，和被测的东西无关。）
     */
    const title = 'E2E 收满通知';

    await signIn(page, DEMO_ACCOUNTS.owner);
    await clearLeftovers(page, title);

    // ---- 造一份「上限 1」的问卷并发布 ----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);
    const questionnaireId = page.url().match(/\/app\/q\/([^/]+)\//)![1]!;

    await page.getByLabel('问卷标题').fill(title);
    // 默认选项就是「选项 1 / 选项 2」，够走完提交链路
    await page.getByRole('button', { name: '单选', exact: true }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    const tabs = page.getByRole('navigation', { name: '问卷内页面' });
    await tabs.getByRole('link', { name: '发布设置' }).click();
    await page.getByLabel('回收份数上限').fill('1');
    await page.getByRole('button', { name: '保存并发布' }).click();
    await expect(page.getByRole('status')).toContainText('已发布');

    await tabs.getByRole('link', { name: '分享' }).click();
    const slug = (await page.getByText(/\/s\//).first().textContent())!.split('/s/')[1]!;

    // ---- 访客提交一份（新上下文 = 另一个人的浏览器）----
    const visitor = await browser.newContext();
    const form = await visitor.newPage();

    await form.goto(`/s/${slug}`);
    await form.getByRole('button', { pressed: false }).first().click();
    await form.getByRole('button', { name: /提交答卷/ }).click();
    await expect(form).toHaveURL(/\/s\/[^/]+\/done\?r=/);

    await visitor.close();

    // ---- 所有者：铃铛里应当有「问卷已收满」----
    await page.goto('/app');
    const bell = page.getByRole('button', { name: /^通知/ });
    await expect(bell).toHaveAttribute('aria-label', /条未读/);
    await bell.click();

    // 同样用 `.first()`（最新一条在最前）：库里还有历史跑的同一句话
    await expect(page.getByText('问卷已收满').first()).toBeVisible();
    await expect(
      page.getByText(`「${title}」已达到回收上限 1 份，链接已失效。`).first(),
    ).toBeVisible();
    // 另外确认这一条**只写了一次**：正文相同的通知在这个所有者名下只该有一条「最新」的
    await page
      .getByRole('link', { name: new RegExp(`「${title}」已达到回收上限 1 份`) })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/app/q/${questionnaireId}/stats$`));

    // ---- 收尾：删掉这份临时问卷（它已截止，卡片仍在默认列表里）----
    await page.goto('/app');
    await clearLeftovers(page, title);
  });
});
