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
const DUPLICATE_TITLE = 'E2E 重名选项用例';
const ADD_OPTION_TITLE = 'E2E 新增选项用例';
const INTRO_TITLE = 'E2E 卷首语用例';
const INTRO_TEXT = '统计团建的可用时间，大约 2 分钟。';

/**
 * 清掉指定标题的**全部**残留卡片。
 *
 * 每条会建问卷的用例都该在开头调一次：上一轮失败可能留下若干张同名卡片，
 * 而清理步骤按标题定位，留两张就会撞成 strict mode violation ——
 * 那会变成「失败一次就再也跑不过」。自己收拾干净，用例才可重复运行。
 */
async function clearLeftovers(page: Page, title: string) {
  const menu = page.getByRole('button', { name: `「${title}」更多操作` });

  /*
   * 先等列表**渲染出来**再数。
   *
   * 少了这一句，`count()` 会在卡片出现之前返回 0 —— 于是这里安静地什么都不做，
   * 直到用例收尾那一步「列表里不该再有它」才炸，报的是 `toHaveCount` 期望 0 实际 1，
   * **看上去像收尾写错，其实是开头少等了一步**（`questionnaire-list.spec.ts` 的清理
   * 踩的是同一个坑，两处都已修）。
   */
  await expect(page.getByRole('button', { name: '新建问卷' }).first()).toBeVisible();

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

    // ---- 造一份空白问卷当试验田（创建成功后直接进编辑器，不用回列表找）----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
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

    // ---- 画布上直接改题目名（R93）：与右栏那个字段写的是同一份草稿 ----
    await page.getByLabel('第 1 题标题').fill('你最喜欢哪个季节？');
    await expect(page.getByRole('group', { name: '第 1 题：你最喜欢哪个季节？' })).toBeVisible();
    // 右栏跟着变 —— 两个入口、一份状态
    await expect(page.getByLabel('题目', { exact: true })).toHaveValue('你最喜欢哪个季节？');

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

  test('重名的选项：当场提示，保存被 schema 拦下（R92 · N7）', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);
    await clearLeftovers(page, DUPLICATE_TITLE);

    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);
    await page.getByLabel('问卷标题').fill(DUPLICATE_TITLE);
    await page.getByRole('button', { name: '单选', exact: true }).click();

    // ---- 两个选项改成同一个文案：画布上当场提示，不必等到保存 ----
    const options = page.getByLabel('选项文案');
    await options.nth(0).fill('满意');
    await options.nth(1).fill('满意');
    // 两处同时提示：画布上的选项列表 + 右栏的「选项」字段（同一判据、同一句话，R93 起右栏也有）
    await expect(page.getByText('有选项重名')).toHaveCount(2);

    // ---- 保存被拦下：报错来自 schema 那道闸门，与界面标红同源 ----
    // 文案只在 title 里（顶栏位置有限，界面上只说「保存失败」，细节挂在悬停提示上）
    await page.getByRole('button', { name: '保存' }).click();
    const failed = banner(page).getByText('保存失败');
    await expect(failed).toBeVisible();
    await expect(failed).toHaveAttribute('title', /选项不能重名/);

    // ---- 改回不重名：两处提示一起消失，保存通过 ----
    await options.nth(1).fill('不满意');
    await options.nth(1).blur();
    await expect(page.getByText('有选项重名')).toHaveCount(0);

    await page.getByRole('button', { name: '保存' }).click();
    await expect(banner(page).getByText('已保存')).toBeVisible();

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, DUPLICATE_TITLE);
  });

  test('新增选项：直接聚焦、初始为空，空着离开才补占位（R94）', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);
    await clearLeftovers(page, ADD_OPTION_TITLE);

    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);
    await page.getByLabel('问卷标题').fill(ADD_OPTION_TITLE);
    await page.getByRole('button', { name: '单选', exact: true }).click();

    // ---- 画布上新增：新那一格**直接聚焦**、**初始为空**（不必先删掉「选项 3」）----
    await page.getByRole('button', { name: '添加选项' }).click();
    const options = page.getByLabel('选项文案');
    await expect(options).toHaveCount(3);
    const added = options.nth(2);
    await expect(added).toBeFocused();
    await expect(added).toHaveValue('');

    // 直接写就是它的内容
    await added.fill('第三个');
    await expect(added).toHaveValue('第三个');

    // ---- 只有**空着且手动失焦**才补占位（与改动前一致）----
    await added.fill('');
    await added.blur();
    await expect(added).toHaveValue('选项 3');

    /*
     * ---- 光标还留在空框里就直接保存 ----
     * 这条走的是「不会失焦」的路径：腾出来的空文案由保存侧兜底（`fillOptionLabels`），
     * 否则会因为选项 `min(1)` 被 schema 拒，报出来的还是 zod 的英文原话。
     */
    await page.getByRole('button', { name: '添加选项' }).click();
    await page.keyboard.press('Control+s');
    await expect(banner(page).getByText('已保存')).toBeVisible();

    // 落库的那一份里，空着的那格已经补成占位（刷新后仍在 —— 证明存的就是它）
    await page.reload();
    await expect(page.getByLabel('选项文案').nth(3)).toHaveValue('选项 4');

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, ADD_OPTION_TITLE);
  });

  test('卷首语：中栏顶部能写，保存后不会丢（R95）', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);
    await clearLeftovers(page, INTRO_TITLE);

    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);
    await page.getByLabel('问卷标题').fill(INTRO_TITLE);

    // ---- 卡在 Q1 之上，且**空问卷也显示**（它就是这份问卷的内容，不依赖有没有题）----
    const introBox = page.getByLabel('卷首语');
    await expect(introBox).toBeVisible();
    await introBox.fill(INTRO_TEXT);

    // ---- 预览里能看到它：预览的是当前草稿，与作答页抬头对齐 ----
    await page.getByRole('button', { name: '预览' }).click();
    await expect(page.getByRole('dialog').getByText(INTRO_TEXT)).toBeVisible();
    await page.keyboard.press('Escape');

    /*
     * ---- 保存 + 刷新：内容还在 ----
     * 这一条钉的正是那个 bug：`save()` 里曾经硬编码 `intro: null`，
     * 于是「从模板 / 导入 JSON 带进来的卷首语」会在按一次保存后被静默清空。
     */
    await page.getByRole('button', { name: '保存' }).click();
    await expect(banner(page).getByText('已保存')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('卷首语')).toHaveValue(INTRO_TEXT);

    // ---- 清空再保存：落库成 null（列表卡片回落到「共 N 道题」）----
    await page.getByLabel('卷首语').fill('');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(banner(page).getByText('已保存')).toBeVisible();

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, INTRO_TITLE);
  });

  test('手动保存：改动先落草稿，按保存才写库', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);
    await clearLeftovers(page, M3B_TITLE);

    // ---- 造一块试验田，并改成唯一标题 ----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    // 创建成功后 action 直接 redirect 到编辑器，不需要再从列表点进来
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

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
    // 创建成功后 action 直接 redirect 到编辑器，不需要再从列表点进来
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);

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
