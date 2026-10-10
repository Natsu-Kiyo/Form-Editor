import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M9 验收：模板中心（W08）。
 *
 * 三条用例对应三条验收口径：
 * 1. 官方模板两态都有内容（8 张，覆盖五个分类）、分类与搜索能用、预览是**作答页的样子**；
 * 2. 「使用此模板」**不出现中间确认层**，落地即编辑器且题目已就绪；
 * 3. 「我的模板」能重命名、能删除（用自己造出来的模板删，不动演示数据）。
 */
const OFFICIAL_COUNT = 8;

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function openTemplates(page: Page) {
  await page.getByRole('link', { name: '模板中心' }).click();
  await expect(page).toHaveURL(/\/app\/templates$/);
}

/** 网格里有八张同形卡，所以一律按带标题的可访问名定位 */
const useButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `使用此模板「${title}」` });
const previewButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `预览「${title}」` });

test.describe('模板中心', () => {
  test.setTimeout(240_000);

  test('公开模板：官方 8 张 + 已公开的都在池子里、分类与搜索、预览以作答页呈现', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '写操作只在桌面端跑');

    await signIn(page);
    await openTemplates(page);

    // ---- 公开池 = 官方 8 张 ∪ 各工作区已公开的 ----
    // 不再断言精确张数：池子会随「有人公开了模板」增长（seed 至少公开一张演示数据）。
    // 官方那 8 张是地板。用 poll 而不是即时 count —— 列表是流式渲染的，
    // 页面刚到就数会数到 0。
    const useButtons = page.getByRole('button', { name: /^使用此模板「/ });
    await expect.poll(() => useButtons.count()).toBeGreaterThanOrEqual(OFFICIAL_COUNT);
    await expect(page.getByText('用户满意度调研')).toBeVisible();
    // seed 里那张「已公开」的演示模板（它的来源行就是公开池的证据）
    await expect(previewButton(page, '活动满意度回访')).toBeVisible();
    await expect(page.getByText('来自 轻问卷演示团队').first()).toBeVisible();

    // ---- 分类胶囊 ----
    await page.getByRole('button', { name: '考试测验' }).click();
    await expect(page).toHaveURL(/category=/);
    // 标题以 seed 为准（设计稿那张写的是「知识测验 / 考试」，库里叫「知识小测 / 考试」）
    await expect(previewButton(page, '知识小测 / 考试')).toBeVisible();

    await page.getByRole('button', { name: '全部' }).click();
    await expect.poll(() => useButtons.count()).toBeGreaterThanOrEqual(OFFICIAL_COUNT);

    // ---- 搜索（输入后 300ms 防抖才改 URL）----
    await page.getByLabel('搜索模板').fill('NPS');
    await expect(previewButton(page, 'NPS 净推荐值')).toBeVisible();
    await expect(useButtons).toHaveCount(1);

    // ---- 预览：以作答页的样子呈现，而不是元数据 ----
    await previewButton(page, 'NPS 净推荐值').click();
    await expect(page.getByText('以下是这份模板的作答界面示意（不可填写）')).toBeVisible();
    await expect(page.getByText('你有多大可能把我们推荐给朋友？')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('以下是这份模板的作答界面示意（不可填写）')).toHaveCount(0);
  });

  test('使用此模板：不加确认层，落地即编辑器且题目就绪', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');

    await signIn(page);
    await openTemplates(page);

    await useButton(page, '投票表决').click();

    // 直接进编辑器（没有「确定要使用这个模板吗」这类中间层）
    await expect(page).toHaveURL(/\/app\/q\/[\w-]+\/edit$/);
    // 题目已经就绪：模板里那道多选题已经在画布上
    // （用 first：同一句话在画布、属性面板的标题字段等处会出现多次）
    await expect(page.getByText('你能参加的时段').first()).toBeVisible();
  });

  test('我的模板：另存为模板 → 重命名 → 删除', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');

    const created = `E2E 临时模板 ${Date.now()}`;
    const renamed = `${created}（改名）`;

    await signIn(page);

    /*
     * 分类是**必填**的（这个字段出现之前，自建模板被写死成一个旧分类）。
     * 这里走「新增分类」支路，顺带验它建完能被筛出来。
     * 名字带时间戳：分类名在同一工作区内不可重复，固定的名字第二次跑就撞了。
     */
    const newCategory = `E2E 分类 ${Date.now()}`;

    // ---- 造一张自己的模板：列表卡片的「⋯」→ 另存为模板 ----
    await page
      .getByRole('button', { name: /更多操作/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: '另存为模板' }).click();
    await page.getByLabel('模板名称').fill(created);

    // 选「新增分类」→ 多出一个输入框
    await page.getByRole('combobox', { name: '模板分类' }).click();
    await page.getByRole('option', { name: /新增分类/ }).click();
    await page.getByLabel('新分类名称').fill(newCategory);
    await page.getByRole('button', { name: '保存模板' }).click();

    // ---- 它出现在「我的模板」里（tab 上还有数量角标）----
    await openTemplates(page);
    await page.getByRole('button', { name: /^我的模板/ }).click();
    await expect(page).toHaveURL(/tab=mine/);
    await expect(previewButton(page, created)).toBeVisible();
    // seed 造的三张也在（两态都有内容）
    await expect(previewButton(page, '面试评分表')).toBeVisible();

    // ---- 刚建的新分类成了这一页的胶囊，而且真的能筛出东西 ----
    // （改之前胶囊是写死的五个常量，用户自建的分类无处可点）
    await page.getByRole('button', { name: newCategory }).click();
    await expect(previewButton(page, created)).toBeVisible();
    await expect(previewButton(page, '面试评分表')).toHaveCount(0);

    // ---- 「新增分类」与现有分类重名时当场报错（借一个必有的常量分类名）----
    await page.goto('/app');
    await page
      .getByRole('button', { name: /更多操作/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: '另存为模板' }).click();
    await page.getByLabel('模板名称').fill(`${created} 重复分类`);
    await page.getByRole('combobox', { name: '模板分类' }).click();
    await page.getByRole('option', { name: /新增分类/ }).click();
    await page.getByLabel('新分类名称').fill('报名登记');
    await page.getByRole('button', { name: '保存模板' }).click();
    await expect(page.getByText('这个分类已经存在，直接从下拉里选它')).toBeVisible();
    await page.keyboard.press('Escape');

    // 回「我的模板」继续重命名 / 删除（上面为了试重名跳回了列表页，得先回模板中心）
    await openTemplates(page);
    await page.getByRole('button', { name: /^我的模板/ }).click();
    await expect(page.getByRole('button', { name: `更多操作「${created}」` })).toBeVisible();

    // ---- 重命名 ----
    await page.getByRole('button', { name: `更多操作「${created}」` }).click();
    await page.getByRole('menuitem', { name: '重命名' }).click();
    await page.getByLabel('模板名称').fill(renamed);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(previewButton(page, renamed)).toBeVisible();

    // ---- 删除（自清理：跑完不留数据）----
    await page.getByRole('button', { name: `更多操作「${renamed}」` }).click();
    await page.getByRole('menuitem', { name: '删除模板' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText(renamed)).toHaveCount(0);
  });

  test('公开与取消公开：角标、公开池可见（带来源）、取消后消失', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '写操作只在桌面端跑');

    /*
     * 名字**不要**用「公开模板」这个界面词：Playwright 的 name 是子串匹配，
     * Tab 按钮叫「公开模板」，模板名里再带这四个字，`getByRole('button', { name: '公开模板' })`
     * 就会把卡上的星标 / 预览 / 使用按钮一起命中（连带它们的 aria-label）——
     * 这个坑本项目已经咬过三次，这里是第四次。
     */
    const created = `E2E 公开链路 ${Date.now()}`;
    const description = `${created} 的说明，用于验证公开与取消公开的完整链路。`;

    await signIn(page);

    // ---- 造一张自己的模板：分类选**官方常量**（公开门槛要求之一）----
    await page
      .getByRole('button', { name: /更多操作/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: '另存为模板' }).click();
    await page.getByLabel('模板名称').fill(created);
    await page.getByLabel('模板说明').fill(description);
    await page.getByRole('combobox', { name: '模板分类' }).click();
    await page.getByRole('option', { name: '信息收集', exact: true }).click();
    await page.getByRole('button', { name: '保存模板' }).click();

    // ---- 到「我的模板」公开它 ----
    await openTemplates(page);
    await page.getByRole('button', { name: /^我的模板/ }).click();

    /*
     * 「这张卡」本体的定位：卡片容器（`.group`）+ 卡上的预览按钮。
     *
     * 刻意**不用「全页数角标个数再 +1」**那种写法 —— 那是拿别人的数据当自己的基线
     * （实测踩过：手工测试在演示库里公开了好几张，计数法跟着一起飘）。
     */
    const createdCard = page.locator('div.group').filter({ has: previewButton(page, created) });

    await page.getByRole('button', { name: `更多操作「${created}」` }).click();
    await page.getByRole('menuitem', { name: '设为公开' }).click();

    /*
     * 弹层：描述已预填（另存时填的）；分类改成「**其他**」——
     * 官方五类之外的模板都归到它下面（X2 上线后补的兜底分类，这条路径要走真的）。
     */
    await page.getByRole('combobox', { name: '模板分类' }).click();
    await page.getByRole('option', { name: '其他', exact: true }).click();

    await expect(page.getByRole('button', { name: '确认公开' })).toBeVisible();
    await page.getByRole('button', { name: '确认公开' }).click();

    // 「公开」角标（设计稿 W08 贴在标题旁）出现在**这张卡**上
    await expect(createdCard.getByText('公开', { exact: true })).toBeVisible();

    // ---- 公开池里能看到它，且带来源（谁公开的一目了然）----
    // 顺序有讲究：**先搜、再切 Tab**。反过来的话，搜索框在切 Tab 的导航还没落地时
    // 就用旧 URL 重建查询串（把 tab=mine 又写回去），页面看起来「切了但没切」。
    // Tab 按钮用 exact：周围按钮的 aria-label 里可能带「公开」字样，子串匹配会命中一片。
    await page.getByLabel('搜索模板').fill(created);
    await expect(page).toHaveURL(/q=/);
    await page.getByRole('button', { name: '公开模板', exact: true }).click();
    await expect(page).not.toHaveURL(/tab=mine/);
    await expect(previewButton(page, created)).toBeVisible();
    await expect(page.getByText('来自 轻问卷演示团队').first()).toBeVisible();

    // ---- 「其他」胶囊：**有内容才出现**（空胶囊看起来像坏了），点它能筛出刚公开的这张 ----
    await page.getByRole('button', { name: '其他', exact: true }).click();
    await expect(page).toHaveURL(/category=/);
    await expect(previewButton(page, created)).toBeVisible();

    // ---- 取消公开（不需要二次确认：可撤销，重新公开即恢复）----
    await page.getByRole('button', { name: /^我的模板/ }).click();
    await page.getByRole('button', { name: `更多操作「${created}」` }).click();
    await page.getByRole('menuitem', { name: '取消公开' }).click();
    // toast 在 DOM 里有两份（aria-live 区），定位用 first
    await expect(page.getByText('已取消公开').first()).toBeVisible();

    // 角标跟着消失（可撤销的另一半：状态在两个方向上都要看得见）
    await expect(createdCard.getByText('公开', { exact: true })).toHaveCount(0);

    // 公开池里没有了（此时搜索词还是 created，切过去就是空列表）
    await page.getByRole('button', { name: '公开模板', exact: true }).click();
    await expect(previewButton(page, created)).toHaveCount(0);

    // ---- 自清理：删掉这张模板 ----
    await page.getByRole('button', { name: /^我的模板/ }).click();
    await page.getByRole('button', { name: `更多操作「${created}」` }).click();
    await page.getByRole('menuitem', { name: '删除模板' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText(created)).toHaveCount(0);
  });

  test('收藏：星标官方模板 → 我的模板顶部出现已收藏 → 取消收藏', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '写操作只在桌面端跑');

    const title = 'NPS 净推荐值';
    const star = page.getByRole('button', { name: `收藏「${title}」` });
    const unstar = page.getByRole('button', { name: `取消收藏「${title}」` });

    await signIn(page);
    await openTemplates(page);

    /*
     * 热身：先做一次**幂等**的按钮交互并等它的结果。
     *
     * 起因是一次真实的全量失败（单独跑通过、全量里挂）：列表刚导航到位就点星标，
     * 点击落在了 **hydration 之前** —— React 还没接管，onClick 没挂上，
     * 于是「没有 pending、没有 toast、库里也没写」三件事同时发生（当时的现场就是这三条）。
     * `<Link>` 类点击有原生跳转兜底、不怕这个，**按钮 onClick 会静默丢失**。
     *
     * 分类胶囊是幂等的（点「满意度调研」再点回「全部」）：URL 变了就说明
     * 页面已经能响应点击，之后再做真正的写操作。
     */
    await expect(async () => {
      await page.getByRole('button', { name: '满意度调研', exact: true }).click();
      await expect(page).toHaveURL(/category=/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    await expect(async () => {
      await page.getByRole('button', { name: '全部', exact: true }).click();
      await expect(page).not.toHaveURL(/category=/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // 自愈：上一次跑到一半失败时，收藏会留在库里
    if ((await unstar.count()) > 0) {
      await unstar.first().click();
      await expect(star.first()).toBeVisible();
    }

    /*
     * ---- 收藏 ----
     * 断言落在「星标真的翻转了」上，而不是 toast：toast 几秒后自己消失，
     * 拿它当断言会引入一条与功能无关的时序依赖（反馈的可见性由人眼走查覆盖）。
     */
    await star.first().click();
    await expect(unstar.first()).toBeVisible();

    // ---- 「我的模板」Tab 顶部出现「已收藏」分组，NPS 在里面 ----
    await page.getByRole('button', { name: /^我的模板/ }).click();
    await expect(page.getByRole('heading', { name: '已收藏' })).toBeVisible();
    await expect(previewButton(page, title)).toBeVisible();

    // ---- 取消收藏 → 它从分组里消失（自清理）----
    await unstar.first().click();
    await expect(previewButton(page, title)).toHaveCount(0);
  });

  test('切 Tab 有等待态：列表区换成骨架，Tab 与胶囊保持在场', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '入口（侧栏「模板中心」）只在桌面形态有');

    await signIn(page);
    await openTemplates(page);
    await expect(page.getByRole('button', { name: /^使用此模板「/ }).first()).toBeVisible();

    /*
     * 为什么要拦请求：真实环境里骨架只闪一两百毫秒，直接断言会时有时无。
     * 把这次导航的 RSC 请求按住 1.2 秒（Playwright 官方的慢网络手法），
     * 「一闪而过」变成「稳定可见」，断言才有意义 —— 断言的是时序存在的证据。
     */
    await page.route('**/app/templates*', async (route) => {
      if (route.request().url().includes('_rsc')) {
        await new Promise((resolve) => setTimeout(resolve, 1_200));
      }
      await route.continue();
    });

    await page.getByRole('button', { name: /^我的模板/ }).click();

    // 骨架出现（含给读屏的那句「正在加载模板…」）
    const skeleton = page.locator('[aria-busy="true"]');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.getByText('正在加载模板…')).toBeAttached();

    // 关键：只替换**列表区** —— Tab 与分类胶囊保持在场，正在点的那颗按钮不该消失
    await expect(page.getByRole('button', { name: '公开模板', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '全部', exact: true })).toBeVisible();

    // 数据落地：骨架退场、Tab 高亮落到新的那个
    await expect(skeleton).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^我的模板/ })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.unroute('**/app/templates*');
  });

  test('搜索框有等待态：导航期间放大镜原位换成 spinner，落地后还原', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '入口（侧栏「模板中心」）只在桌面形态有');

    await signIn(page);
    await openTemplates(page);

    const search = page.getByLabel('搜索模板');
    const searching = page.getByRole('status').filter({ hasText: '正在搜索…' });

    // 静止时是放大镜：没有 spinner、也没有状态文字
    await expect(page.locator('.qw-spinner')).toHaveCount(0);
    await expect(searching).toHaveCount(0);

    // 与骨架那条同款手法：把这次导航按住，spinner 才稳定可见
    await page.route('**/app/templates*', async (route) => {
      if (route.request().url().includes('_rsc')) {
        await new Promise((resolve) => setTimeout(resolve, 1_200));
      }
      await route.continue();
    });

    // 防抖 300ms 之后才发起导航，expect 的自动重试会等到它
    await search.fill('NPS');

    // 三件事一起验：spinner 顶掉了放大镜（原位、只一个）、input 挂上 aria-busy、有状态文字
    await expect(page.locator('.qw-spinner')).toHaveCount(1);
    await expect(search).toHaveAttribute('aria-busy', 'true');
    await expect(searching).toBeAttached();

    // 结果落地：spinner 退场、放大镜回来、结果真正筛出来了
    await expect(page.locator('.qw-spinner')).toHaveCount(0);
    await expect(search).not.toHaveAttribute('aria-busy', 'true');
    await expect(previewButton(page, 'NPS 净推荐值')).toBeVisible();

    await page.unroute('**/app/templates*');
  });

  test('删除的等待态：弹窗与卡片在同一批消失（不会先关弹窗、再"闪"一下列表）', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');
    test.setTimeout(120_000);

    const created = `E2E 删除时序 ${Date.now()}`;

    await signIn(page);

    // ---- 造一张自己的模板（列表卡片「⋯」→ 另存为模板）----
    await page
      .getByRole('button', { name: /更多操作/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: '另存为模板' }).click();
    await page.getByLabel('模板名称').fill(created);
    await page.getByRole('combobox', { name: '模板分类' }).click();
    await page.getByRole('option', { name: '信息收集', exact: true }).click();
    await page.getByRole('button', { name: '保存模板' }).click();

    await openTemplates(page);
    await page.getByRole('button', { name: /^我的模板/ }).click();
    await expect(previewButton(page, created)).toBeVisible();

    /*
     * 采样器：每次 DOM 变化后记一行「弹窗数 + 卡片数」。
     *
     * - 在 DOM 层数、不用 `getByRole`：弹窗打开时 Radix 会给背景加 `aria-hidden`，
     *   卡片在可访问性树里"消失" —— 用 getByRole 数只能得到永远为 0 的假象；
     * - observer 必须存到 window：不存引用会被 GC，观察会悄悄停掉（问卷删除那轮踩过）。
     */
    await page.evaluate(() => {
      const w = window as unknown as { __log: string[]; __observer?: MutationObserver };
      w.__log = [];
      let last = '';
      const snap = () => {
        const state = `dialog=${document.querySelectorAll('[role="dialog"]').length} cards=${
          document.querySelectorAll('button[aria-label^="更多操作「"]').length
        }`;
        if (state === last) return;
        last = state;
        w.__log.push(state);
      };
      snap();
      w.__observer = new MutationObserver(snap);
      w.__observer.observe(document.body, { childList: true, subtree: true });
    });

    // ---- 删除 ----
    await page.getByRole('button', { name: `更多操作「${created}」` }).click();
    await page.getByRole('menuitem', { name: '删除模板' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    // 等弹窗真的从 DOM 消失（CSS 定位 —— 不看可访问性树）
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await page.waitForTimeout(400);

    const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);

    // 弹窗收起（dialog 1 → 0）的那一批里，卡片必须**同时**少一张。
    // 旧实现先关弹窗、之后才更新列表 —— 那一批是「dialog=0 cards=N」，
    // 用户看到的就是「弹窗没了，列表过一会儿才闪一下」（R79，与问卷删除同款）
    const closeIndex = log.findIndex(
      (line, index) =>
        index > 0 && line.includes('dialog=0') && log[index - 1].includes('dialog=1'),
    );
    expect(closeIndex, `没找到弹窗收起的时刻：${JSON.stringify(log)}`).toBeGreaterThan(0);

    const before = Number(log[closeIndex - 1].match(/cards=(\d+)/)?.[1]);
    const at = Number(log[closeIndex].match(/cards=(\d+)/)?.[1]);
    expect(at, `弹窗收起时卡片数应与之一并变化：${JSON.stringify(log)}`).toBe(before - 1);
  });
});
