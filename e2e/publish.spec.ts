import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M4-a 验收：从编辑器顶栏一步到发布设置并成功发布；发布后结构冻结。
 *
 * 只在 desktop 跑：发布是写操作，且结果要连着看编辑器与列表两处状态。
 */
const TITLE = 'E2E 发布用例';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** 清掉同名残留：上一轮失败留下的卡片会让按标题定位的步骤撞成 strict mode violation */
async function clearLeftovers(page: Page, title: string) {
  const menu = page.getByRole('button', { name: `「${title}」更多操作` });

  let remaining = await menu.count();
  while (remaining > 0) {
    await menu.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(menu).toHaveCount(remaining - 1);
    remaining -= 1;
  }
}

test.describe('发布设置', () => {
  test.setTimeout(240_000);

  test('顶栏发布 → 校验拦住 → 发布成功 → 结构冻结', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '发布写操作只在桌面端跑');
    await signIn(page);
    await clearLeftovers(page, TITLE);

    // ---- 造一份带题目的问卷 ----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    // 创建成功后 action 直接 redirect 到编辑器，不需要再从列表点进来
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

    await page.getByLabel('问卷标题').fill(TITLE);
    await page.getByRole('button', { name: '单选', exact: true }).click();
    await expect(page.getByRole('group', { name: '第 1 题：新题目' })).toBeVisible();

    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    // ---- 顶栏「发布」一步到发布设置（设计稿要求两个入口，这是其一） ----
    await page.getByRole('banner').getByRole('link', { name: '发布' }).click();
    await expect(page).toHaveURL(/\/publish$/);
    await expect(page.getByText('发布前检查')).toBeVisible();
    await expect(page.getByText('共 1 道题目，标题均已填写')).toBeVisible();

    // ---- 时间填到过去：清单报错，且按钮不可点（界面拦） ----
    // 时间用「2026-10-20 23:59」这种写法直接填 —— 输入框是统一格式的文本框，
    // 不再是原生 datetime-local，也不再需要先勾选什么才能填。
    // 定位用 textbox 而不是 getByLabel：旁边的选择器按钮叫「选择结束时间」，
    // 而 getByLabel 是子串匹配，会把两个都命中
    const endsAtField = page.getByRole('textbox', { name: '结束时间' });
    await endsAtField.fill('2020-01-01 00:00');
    await expect(page.getByText('结束时间已经过去')).toBeVisible();
    await expect(page.getByRole('button', { name: '保存并发布' })).toBeDisabled();

    // ---- 改成将来的时间：可以发布 ----
    await endsAtField.fill('2030-01-01 23:59');
    await expect(page.getByText('结束时间已经过去')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保存并发布' })).toBeEnabled();

    await page.getByRole('button', { name: '保存并发布' }).click();
    await expect(page.getByRole('status')).toContainText('已发布');
    await expect(page.getByText('回收中')).toBeVisible();

    // ---- 发布后结构冻结：编辑器只读 ----
    const tabs = page.getByRole('navigation', { name: '问卷内页面' });
    await tabs.getByRole('link', { name: '编辑', exact: true }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByText('题目结构已冻结')).toBeVisible();
    await expect(page.getByRole('button', { name: '单选', exact: true })).toBeDisabled();

    // ---- 列表里也变成「回收中」 ----
    await page.goto('/app?status=PUBLISHED');
    await expect(page.getByRole('heading', { name: TITLE, exact: true })).toBeVisible();

    // ---- 已发布的问卷还能改设置（不再显示「保存并发布」） ----
    await page.getByRole('link', { name: `编辑「${TITLE}」` }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await tabs.getByRole('link', { name: '发布设置', exact: true }).click();
    await expect(page).toHaveURL(/\/publish$/);
    await expect(page.getByRole('button', { name: '保存设置' })).toBeVisible();

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, TITLE);
  });
});
