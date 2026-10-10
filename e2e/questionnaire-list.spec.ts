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

/**
 * 走完「⋯ → 删除问卷 → 确认删除」，一直到**弹窗真的从 DOM 里消失**。
 *
 * 等弹窗、而不是直接等卡片标题消失：R78 起弹窗会一直停到列表落地才退场，
 * 「弹窗没了」就等于「这张卡片也没了」。反过来用 `getByRole` 等标题会**假通过** ——
 * 弹窗开着时 Radix 会给背景加 `aria-hidden`，标题在可访问性树里"已经消失"了。
 */
async function deleteCard(page: Page, title: string) {
  await openCardMenu(page, title);
  await page.getByRole('menuitem', { name: '删除问卷' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
}

/**
 * 清掉可能残留的「未命名问卷*」卡片（上一次跑失败留下的）。
 *
 * 用 CSS 定位而不是 `getByRole`：删除进行中弹窗会给背景加 `aria-hidden`，
 * 拿可访问性树数卡片会数出一个假的 0、循环提前结束（R78 这轮踩到）。
 * 定位器直接复用（连「（副本）」变体一起删），不走 `deleteCard` 的标题匹配。
 */
async function clearUnnamedLeftovers(page: Page) {
  const leftovers = page.locator('button[aria-label^="「未命名问卷"]');

  // 先等列表**渲染出来**再数残留：`count()` 在卡片出现前会安静地返回 0
  await expect(page.getByRole('button', { name: '新建问卷' }).first()).toBeVisible();

  while ((await leftovers.count()) > 0) {
    await leftovers.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  }
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

  // ---- 先清掉可能存在的残留（定义见上面的 helper）----
  // 注意：这里只清默认列表里的残留。
  // 如果某一轮**失败在「归档」之后**，那份副本会留在「已归档」里，
  // 需要人工清一次（归档卡的「⋯」菜单与普通卡不同，套用同一段清理会点不到「确认删除」）。
  await clearUnnamedLeftovers(page);

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
    await deleteCard(page, title);
  }
});

test('删除的等待态：弹窗与卡片在同一批消失（不会先关弹窗、再"闪"一下列表）', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '会写数据库，只在一个 project 跑');
  test.setTimeout(120_000);

  await signIn(page);
  await clearUnnamedLeftovers(page);

  // 新建一张空白问卷（0 份答卷 → 删除本身快，量到的是"先后"而不是"服务端慢"）
  await page.getByRole('button', { name: '新建问卷' }).first().click();
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);
  await page.goto('/app');

  const target = page.locator('button[aria-label^="「未命名问卷」"]');
  await expect(target).toHaveCount(1);

  /*
   * 采样器：每次 DOM 变化后记一行「弹窗数 + 卡片数」。
   *
   * - 在 DOM 层数、不用 `getByRole`：弹窗打开时 Radix 会给背景加 `aria-hidden`，
   *   卡片在可访问性树里"消失" —— 用 getByRole 数只能得到永远为 0 的假象（本轮踩过）；
   * - observer 必须存到 window：不存引用会被 GC，观察会悄悄停掉（本轮也踩过）。
   */
  await page.evaluate(() => {
    const w = window as unknown as { __log: string[]; __observer?: MutationObserver };
    w.__log = [];
    let last = '';
    const snap = () => {
      const state = `dialog=${document.querySelectorAll('[role="dialog"]').length} cards=${
        document.querySelectorAll('button[aria-label$="」更多操作"]').length
      }`;
      if (state === last) return;
      last = state;
      w.__log.push(state);
    };
    snap();
    w.__observer = new MutationObserver(snap);
    w.__observer.observe(document.body, { childList: true, subtree: true });
  });

  await deleteCard(page, '未命名问卷');
  await page.waitForTimeout(400);

  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);

  // 弹窗收起（dialog 1 → 0）的那一批里，卡片必须**同时**少一张。
  // 旧实现会先关弹窗、一秒多之后才更新列表 —— 那一批是「dialog=0 cards=N」，
  // 用户看到的就是「弹窗没了，列表过一会儿才闪一下」。
  const closeIndex = log.findIndex(
    (line, index) => index > 0 && line.includes('dialog=0') && log[index - 1].includes('dialog=1'),
  );
  expect(closeIndex, `没找到弹窗收起的时刻：${JSON.stringify(log)}`).toBeGreaterThan(0);

  const before = Number(log[closeIndex - 1].match(/cards=(\d+)/)?.[1]);
  const at = Number(log[closeIndex].match(/cards=(\d+)/)?.[1]);
  expect(at, `弹窗收起时卡片数应与之一并变化：${JSON.stringify(log)}`).toBe(before - 1);
});

test('切状态筛选有等待态：列表区换成骨架，工具条与汇总卡保持在场', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '两端共用同一组件，桌面已覆盖');

  await signIn(page);
  await expect(page.getByRole('button', { name: '新建问卷' }).first()).toBeVisible();

  /*
   * 与模板中心切 Tab 那条同款手法：把这次导航的 RSC 请求按住 1.2 秒。
   * 真实环境里骨架只闪一两百毫秒，直接断言会时有时无 —— 它验的是「时序存在」。
   * 换筛选是**同路由换参数**，`loading.tsx` 的边界不会重挂，骨架得由
   * `QuestionnaireBoard` 自己摆（R80）。
   */
  await page.route('**/app*', async (route) => {
    if (route.request().url().includes('_rsc')) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
    await route.continue();
  });

  await page.getByRole('link', { name: /^草稿/ }).click();

  // 骨架出现（含给读屏的那句），且**只换列表区**：刚点的胶囊与汇总卡保持在场
  const skeleton = page.locator('main [aria-busy="true"]');
  await expect(skeleton).toBeVisible();
  await expect(skeleton.getByText('正在加载问卷列表…')).toBeAttached();
  await expect(page.getByRole('link', { name: /^草稿/ })).toBeVisible();
  await expect(page.getByText('全部问卷')).toBeVisible();

  // 数据落地：骨架退场、URL 变、列表按新筛选渲染
  await expect(skeleton).toHaveCount(0);
  await expect(page).toHaveURL(/status=DRAFT/);

  await page.unroute('**/app*');
});
