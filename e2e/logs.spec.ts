import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M8-b 验收：操作日志（W10）+ 查看者的越权走查。
 *
 * 日志页要验的是「**记下来的能读**」：先做两个真动作（暂停 / 恢复回收，都可逆），
 * 再回日志页确认那两句读得通；顺便验筛选与导出（CSV 带 BOM）。
 *
 * 第二条用例是权限矩阵的走查：以查看者登录时，列表页的写入口**完全不出现**。
 */
const TITLE = '2026 秋季社团招新报名';

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(account.email);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe('操作日志与越权走查', () => {
  test.setTimeout(240_000);

  test('做两个动作 → 日志读得通 → 筛选与导出可用', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');

    await signIn(page, DEMO_ACCOUNTS.owner);

    // ---- 造两条日志：暂停 / 恢复回收（都可逆，跑完数据回到原样）----
    await page.getByRole('link', { name: `分享「${TITLE}」` }).click();
    await expect(page).toHaveURL(/\/share$/);

    await page.getByRole('button', { name: '暂停回收' }).click();
    await expect(page.getByText('已暂停')).toBeVisible();
    await page.getByRole('button', { name: '恢复回收' }).click();
    await expect(page.getByText('回收中')).toBeVisible();

    // ---- 日志页 ----
    await page.getByRole('link', { name: '操作日志' }).click();
    await expect(page).toHaveURL(/\/app\/logs$/);

    /*
     * 句子读得通：动词与问卷名都在。
     *
     * 注意**不要用一条正则跨过加粗的那一段** —— 句子是「前缀 + <b>对象</b> + 后缀」三段，
     * 文本匹配是按元素算的，跨元素的整句匹配不到（这个坑我踩了一次）。
     */
    await expect(page.getByText('暂停了问卷', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('恢复了问卷', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(TITLE).first()).toBeVisible();

    // 第二行是「时间 · 分组 · 补充」（单元素，可以整句断言）
    await expect(page.getByText(/状态变更 · 回收中 → 已暂停/).first()).toBeVisible();

    // ---- 筛选：只看「状态变更」仍然有这两条 ----
    await page.getByLabel('操作类型').selectOption('状态变更');
    await expect(page).toHaveURL(/group=/);
    await expect(page.getByText('暂停了问卷', { exact: false }).first()).toBeVisible();

    // ---- 导出：CSV 带 BOM（否则中文 Windows 双击是乱码）----
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: /导出日志/ }).click(),
    ]).then(([event]) => event);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks);

    expect(csv.subarray(0, 3).toString('hex')).toBe('efbbbf');
    expect(csv.toString('utf8')).toContain('时间');
    expect(csv.toString('utf8')).toContain(TITLE);
  });

  test('查看者：列表页的写入口完全不出现', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '窄屏侧栏没有这些入口');

    await signIn(page, DEMO_ACCOUNTS.viewer);

    // 创建问卷 = 编辑者权限 → 查看者看不到
    await expect(page.getByRole('button', { name: '新建问卷' })).toHaveCount(0);
    // 卡片的「⋯」菜单里全是写操作 → 整个按钮都不渲染
    await expect(page.getByRole('button', { name: /更多操作/ })).toHaveCount(0);
    // 但「看」的入口照旧：数据与分享
    await expect(page.getByRole('link', { name: `数据「${TITLE}」` })).toBeVisible();

    // 日志能看，但不能导出（导出要求管理员）
    await page.getByRole('link', { name: '操作日志' }).click();
    await expect(page).toHaveURL(/\/app\/logs$/);
    await expect(page.getByRole('link', { name: /导出日志/ })).toHaveCount(0);
  });
});
