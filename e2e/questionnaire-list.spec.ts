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

test('卡片底部的动作随状态换内容（W02 / P02）', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'desktop';
  await signIn(page);

  // 回收中：编辑 · 数据 · 分享 —— R47 起**两端都有「编辑」**（移动端编辑器已经可用了）
  await expect(page.getByRole('link', { name: '编辑「2026 秋季社团招新报名」' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: '数据「2026 秋季社团招新报名」' })).toBeVisible();
  await expect(page.getByRole('link', { name: '分享「2026 秋季社团招新报名」' })).toBeVisible();

  // 已暂停：数据与分享照旧可达（暂停只影响回收，不影响看与发）
  await expect(
    page.getByRole('link', { name: '数据「课程作业互评 · 用户体验设计」' }),
  ).toBeVisible();

  // 已截止：结构冻结，第一个位置换成「复制」（「复制」窄屏不渲染；「编辑」此时两端都没有）
  await expect(page.getByRole('button', { name: '复制「团建活动时间意愿投票」' })).toHaveCount(
    desktop ? 1 : 0,
  );
  await expect(page.getByRole('link', { name: '编辑「团建活动时间意愿投票」' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '分享「团建活动时间意愿投票」' })).toBeVisible();

  // 已归档：不能再分享，只剩「恢复」与「数据」
  await page.getByRole('link', { name: /^已归档/ }).click();
  await expect(
    page.getByRole('button', { name: '恢复「旧版功能使用情况摸底（已停用）」' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: '数据「旧版功能使用情况摸底（已停用）」' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: '分享「旧版功能使用情况摸底（已停用）」' }),
  ).toHaveCount(0);
});

test('全链路：新建 → 复制 → 归档 → 恢复 → 删除', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '会写数据库，只在一个 project 跑');
  test.setTimeout(120_000);

  await signIn(page);

  // ---- 先清掉可能存在的残留 ----
  // 空白创建的标题一律是「未命名问卷」，上一次失败留下的卡片会让后面的断言命中多个同名元素。
  // 与其让用例变得「一失败就再也跑不过」，不如自己收拾干净。
  const clearLeftovers = async () => {
    // 正则匹配**所有变体**：失败的那一轮可能停在「复制」之后，留下的是「未命名问卷（副本）」
    const leftovers = page.getByRole('button', { name: /^「未命名问卷/ });

    for (let remaining = await leftovers.count(); remaining > 0; remaining -= 1) {
      await leftovers.first().click();
      await page.getByRole('menuitem', { name: '删除问卷' }).click();
      await page.getByRole('button', { name: '确认删除' }).click();
      await expect(leftovers).toHaveCount(remaining - 1);
    }
  };

  // 注意：这里只清默认列表里的残留。
  // 如果某一轮**失败在「归档」之后**，那份副本会留在「已归档」里，
  // 需要人工清一次（归档卡的「⋯」菜单与普通卡不同，套用同一段清理会点不到「确认删除」）。
  await clearLeftovers();

  // ---- 新建（空白创建）→ 应该**直接进编辑器**，而不是回到列表 ----
  await page.getByRole('button', { name: '新建问卷' }).first().click();
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

  // 回列表：新建的这一份已经在里面
  await page.goto('/app');
  await expect(cardTitle(page, '未命名问卷')).toBeVisible();

  // ---- 卡片底部的三个动作（W02）：编辑 / 数据 / 分享 ----
  // 「点数据能打开」这条曾经挂过（统计页的查询里写了一个 schema 里没有的字段），
  // 而草稿问卷的统计页（0 份答卷）是当时唯一没人走过的路径
  await expect(page.getByRole('link', { name: '编辑「未命名问卷」' })).toBeVisible();
  await page.getByRole('link', { name: '数据「未命名问卷」' }).click();
  await expect(page).toHaveURL(/\/stats$/);

  await page.goto('/app');
  await page.getByRole('link', { name: '分享「未命名问卷」' }).click();
  await expect(page).toHaveURL(/\/share$/);

  await page.goto('/app');
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
