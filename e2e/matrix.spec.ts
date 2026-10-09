import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * R62 验收：矩阵题全链路。
 *
 * 一条用例从「编辑器加一道矩阵题」一路走到「统计页每行一个分布」——
 * 中间每一段都是这次新写的：payload schema 的行列校验、属性面板的列编辑、
 * 作答端的逐行单选与对象值、提交链路的必答口径、统计的每行独立分母。
 * 拆成几条短用例反而要各自重复造数据，而这条链路的**连贯性本身**就是被测对象。
 */
const TITLE = 'E2E 矩阵用例';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
}

/** 清掉上次跑剩下的同名问卷（写法与 answering.spec 一致） */
async function clearLeftovers(page: Page, title: string) {
  const menu = page.getByRole('button', { name: `「${title}」更多操作` });

  for (let remaining = await menu.count(); remaining > 0; remaining -= 1) {
    await menu.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(menu).toHaveCount(remaining - 1);
  }
}

test.describe('矩阵题', () => {
  test.setTimeout(300_000);

  test('建题改列 → 必答拦截 → 逐行作答 → 统计每行一个分布 → CSV 按行摊列', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '写操作只在桌面端跑');

    await signIn(page);
    await clearLeftovers(page, TITLE);

    // ---- 造一份含矩阵题、且必答的问卷 ----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/, { timeout: 90_000 });
    const questionnaireId = page.url().match(/\/app\/q\/([^/]+)\//)![1]!;
    await page.getByLabel('问卷标题').fill(TITLE);

    // 加一道矩阵题：默认 2 行 × 3 列（「行 1 / 行 2」×「满意 / 一般 / 不满意」）
    await page.getByRole('button', { name: '矩阵', exact: true }).click();
    await expect(page.getByText('矩阵 2 行 × 3 列')).toBeVisible();
    await page.getByLabel('题目', { exact: true }).fill('请为以下环节打分');

    // 行与选项同一处编辑（画布上的列表）：把第一行改掉
    await page.getByLabel('行文案').first().fill('响应速度');

    // 列在右栏编辑：加一列，摘要跟着变
    await page.getByRole('button', { name: '添加列' }).click();
    // 用 role 定位：`getByLabel('第 4 列')` 会同时命中「删除第 4 列」那颗按钮（子串匹配）
    await page.getByRole('textbox', { name: '第 4 列' }).fill('很不满意');
    await expect(page.getByText('矩阵 2 行 × 4 列')).toBeVisible();

    /*
     * 回归（R62 修）：清空一格**只是空着**，不能当场把那一列删掉、更不能把列数拉到下限以下。
     * 之前这里用了读取侧的 `matrixColumns()`（过滤空串），清空即消失。
     */
    await page.getByRole('textbox', { name: '第 4 列' }).fill('');
    await expect(page.getByRole('textbox', { name: '第 4 列' })).toHaveValue('');
    await expect(page.getByText('矩阵 2 行 × 4 列')).toBeVisible();
    // 其它列不受牵连（「第 1 列」还是它原来的值）
    await expect(page.getByRole('textbox', { name: '第 1 列' })).toHaveValue('满意');
    // 补回文案（失焦时也会自动补成占位）
    await page.getByRole('textbox', { name: '第 4 列' }).fill('很不满意');

    // 必答（矩阵的口径 = 每一行都要选）
    await page.getByRole('switch', { name: '必填' }).click();

    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    // ---- 发布 ----
    const tabs = page.getByRole('navigation', { name: '问卷内页面' });
    await tabs.getByRole('link', { name: '发布设置' }).click();
    await page.getByRole('button', { name: '保存并发布' }).click();
    await expect(page.getByRole('status')).toContainText('已发布');

    await tabs.getByRole('link', { name: '分享' }).click();
    const slug = (await page.getByText(/\/s\//).first().textContent())!.split('/s/')[1]!;

    // ---- 访客作答（新的上下文 = 另一个人的浏览器）----
    const visitor = await browser.newContext();
    const form = await visitor.newPage();

    await form.goto(`/s/${slug}`);

    // 一行都不选直接提交 → 被拦，且文案说的是矩阵自己的口径
    await form.getByRole('button', { name: /提交答卷/ }).click();
    await expect(form.getByText('每一行都要选')).toBeVisible();

    // 逐行点选（可访问名是「行：列」）；只选一行**仍然**要被拦下
    await form.getByRole('button', { name: '响应速度：满意' }).click();
    await form.getByRole('button', { name: /提交答卷/ }).click();
    await expect(form.getByText('每一行都要选')).toBeVisible();

    // 第二行也选上 → 放行
    await form.getByRole('button', { name: '行 2：一般' }).click();
    await form.getByRole('button', { name: /提交答卷/ }).click();
    await expect(form).toHaveURL(/\/s\/[^/]+\/done\?r=/, { timeout: 60_000 });
    await expect(form.getByRole('heading', { name: '提交成功' })).toBeVisible();

    await visitor.close();

    // ---- 统计：一行一个分布，分母是该行的作答人数 ----
    await page.goto(`/app/q/${questionnaireId}/stats`);
    await expect(page.getByText('矩阵', { exact: true })).toBeVisible();
    await expect(page.getByText('有效作答 1 人 · 每行的分母是该行作答人数')).toBeVisible();

    // 两行都在，且各自有一条「满意」的分布（1 人 100%）
    await expect(page.getByText('响应速度', { exact: true })).toBeVisible();
    await expect(page.getByText('行 2', { exact: true })).toBeVisible();
    await expect(page.getByText('1 人评价').first()).toBeVisible();

    // ---- 导出：矩阵按行摊成多列（表头是「题目标题 - 行名」）----
    await page.getByRole('button', { name: '导出' }).click();
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: '下载 CSV' }).click(),
    ]).then(([event]) => event);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString('utf8');

    expect(csv).toContain('请为以下环节打分 - 响应速度');
    expect(csv).toContain('请为以下环节打分 - 行 2');
    expect(csv).toContain('满意');
    expect(csv).toContain('一般');

    await page.keyboard.press('Escape');
  });
});
