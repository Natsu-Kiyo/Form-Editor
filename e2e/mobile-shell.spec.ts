import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M10-a 验收：移动端外壳（P04 移动工作台 / P09 我的）+ 隐藏项复核。
 *
 * 只在 375px 的 mobile project 里跑 —— 这些断言问的都是「窄屏下变成了什么」，
 * 在 1440px 下没有意义。
 */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe('移动外壳', () => {
  test.setTimeout(240_000);

  test('底部三格：问卷 / 模板 / 我的，成员与日志不在其中', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '这是 375px 的形态');

    await signIn(page);

    const nav = page.getByRole('navigation', { name: '主导航' });
    await expect(nav.getByRole('link')).toHaveCount(3);
    await expect(nav.getByRole('link', { name: '问卷' })).toHaveAttribute('aria-current', 'page');

    // 桌面端专属的两项在窄屏**完全不渲染**（不是「点了跳回抽屉」那种假入口）
    await expect(page.getByRole('link', { name: '成员与权限' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '操作日志' })).toHaveCount(0);

    // 切到模板：底部条跟着高亮（而不是整页重绘画成一个新页面）
    await nav.getByRole('link', { name: '模板' }).click();
    await expect(page).toHaveURL(/\/app\/templates$/);
    await expect(nav.getByRole('link', { name: '模板' })).toHaveAttribute('aria-current', 'page');
  });

  test('P04 工作台：顶栏三个入口都有落点，新建是悬浮「＋」', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '这是 375px 的形态');

    await signIn(page);

    const header = page.locator('header');

    // 工作区名 → 真切换器（列表 + 新建工作区都在里面）
    await header.getByRole('button').first().click();
    await expect(page.getByText('切换工作区')).toBeVisible();
    await page.keyboard.press('Escape');

    // 铃铛 → 真通知面板（读的是库里的通知，不是写死的列表）
    await header.getByRole('button', { name: /通知/ }).click();
    await expect(page.getByText('欢迎使用轻问卷')).toBeVisible();
    await page.keyboard.press('Escape');

    // 悬浮「＋」：编辑者才看得到，点了直接建一份空白问卷进编辑器
    await expect(page.getByRole('button', { name: '新建问卷' })).toBeVisible();
  });

  test('P09 我的：每一行都落到具体画面', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '这是 375px 的形态');

    await signIn(page);

    // 头像 → 我的（与底部那格是同一个落点）
    await page.locator('header').getByRole('link', { name: '我的账号' }).click();
    await expect(page).toHaveURL(/\/app\/me$/);

    // 账号卡 / 当前工作区 / 三个入口 / 退出登录，一个都不能少
    await expect(page.getByText(DEMO_ACCOUNTS.owner.email)).toBeVisible();
    await expect(page.getByText('当前工作区')).toBeVisible();
    await expect(page.getByRole('button', { name: /消息通知/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /账号与安全/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /帮助与反馈/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();

    // 账号与安全 → 真的能改密码（不是只有入口没有画面）
    await page.getByRole('button', { name: /账号与安全/ }).click();
    await expect(page.getByRole('button', { name: /修改|修改密码/ })).toBeVisible();
    await page.keyboard.press('Escape');

    // 消息通知 → 与顶栏铃铛**同一份列表**（抽出的 NotificationList 就是为这件事）
    await page.getByRole('button', { name: /消息通知/ }).click();
    await expect(page.getByText('欢迎使用轻问卷')).toBeVisible();
    await page.keyboard.press('Escape');

    // 帮助与反馈 → 真的帮助弹层（有常见问题）
    await page.getByRole('button', { name: /帮助与反馈/ }).click();
    await expect(page.getByText('常见问题')).toBeVisible();
    await page.keyboard.press('Escape');

    // 成员与角色权限 → **只读**列表（设计稿：手机上只读查看，避免误操作）
    await page.getByRole('button', { name: /成员与角色权限/ }).click();
    const members = page.getByRole('dialog');
    await expect(members.getByText('林予')).toBeVisible();
    await expect(members.getByText('陈默')).toBeVisible();
    // 一个能改的东西都不给：没有邀请、没有改角色、没有移除
    for (const action of ['邀请成员', '移除', '改角色']) {
      await expect(members.getByRole('button', { name: action })).toHaveCount(0);
    }
    await page.keyboard.press('Escape');
  });

  test('隐藏项复核：版本历史 / JSON 导入导出 / 答卷明细在 375px 都不出现', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '这是 375px 的形态');

    await signIn(page);

    // 卡片「⋯」里没有 JSON 导入导出（设计稿标了移动端不做）
    await page
      .getByRole('button', { name: /更多操作/ })
      .first()
      .click();
    await expect(page.getByRole('menuitem', { name: '导出 JSON' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: '导入 JSON' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // 问卷内页：没有「答卷」这个 Tab（明细是桌面端专属）。
    // 问卷 id 从卡片上的「数据」链接取，不写死 —— 写死的 id 换一次 seed 就失效
    const stats = page.getByRole('link', { name: /^数据「/ }).first();
    const statsHref = await stats.getAttribute('href');
    await stats.click();
    await expect(page).toHaveURL(/\/stats$/);
    await expect(page.getByRole('link', { name: '答卷' })).toHaveCount(0);

    // 编辑器：没有「版本历史」入口
    await page.goto(statsHref!.replace(/\/stats$/, '/edit'));
    await expect(page.getByRole('button', { name: /版本历史/ })).toHaveCount(0);
  });

  test('P05 数据概览：统一口径条、单题横滑、底部两个按钮', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '这是 375px 的形态');

    await signIn(page);
    await page
      .getByRole('link', { name: /^数据「/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/stats$/);

    // 窄屏用**一条**统一口径说明代替逐卡的「?」（四张卡各挂问号会把数字挤掉）
    await expect(page.getByText(/口径：完成率 = 提交份数/)).toBeVisible();

    // 单题卡横向滑动（桌面是纵向堆叠，所以这行提示只在窄屏出现）
    await expect(page.getByText(/左右滑动查看全部 \d+ 题/)).toBeVisible();

    // 顶栏那两个动作在窄屏挪到了底部：导出可点、分享报告是灰显 2.0
    await expect(page.getByRole('button', { name: /导出/ }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: /分享报告/ })).toBeDisabled();

    // 筛选收进弹层（375px 上把条件全摊开会把趋势图挤走）
    // 断言用「可点的控件」而不是标签文字：`FilterSelect` 里那个 native select 是给读屏用的，看不见
    await page.getByRole('button', { name: /^筛选/ }).click();
    const filters = page.getByRole('dialog');
    await expect(filters.getByRole('heading', { name: '筛选' })).toBeVisible();
    // 断在真控件上：日期区间是按钮，交叉分析是灰显按钮
    // （渠道那一项是原生 select，按 role 找它得用 combobox，这里不纠缠）
    await expect(filters.getByRole('button', { name: '开始时间 - 结束时间' })).toBeVisible();
    await expect(filters.getByRole('button', { name: /交叉分析/ })).toBeDisabled();
  });

  test('P06 分享页：大字二维码 + 渠道链接进底部 Sheet', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '这是 375px 的形态');

    await signIn(page);
    const stats = page.getByRole('link', { name: /^数据「/ }).first();
    const statsHref = await stats.getAttribute('href');
    await page.goto(statsHref!.replace(/\/stats$/, '/share'));

    await expect(page.getByText('扫码或长按识别二维码填写')).toBeVisible();
    await expect(page.getByAltText(/作答二维码/)).toBeVisible();

    // 渠道是「入口不是内容」：一行 + 底部 Sheet（内部滚动，限高 70vh）
    await page.getByRole('button', { name: /渠道链接/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: '渠道链接' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /新建渠道/ })).toBeVisible();
  });

  test('P08 移动编辑器：题型与属性是弹层，且就是桌面那两块面板', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '这是 375px 的形态');

    await signIn(page);

    // 用 seed 里那份**草稿**：已发布的问卷编辑器是冻结只读的，不会有「＋」
    const stats = page.getByRole('link', { name: /^数据「用户访谈招募/ }).first();
    const statsHref = await stats.getAttribute('href');
    await page.goto(statsHref!.replace(/\/stats$/, '/edit'));

    // ---- P08-b 题型弹层：窄屏没有左栏，入口是悬浮「＋」 ----
    await page.getByRole('button', { name: '添加题目' }).click();
    const typeSheet = page.getByRole('dialog');
    await expect(typeSheet.getByRole('heading', { name: '题型' })).toBeVisible();
    // 与桌面左栏是同一批题型：含 1.1 灰显的矩阵题
    await expect(typeSheet.getByRole('button', { name: /矩阵/ })).toBeDisabled();
    await typeSheet.getByRole('button', { name: /评分/ }).click();
    // 加完自动收起，把画布还回来
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // ---- P08-c 属性弹层：点题卡就开，字段与桌面右栏同一块面板 ----
    await page.getByRole('group', { name: /^第 1 题：/ }).click();
    const propertySheet = page.getByRole('dialog');
    await expect(propertySheet.getByRole('heading', { name: /第 1 题属性/ })).toBeVisible();
    await expect(propertySheet.getByText('题目类型')).toBeVisible();
    await expect(propertySheet.getByText('题目', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // ---- 预览：真的能看（不是灰显按钮），且预览的是**当前草稿** ----
    await page.getByRole('button', { name: '预览', exact: true }).click();
    const preview = page.getByRole('dialog');
    await expect(preview.getByText(/按当前草稿渲染/)).toBeVisible();
  });

  test('P07 模板页：卡片按钮常显，「⋯」不在窄屏', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '这是 375px 的形态');

    await signIn(page);
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '模板' })
      .click();
    await expect(page).toHaveURL(/\/app\/templates$/);

    // 官方卡的动作**不必悬浮**：375px 没有 hover 可言
    await expect(page.getByRole('button', { name: /^使用此模板「/ }).first()).toBeVisible();

    // 「我的模板」：卡片在，但「⋯」（重命名 / 删除）是桌面专属（设计稿 P07 的原话）
    await page.getByRole('button', { name: /^我的模板/ }).click();
    await expect(page.getByRole('button', { name: /^预览「/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /更多操作/ })).toHaveCount(0);
  });
});
