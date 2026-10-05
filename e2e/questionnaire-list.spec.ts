import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M2 验收：问卷列表与生命周期（W02）。
 *
 * 生成数据的用例**只在 desktop project 跑**：两个 project 共用同一个演示数据库，
 * 并行跑同一套「新建 → 复制 → 删除」会互相抢同一张卡片
 * （空白创建出来的标题都是「未命名问卷」）。只读断言则两端都跑。
 *
 * 用例自身负责收尾：结束时把新建的卡片删掉，保证反复跑不会堆积。
 */

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** 打开某张卡片的「⋯」菜单 */
async function openCardMenu(page: Page, title: string) {
  await page
    .getByRole('button', { name: `「${title}」更多操作` })
    .first()
    .click();
}

/** 卡片标题是否出现（用 sr-only 之外的真实标题文本定位） */
function cardTitle(page: Page, title: string) {
  return page.getByRole('heading', { name: title, exact: true });
}

test('列表渲染汇总数字、状态胶囊与问卷卡片', async ({ page }) => {
  await signIn(page);

  await expect(page.getByText('全部问卷')).toBeVisible();
  await expect(page.getByText('累计答卷')).toBeVisible();

  // seed 里的旗舰问卷
  await expect(cardTitle(page, '2026 秋季社团招新报名')).toBeVisible();
  // 已归档的默认被折叠，不在「全部」里
  await expect(cardTitle(page, '旧版功能使用情况摸底（已停用）')).toHaveCount(0);
});

test('状态筛选与搜索走 URL，刷新后仍然生效', async ({ page }) => {
  await signIn(page);

  await page.getByRole('link', { name: /^已归档/ }).click();
  await expect(page).toHaveURL(/status=ARCHIVED/);
  await expect(cardTitle(page, '旧版功能使用情况摸底（已停用）')).toBeVisible();

  // 重新打开这个 URL 依然只看到已归档
  await page.reload();
  await expect(cardTitle(page, '旧版功能使用情况摸底（已停用）')).toBeVisible();
  await expect(cardTitle(page, '2026 秋季社团招新报名')).toHaveCount(0);
});

test('全链路：新建 → 复制 → 归档 → 恢复 → 删除', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '会写数据库，只在一个 project 跑');
  test.setTimeout(120_000);

  await signIn(page);

  // ---- 新建（空白创建） ----
  await page.getByRole('button', { name: '新建问卷' }).first().click();
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(cardTitle(page, '未命名问卷')).toBeVisible();

  const printed = '未命名问卷（副本）';

  // ---- 复制 ----
  await openCardMenu(page, '未命名问卷');
  await page.getByRole('menuitem', { name: '复制问卷' }).click();
  await expect(cardTitle(page, printed)).toBeVisible();

  // ---- 归档 ----
  await openCardMenu(page, printed);
  await page.getByRole('menuitem', { name: '归档' }).click();
  await expect(cardTitle(page, printed)).toHaveCount(0);

  // ---- 在「已归档」里找到并恢复 ----
  await page.getByRole('link', { name: /^已归档/ }).click();
  await expect(cardTitle(page, printed)).toBeVisible();

  // 恢复到具体是哪一张卡：已归档列表里还有 seed 的问卷，不能点错
  await page.getByRole('button', { name: `恢复「${printed}」` }).click();

  // 恢复后不再出现在「已归档」里（从未发布过 → 回到草稿）
  await expect(cardTitle(page, printed)).toHaveCount(0);

  // ---- 删除两张卡，收尾 ----
  for (const title of [printed, '未命名问卷']) {
    await page.goto('/app');
    await openCardMenu(page, title);
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(cardTitle(page, title)).toHaveCount(0);
  }
});
