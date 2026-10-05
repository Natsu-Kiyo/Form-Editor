import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M3-a 验收：编辑器骨架与画布（W03）。
 *
 * **只在 desktop project 跑**：一来用例会写数据库，二来窄屏下编辑入口是刻意不渲染的
 * （移动端编辑是 P08 的弹层化交互，属 M10），在窄屏上跑必然失败且没有意义。
 *
 * 用例自带试验田：先建一份空白问卷，用完删掉，反复跑不会堆积数据。
 */

/** 试验田问卷的标题。带前缀是为了永远不与别的用例、别的残留撞车 */
const THROWAWAY_TITLE = 'E2E 编辑器用例';
const M3B_TITLE = 'E2E M3b 用例';

/**
 * 清掉指定标题的**全部**残留卡片。
 *
 * 每条会建问卷的用例都该在开头调一次：上一轮失败可能留下若干张同名卡片，
 * 而清理步骤按标题定位，留两张就会撞成 strict mode violation ——
 * 那会变成「失败一次就再也跑不过」。自己收拾干净，用例才可重复运行。
 */
async function clearLeftovers(page: Page, title: string) {
  const menu = page.getByRole('button', { name: `「${title}」更多操作` });

  let remaining = await menu.count();
  while (remaining > 0) {
    await menu.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(menu).toHaveCount(remaining - 1);
    remaining -= 1;
  }
}

/**
 * 顶栏（`<header>` 的 role 是 banner）。
 *
 * 保存状态的文案**必须限定在顶栏里找**：离开确认弹层的标题与顶栏那粒药丸是同一句
 * 「有未保存的修改」，不限定就会撞成 strict mode violation。
 */
