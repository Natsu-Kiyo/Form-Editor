import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M7 验收：答卷明细（W07）。
 *
 * 拿 seed 里那份「2026 秋季社团招新报名」（已有上百份答卷）当靶子，验的核心是
 * **「标无效」在两个页面之间是否自洽** —— 也就是 M6 收尾时留下、留到这里才验的那条：
 * 统计页的有效答卷要跟着降，而明细里那份答卷**必须还在**
 * （设计稿 W07 原话：「标记后该答卷将从统计图表中排除，但原始记录保留」）。
 *
 * 用例只动 seed 数据里的**一条**，结束时恢复为有效 —— 反复跑不会留下脏数据。
 */
const TITLE = '2026 秋季社团招新报名';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** 从列表进这份问卷的大盘 */
async function openStats(page: Page) {
  await page.goto('/app');
  await page.getByRole('link', { name: `数据「${TITLE}」` }).click();
  await expect(page).toHaveURL(/\/stats$/);
}

async function openResponses(page: Page) {
  await page
    .getByRole('navigation', { name: '问卷内页面' })
    .getByRole('link', { name: '答卷' })
    .click();
  await expect(page).toHaveURL(/\/responses$/);
}

/**
 * 把库里可能残留的「已标记无效」还原。
 *
 * 用例自己会恢复它标掉的那一条，但**跑到一半失败**时就恢复不了 ——
 * 而「暂无无效答卷」这条断言会让下一次运行直接红掉。与其让用例变成
 * 「一失败就再也跑不过」，不如每次开头自己收拾干净（与问卷列表那条同款）。
 *
 * 只清第一页：被标无效的都是最新那几份，而表按提交时间倒序，所以它们一定在前面。
 */
async function restoreLeftovers(page: Page) {
  const restoreButtons = page.getByRole('button', { name: /^恢复答卷 #/ });

  for (let remaining = await restoreButtons.count(); remaining > 0; remaining -= 1) {
    await restoreButtons.first().click();
    await expect(restoreButtons).toHaveCount(remaining - 1);
  }
}

test.describe('答卷明细', () => {
  test.setTimeout(240_000);

  test('标无效 → 统计跟着降 → 明细里那份还在 → 恢复', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '写操作只在桌面端跑');

    await signIn(page);

    // 先进这份问卷（从列表卡片的「数据」入口），之后才能在问卷内 Tab 之间来回
    await openStats(page);

    // ---- 先收拾上一次失败可能留下的无效标记 ----
    await openResponses(page);
    await restoreLeftovers(page);

    // ---- 回到统计页：确认起点是干净的（seed 数据里没有无效答卷）----
    await openStats(page);
    await expect(page.getByText('暂无无效答卷')).toBeVisible();

    await openResponses(page);

    // ---- 表格与计数 ----
    await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '提交时间' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible();

    const counts = page.getByText(/^共 \d+ 份 · 有效 \d+ 份/);
    await expect(counts).toBeVisible();
    const total = Number(/(\d+) 份/.exec((await counts.textContent()) ?? '')?.[1] ?? 0);
    expect(total).toBeGreaterThan(10);

    // 编号是**全局名次**：最新的一份编号就是总数
    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toContainText(String(total));

    // ---- 分页 ----
    await expect(page.getByText(`显示 1–10 条，共 ${total} 条`)).toBeVisible();
    await page.getByRole('link', { name: '下一页' }).click();
    await expect(page.getByText(`显示 11–20 条，共 ${total} 条`)).toBeVisible();
    await page.getByRole('link', { name: '上一页' }).click();
    await expect(page.getByText(`显示 1–10 条，共 ${total} 条`)).toBeVisible();

    // ---- 详情：右侧一栏，逐题答案 + 元信息 ----
    await firstRow.getByRole('link', { name: /^查看答卷 #/ }).click();
    // 按**名字**定位这一栏：页面外壳的侧栏也是 `<aside>`（这里踩过一次）
    const detail = page.getByRole('complementary', { name: '答卷详情' });
    await expect(detail.getByText(`答卷 #${total}`)).toBeVisible();
    await expect(detail.getByText('渠道', { exact: true })).toBeVisible();
    await expect(detail.getByText('身份', { exact: true })).toBeVisible();
    // seed 的这份问卷有 6 道题，且都答过（选项 / 评分 / 填空三种形态）
    await expect(detail.getByText(/^Q1 · /)).toBeVisible();

    // 关闭 = 去掉 URL 上的 selected（不是返回上一页），列表本身不动
    await page.getByRole('link', { name: '关闭详情' }).click();
    await expect(detail).toHaveCount(0);
    await expect(firstRow).toBeVisible();

    // 再打开一次 —— 后面要在详情里点那颗按钮
    await firstRow.getByRole('link', { name: /^查看答卷 #/ }).click();
    await expect(detail.getByText(`答卷 #${total}`)).toBeVisible();

    // ---- 标记为无效 ----
    await detail.getByRole('button', { name: '标记为无效答卷' }).click();
    await expect(detail.getByText('已标记无效')).toBeVisible();
    await expect(firstRow.getByText('已标记无效')).toBeVisible();

    // ---- 统计页立刻反映（M6 验收里那条）----
    await openStats(page);
    await expect(page.getByText('含 1 份已标记无效')).toBeVisible();

    // ---- 明细里那份答卷**还在**（原始记录保留）----
    await openResponses(page);
    await expect(page.getByText(/^共 \d+ 份 · 有效 \d+ 份/)).toBeVisible();
    await expect(page.getByText('已标记无效').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^恢复答卷 #/ })).toBeVisible();

    // 注意：从 Tab 过来时 URL 上没有 `selected`，右栏本来就是关着的 ——
    // 详情里也有「已标记无效」这几个字，若它开着会干扰下面的计数断言
    // （`getByText` 是子串匹配，断言前先想清楚一共几处）

    // ---- 「显示无效答卷」收起它们，再放回来 ----
    // 用 click 而不是 uncheck：这个勾选框由 URL 驱动，翻转要等一次服务端往返，
    // 而 uncheck 点完立刻断言 DOM 状态 —— 那是测试的时序假设，不是产品行为
    const toggle = page.getByRole('checkbox', { name: '显示无效答卷' });
    await expect(toggle).toBeChecked();

    await toggle.click();
    await expect(page).toHaveURL(/invalid=hide/);
    await expect(page.getByText(/当前筛选/)).toBeVisible();
    await expect(page.getByText('已标记无效')).toHaveCount(0);

    await toggle.click();
    await expect(page).not.toHaveURL(/invalid=hide/);
    await expect(page.getByText('已标记无效').first()).toBeVisible();

    // ---- 恢复为有效，并把统计口径还原（收尾）----
    await page.getByRole('button', { name: /^恢复答卷 #/ }).click();
    await expect(page.getByText('已标记无效')).toHaveCount(0);

    await openStats(page);
    await expect(page.getByText('暂无无效答卷')).toBeVisible();
  });
});
