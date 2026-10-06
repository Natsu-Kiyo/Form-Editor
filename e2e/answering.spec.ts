import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M5 验收：作答 → 提交 → 结果页；刷新后草稿恢复；再打开是「已提交过」而非报错。
 *
 * 一条用例串起四件事，因为它们的**先后顺序本身就是被测对象**：
 * 草稿要在提交前恢复、提交后才变成「已提交过」、再次访问不能被拦成报错。
 */
const TITLE = 'E2E 作答用例';

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

test.describe('公开作答端', () => {
  test.setTimeout(300_000);

  test('作答 → 草稿恢复 → 提交 → 结果页 → 重复提交显示状态页', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '写操作只在桌面端跑');

    // ---- 造一份已发布、且有一道必答题的问卷 ----
    await signIn(page);
    await clearLeftovers(page, TITLE);

    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/, { timeout: 90_000 });
    // 统计页要用 id 打开，先把 id 记下来（后面会被导航带走）
    const questionnaireId = page.url().match(/\/app\/q\/([^/]+)\//)![1]!;
    await page.getByLabel('问卷标题').fill(TITLE);

    // 加一道单选题即可（默认选项就是「选项 1 / 选项 2」，够用来走完提交链路）。
    // 刻意不去改题目标题与必答开关：这条用例要守的是**作答与提交**，
    // 而「必答」规则由 `lib/__tests__/answers.test.ts` 穷举，两边各守一段。
    await page.getByRole('button', { name: '单选', exact: true }).click();

    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    const tabs = page.getByRole('navigation', { name: '问卷内页面' });
    await tabs.getByRole('link', { name: '发布设置' }).click();
    await page.getByRole('button', { name: '保存并发布' }).click();
    await expect(page.getByRole('status')).toContainText('已发布');

    await tabs.getByRole('link', { name: '分享' }).click();
    const slug = (await page.getByText(/\/s\//).first().textContent())!.split('/s/')[1]!;

    // ---- 访客作答（新的浏览器上下文：它就是「另一个人的手机」）----
    const visitor = await browser.newContext();
    const form = await visitor.newPage();

    await form.goto(`/s/${slug}`);
    await expect(form.getByRole('heading', { name: TITLE })).toBeVisible();

    // 答一题后**刷新**：草稿要恢复（断点续填）
    const firstOption = form.getByRole('button', { pressed: false }).first();
    const chosen = (await firstOption.textContent())!.trim();
    await firstOption.click();
    await form.reload();
    await expect(form.getByText('检测到上次未提交的内容')).toBeVisible();
    await expect(form.getByRole('button', { name: chosen, pressed: true })).toBeVisible();

    // ---- 提交 ----
    await form.getByRole('button', { name: /提交答卷/ }).click();
    await expect(form).toHaveURL(/\/s\/[^/]+\/done\?r=/, { timeout: 60_000 });
    await expect(form.getByRole('heading', { name: '提交成功' })).toBeVisible();
    // 答卷编号（#128 这种），以及答卷真的落库了
    await expect(form.getByText(/#\d+/)).toBeVisible();
    await expect(form.getByText(TITLE)).toBeVisible();

    // ---- 再打开链接：显示「已提交过」而不是报错 ----
    await form.goto(`/s/${slug}`);
    await expect(form.getByRole('heading', { name: '你已提交过这份问卷' })).toBeVisible();
    await expect(form.getByText('返回首页')).toBeVisible();

    // ---- 发布者截止回收后，换一个访客看到的是「已截止」 ----
    await page.getByRole('button', { name: '截止回收' }).click();
    await page.getByRole('button', { name: '确认截止' }).click();
    await expect(page.getByRole('banner').getByText('已截止')).toBeVisible();

    const otherVisitor = await browser.newContext();
    const otherPage = await otherVisitor.newPage();
    await otherPage.goto(`/s/${slug}`);
    await expect(otherPage.getByRole('heading', { name: '问卷已结束收集' })).toBeVisible();
    await expect(otherPage.getByText('已回收')).toBeVisible();

    await otherVisitor.close();
    await visitor.close();

    // ---- 统计页：数字要与刚才那一份答卷自洽 ----
    await page.goto(`/app/q/${questionnaireId}/stats`);

    // 精确匹配：`getByText` 也是子串匹配，而「有效答卷」这四个字
    // 还出现在卡片说明与题目卡脚注里（同一类坑这个项目已经踩了四次）
    await expect(page.getByText('回收份数', { exact: true })).toBeVisible();
    await expect(page.getByText('有效答卷', { exact: true })).toBeVisible();
    // 口径说明是「能核对数字」的唯一入口，所以它必须真的打得开
    await page.getByRole('button', { name: '有效答卷的口径说明' }).click();
    await expect(page.getByText('有效答卷 = 回收份数 − 已标记无效的')).toBeVisible();

    // 趋势图与单题图表都画出来了，且那道题的有效作答人数就是 1
    await expect(page.getByRole('img', { name: '回收趋势' })).toBeVisible();
    await expect(page.getByText('有效作答 1 人')).toBeVisible();

    // ---- 时间筛选：双日期选择器（替代原来的「最近 7 天」下拉）----
    // 没选时显示占位文案，一眼看出「没筛」，而不是拿一个「全部时间」把两件事混在一起
    await expect(page.getByRole('button', { name: '开始时间 - 结束时间' })).toBeVisible();
    // 粒度不再是可选项：按区间跨度自动定，并把结果标出来
    await expect(page.getByText('按日汇总 · 横轴为筛选区间')).toBeVisible();

    await page.getByRole('button', { name: '开始时间 - 结束时间' }).click();
    await page.getByLabel('开始时间', { exact: true }).fill('2020-01-01');
    await page.getByLabel('结束时间', { exact: true }).fill('2020-01-31');
    await expect(page).toHaveURL(/from=2020-01-01/);
    await expect(page).toHaveURL(/to=2020-01-31/);

    // 这个区间里没有答卷 → 卡片与题目卡都要认账，而不是继续显示刚才那一份
    await expect(page.getByText('本次筛选范围内还没有有效答卷')).toBeVisible();
    // 选完之后控件显示的是区间本身（不再是占位文案）
    await expect(page.getByRole('button', { name: '2020-01-01 - 2020-01-31' })).toBeVisible();

    // ---- 导出跟着筛选走：这个区间没有答卷，CSV 就该只有表头 ----
    await page.getByRole('button', { name: '导出' }).click();
    const filtered = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: '下载 CSV' }).click(),
    ]).then(([event]) => event);
    const filteredStream = await filtered.createReadStream();
    const filteredChunks: Buffer[] = [];
    for await (const chunk of filteredStream) filteredChunks.push(chunk as Buffer);
    const filteredCsv = Buffer.concat(filteredChunks);
    expect(filteredCsv.toString('utf8').split('\r\n').filter(Boolean)).toHaveLength(1);

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '2020-01-01 - 2020-01-31' }).click();
    await page.getByRole('button', { name: '清空' }).click();
    await expect(page).toHaveURL(/\/stats$/);
    await expect(page.getByText('有效作答 1 人')).toBeVisible();

    // ---- 导出：CSV 要被 Excel 正确打开（UTF-8 BOM），且表头是题目 ----
    await page.getByRole('button', { name: '导出' }).click();
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: '下载 CSV' }).click(),
    ]).then(([event]) => event);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks);

    // 前三个字节必须是 BOM：不加它在中文 Windows 上双击打开就是乱码
    expect(csv.subarray(0, 3).toString('hex')).toBe('efbbbf');
    expect(csv.toString('utf8')).toContain('提交时间');
    expect(csv.toString('utf8')).toContain('选项 1');

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, TITLE);
  });
});