function banner(page: Page) {
  return page.getByRole('banner');
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe('编辑器', () => {
  test.setTimeout(180_000);

  test('空画布 → 加题 → 改题 → 加选项 → 删题', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);
    await clearLeftovers(page, THROWAWAY_TITLE);

    // ---- 造一份空白问卷当试验田 ----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    // first() 取的是列表里最新的那张（列表按「最近更新」倒序），
    // 所以即使有人留下同名的残留卡片，也一定命中刚建出来的这份
    await page.getByRole('link', { name: '编辑「未命名问卷」' }).first().click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

    // ---- 先改成唯一标题 ----
    // 空白创建出来的标题一律是「未命名问卷」，与别的用例（以及上一次失败的残留）
    // 天然撞车 —— 后面所有定位都依赖这个唯一标题，顺带也验了顶栏的标题即输入框。
    const titleInput = page.getByLabel('问卷标题');
    await titleInput.fill(THROWAWAY_TITLE);
    await expect(banner(page).getByText('有未保存的修改')).toBeVisible();

    // 必须显式保存：后面收尾要按新标题在列表里找到它，而列表读的是数据库
    await page.getByRole('button', { name: '保存' }).click();
    await expect(banner(page).getByText('已保存')).toBeVisible();

    // ---- 空画布：引导用户去左侧题型面板，而不是给一个没用的按钮 ----
    // exact 是必须的：左栏还有一句「还没有题目。点上面的题型就能添加第一道。」
    await expect(page.getByText('还没有题目', { exact: true })).toBeVisible();

    // ---- 加一道单选题 ----
    await page.getByRole('button', { name: '单选', exact: true }).click();

    await expect(page.getByRole('group', { name: /^第 1 题/ })).toBeVisible();
    await expect(page.getByText('还没有题目', { exact: true })).toHaveCount(0);
    // 大纲里同步出现条目（「新题目」只出现在大纲按钮里，不会撞上别的元素）
    await expect(page.getByRole('button', { name: /新题目/ })).toBeVisible();

    // ---- 属性面板改题目，画布同步 ----
    const titleBox = page.getByLabel('题目', { exact: true });
    await titleBox.fill('你最喜欢的季节是？');
    await titleBox.blur();

    await expect(page.getByRole('group', { name: '第 1 题：你最喜欢的季节是？' })).toBeVisible();

    // ---- 默认两个选项，加一个变三个 ----
    await expect(page.getByLabel('选项文案')).toHaveCount(2);
    await page.getByRole('button', { name: '添加选项' }).click();
    await expect(page.getByLabel('选项文案')).toHaveCount(3);

    // ---- 改选项文案 ----
    const firstOption = page.getByLabel('选项文案').first();
    await firstOption.fill('春天');
    await firstOption.blur();
    await expect(page.getByLabel('选项文案').first()).toHaveValue('春天');

    // ---- 删题目（走二次确认） ----
    await page.getByRole('button', { name: '删除这道题' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('还没有题目', { exact: true })).toBeVisible();

    // ---- 收尾：删掉这份问卷，别把演示数据越跑越脏 ----
    await page.goto('/app');
    await clearLeftovers(page, THROWAWAY_TITLE);
    await expect(page.getByRole('heading', { name: THROWAWAY_TITLE, exact: true })).toHaveCount(0);
  });

  test('手动保存：改动先落草稿，按保存才写库', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);
    await clearLeftovers(page, M3B_TITLE);

    // ---- 造一块试验田，并改成唯一标题 ----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.getByRole('link', { name: '编辑「未命名问卷」' }).first().click();

    const titleInput = page.getByLabel('问卷标题');
    await titleInput.fill(M3B_TITLE);

    // 只改本地：顶栏应当说「有未保存的修改」，而不是自己去写库
    await expect(banner(page).getByText('有未保存的修改')).toBeVisible();
    await expect(banner(page).getByText('已保存')).toHaveCount(0);

    // ---- 未保存时点站内链接，必须被拦下来问一句 ----
    await page.getByRole('link', { name: '返回问卷列表' }).click();

    const leaveDialog = page.getByRole('dialog');
    await expect(leaveDialog.getByText('有未保存的修改')).toBeVisible();
    await expect(leaveDialog.getByRole('button', { name: '留在本页' })).toBeVisible();
    await expect(leaveDialog.getByRole('button', { name: '放弃并离开' })).toBeVisible();
    await expect(leaveDialog.getByRole('button', { name: '保存并离开' })).toBeVisible();
    await leaveDialog.getByRole('button', { name: '留在本页' }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

    // ---- 保存后，未保存的改动不应被带过去 ----
    await page.getByRole('button', { name: '保存' }).click();
    await expect(banner(page).getByText('已保存')).toBeVisible();
    await titleInput.fill('改了但不想要了');
    await expect(banner(page).getByText('有未保存的修改')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('问卷标题')).toHaveValue(M3B_TITLE);

    // ---- 加两道题并改名（都在草稿里），再保存 ----
    for (const [position, title] of [
      [1, '第一题'],
      [2, '第二题'],
    ] as const) {
      await page.getByRole('button', { name: '单选', exact: true }).click();

      await expect(page.getByRole('group', { name: `第 ${position} 题：新题目` })).toBeVisible();

      const questionTitle = page.getByLabel('题目', { exact: true });
      await questionTitle.fill(title);

      await expect(page.getByRole('group', { name: `第 ${position} 题：${title}` })).toBeVisible();
    }

    // ---- 分页：先选中第 1 题（分页不能插在末尾，否则按钮是 disabled 的） ----
    await page.getByRole('group', { name: '第 1 题：第一题' }).click();
    await page.getByRole('button', { name: '添加分页' }).click();
    await expect(page.getByText('第 1 页结束 · 分页符')).toBeVisible();
    await expect(page.getByText('— 分页 —')).toBeVisible();

    // ---- 保存并刷新：全部改动都要在 ----
    await page.getByRole('button', { name: '保存' }).click();
    await expect(banner(page).getByText('已保存')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('问卷标题')).toHaveValue(M3B_TITLE);
    await expect(page.getByRole('group', { name: '第 1 题：第一题' })).toBeVisible();
    await expect(page.getByRole('group', { name: '第 2 题：第二题' })).toBeVisible();
    await expect(page.getByText('第 1 页结束 · 分页符')).toBeVisible();

    // ---- 侧栏链接（以后会有多个入口）同样要拦 ----
    await titleInput.fill('改了一点但还没存');
    // exact 是必须的：顶栏那个返回按钮的 aria-label 是「返回问卷列表」，会被子串匹配进来
    await page.getByRole('link', { name: '问卷列表', exact: true }).click();
    await expect(leaveDialog.getByText('有未保存的修改')).toBeVisible();
    await leaveDialog.getByRole('button', { name: '留在本页' }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

    // ---- 浏览器返回（Alt+← / 后退键）也要拦 ----
    // 它不产生点击、也不触发 beforeunload，走的是 history 那条路
    await page.goBack();
    await expect(leaveDialog.getByText('返回上一页会丢掉这次的改动')).toBeVisible();
    await leaveDialog.getByRole('button', { name: '留在本页' }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

    // ---- 保存之后再按返回，应当直接回到列表（哨兵记录要被收掉） ----
    await page.getByRole('button', { name: '保存' }).click();
    await expect(banner(page).getByText('已保存')).toBeVisible();

    // 这一拍是等「收哨兵」那次 history 遍历落地 —— 它没有可观察的信号，
    // 而 Playwright 的 goBack 也是一次历史遍历，两个挨着发会被浏览器排队。
    // 不等的后果是偶发失败，不是功能问题。
    await page.waitForTimeout(500);

    await page.goBack();
    await expect(page).toHaveURL(/\/app$/);

    // ---- 收尾 ----
    await clearLeftovers(page, M3B_TITLE);
    await expect(page.getByRole('heading', { name: M3B_TITLE, exact: true })).toHaveCount(0);
  });

  /**
   * 拖拽排序的 E2E：**目前驱动不了，标为 fixme 留痕。**
   *
   * 已经试过两条路径，结论一致：拖拽**能激活**（卡片会进 isDragging 态，opacity 0.7），
   * 但 `onDragEnd` 拿到的落点始终是它自己，`over` 相等于是直接 return。
   * - 指针路径：mouse.down → 分步 move（跨过 6px 激活阈值）→ mouse.up
   * - 键盘路径：focus 手柄 → Space 拿起 → ArrowUp → Space 放下
   *
   * 说明这是**驱动方式**的问题而不是功能问题：激活成功证明传感器与手柄接线是对的。
   * 真机手工验证步骤见 docs/VERIFY.md「M3 · 编辑器」。
   */
  test.fixme('拖拽排序（E2E 驱动不了 dnd-kit 的 drop，待手工验证）', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);

    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.getByRole('link', { name: '编辑「未命名问卷」' }).first().click();

    for (const position of [1, 2] as const) {
      await page.getByRole('button', { name: '单选', exact: true }).click();
      await expect(page.getByRole('group', { name: `第 ${position} 题：新题目` })).toBeVisible();
    }

    const handle = page.getByRole('button', { name: '拖动第 2 题' });
    const box = await handle.boundingBox();
    if (!box) throw new Error('拿不到拖拽手柄的位置');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 24, { steps: 6 });
    await page.mouse.move(startX, startY - 200, { steps: 12 });

    // 这一条是能过的：证明拖拽确实被激活了
    await expect(page.getByRole('group', { name: /第 2 题/ })).toHaveCSS('opacity', '0.7');

    await page.mouse.up();

    // 这一条过不去 —— 换序没发生
    await expect(page.getByRole('group', { name: '第 1 题：新题目' })).toBeVisible();
  });

  test('已发布的问卷进去是只读，并说明为什么', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);

    await page.getByRole('link', { name: '编辑「2026 秋季社团招新报名」' }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

    // 说清「为什么不能改」+「那我该怎么办」
    await expect(page.getByText('题目结构已冻结')).toBeVisible();
    await expect(page.getByText('复制为新问卷')).toBeVisible();

    // 题型面板与属性面板的开关都不可点
    await expect(page.getByRole('button', { name: '单选', exact: true })).toBeDisabled();
    await expect(page.getByLabel('必填')).toBeDisabled();
    // 只读态不显示保存状态
    await expect(page.getByText('已保存')).toHaveCount(0);

    // 但题目结构是能看的
    await expect(page.getByRole('group', { name: /第 1 题：你的姓名/ })).toBeVisible();
  });
});
