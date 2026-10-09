import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * R65 验收：条件显示全链路。
 *
 * 一条用例从「在编辑器里给追问配显示条件」走到「作答端追问随答案出现 / 消失 → 提交」——
 * 这正是所有者给的那个场景：只有选了「不满意」，才需要问「哪里不满意」。
 *
 * 断言的顺序是刻意的：**先确认它默认不在**（条件真的生效了），再确认命中选择后出现，
 * 最后确认改回不命中又消失（级联与「草稿保留、提交剔除」的口径都在这条链路上）。
 */
const TITLE = 'E2E 条件显示用例';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
}

async function clearLeftovers(page: Page, title: string) {
  const menu = page.getByRole('button', { name: `「${title}」更多操作` });

  for (let remaining = await menu.count(); remaining > 0; remaining -= 1) {
    await menu.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(menu).toHaveCount(remaining - 1);
  }
}

test.describe('条件显示', () => {
  test.setTimeout(300_000);

  test('追问随答案出现 / 消失 → 提交只写可见题', async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '写操作只在桌面端跑');

    await signIn(page);
    await clearLeftovers(page, TITLE);

    // ---- 造一份「满意吗？→（不满意才问）哪里不满意？」的问卷 ----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/, { timeout: 90_000 });
    const questionnaireId = page.url().match(/\/app\/q\/([^/]+)\//)![1]!;
    await page.getByLabel('问卷标题').fill(TITLE);

    // Q1：单选，两个选项改成「满意 / 不满意」
    await page.getByRole('button', { name: '单选', exact: true }).click();
    await page.getByLabel('题目', { exact: true }).fill('你对本次服务满意吗？');
    await page.getByLabel('选项文案').nth(0).fill('满意');
    await page.getByLabel('选项文案').nth(1).fill('不满意');

    // Q2：单行填空（追问）
    await page.getByRole('button', { name: '单行填空', exact: true }).click();
    await page.getByLabel('题目', { exact: true }).fill('哪里不满意？');

    // ---- 给 Q2 配显示条件：当 Q1 选了「不满意」时显示 ----
    await page.getByRole('button', { name: '逻辑', exact: true }).click();
    await page.getByRole('switch', { name: '仅满足条件时显示' }).click();
    // 依赖题默认就是上一个可引用的题（Q1）；打开开关时默认勾了第一个选项（满意），
    // 这里要改成「只在选了不满意时显示」—— 先取消满意，再勾不满意
    // （`exact` 不能省：Playwright 的名称是子串匹配，「满意」会同时命中「不满意」）
    await expect(page.getByRole('checkbox', { name: '满意', exact: true })).toBeChecked();
    await page.getByRole('checkbox', { name: '满意', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: '不满意', exact: true }).check();

    // 画布上出现条件条（块首那一行），摘要也标了「条件显示」
    await expect(page.getByText(/当 Q1「你对本次服务满意吗？」选了「不满意」时显示/)).toBeVisible();
    await expect(page.getByText('条件显示')).toBeVisible();

    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    // ---- 发布 ----
    const tabs = page.getByRole('navigation', { name: '问卷内页面' });
    await tabs.getByRole('link', { name: '发布设置' }).click();
    await page.getByRole('button', { name: '保存并发布' }).click();
    await expect(page.getByRole('status')).toContainText('已发布');

    await tabs.getByRole('link', { name: '分享' }).click();
    const slug = (await page.getByText(/\/s\//).first().textContent())!.split('/s/')[1]!;

    // ---- 作答端：追问默认不在 ----
    const visitor = await browser.newContext();
    const form = await visitor.newPage();

    await form.goto(`/s/${slug}`);
    await expect(form.getByText(/共 1 题/)).toBeVisible();
    await expect(form.getByRole('heading', { name: '哪里不满意？' })).toHaveCount(0);

    // 选「不满意」→ 追问出现（题数从 1 变 2）
    await form.getByRole('button', { name: '不满意', exact: true }).click();
    await expect(form.getByText(/共 2 题/)).toBeVisible();
    await expect(form.getByRole('heading', { name: '哪里不满意？' })).toBeVisible();

    // 改回「满意」→ 追问消失
    await form.getByRole('button', { name: '满意', exact: true }).click();
    await expect(form.getByText(/共 1 题/)).toBeVisible();
    await expect(form.getByRole('heading', { name: '哪里不满意？' })).toHaveCount(0);

    // 再选「不满意」并把追问填上 → 提交
    await form.getByRole('button', { name: '不满意', exact: true }).click();
    await expect(form.getByRole('heading', { name: '哪里不满意？' })).toBeVisible();
    await form.getByLabel('哪里不满意？').fill('等得太久了');
    await form.getByRole('button', { name: /提交答卷/ }).click();
    await expect(form).toHaveURL(/\/s\/[^/]+\/done\?r=/, { timeout: 60_000 });
    await expect(form.getByRole('heading', { name: '提交成功' })).toBeVisible();

    await visitor.close();

    // ---- 统计：两道题各有一份作答（追问真的写库了） ----
    await page.goto(`/app/q/${questionnaireId}/stats`);
    await expect(page.getByText('有效作答 1 人').first()).toBeVisible();
    await expect(page.getByText('等得太久了')).toBeVisible();
  });
});
