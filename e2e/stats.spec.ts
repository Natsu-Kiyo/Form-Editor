import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M6 验收：数据统计（W06 / P05）—— 这里只放**交互**这一类断言。
 * 数字口径由 `src/features/analytics/lib/stats.test.ts` 的单测盯着，
 * 端到端只验「能在页面上读出来、能操作」。
 *
 * 目前内容：趋势图的 hover 读值（R70）。
 */
const TITLE = '2026 秋季社团招新报名';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function openStats(page: Page) {
  await page.goto('/app');
  await page.getByRole('link', { name: `数据「${TITLE}」` }).click();
  await expect(page).toHaveURL(/\/stats$/);
}

test.describe('数据统计', () => {
  test('趋势图 hover：按横向位置读值，按周时写出覆盖的那一周', async ({ page }) => {
    await signIn(page);
    await openStats(page);

    const chart = page.getByRole('img', { name: '回收趋势' });
    await chart.scrollIntoViewIfNeeded();
    await expect(chart).toBeVisible();

    // 浮层是 hover 的视觉增强（`aria-hidden`）：按「含回收份数」把它从其它
    // aria-hidden 装饰里认出来。静止时它不该存在
    const tooltip = page.locator('div[aria-hidden="true"]').filter({ hasText: '回收份数' });
    await expect(tooltip).toHaveCount(0);

    const box = (await chart.boundingBox())!;
    const middleY = box.y + box.height / 2;

    // ---- 横向滑过左端：出现「日期 + 份数」 ----
    await page.mouse.move(box.x + 20, middleY);
    await expect(tooltip).toHaveCount(1);
    await expect(tooltip).toContainText(/\d{2}-\d{2}/);
    const leftText = await tooltip.textContent();

    // ---- 同一高度滑到右端：浮层换到另一天（这就是「按横向位置取最近点」）----
    await page.mouse.move(box.x + box.width - 20, middleY);
    await expect(tooltip).not.toHaveText(leftText ?? '');

    // ---- 移出图外：收起 ----
    await page.mouse.move(box.x + box.width / 2, box.y - 40);
    await expect(tooltip).toHaveCount(0);

    /*
     * ---- 跨度大到按周汇总（> 62 天）：浮层要说清「这个点覆盖一整周」----
     * 只写起点（08-17）会让人以为 hover 漏了 08-18~08-23 —— 它们被包在那一周里。
     */
    const weekly = new URL(page.url());
    weekly.searchParams.set('from', '2026-08-03');
    weekly.searchParams.set('to', '2026-10-05');
    await page.goto(weekly.toString());
    await expect(page.getByText('按周汇总 · 横轴为筛选区间')).toBeVisible();

    const weeklyChart = page.getByRole('img', { name: '回收趋势' });
    await weeklyChart.scrollIntoViewIfNeeded();
    const weeklyBox = (await weeklyChart.boundingBox())!;
    await page.mouse.move(weeklyBox.x + weeklyBox.width / 2, weeklyBox.y + weeklyBox.height / 2);
    await expect(tooltip).toContainText(/\d{2}-\d{2} ~ \d{2}-\d{2}/);
  });
});
