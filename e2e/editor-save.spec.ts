import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS, RATING_SCALE } from '@/config/constants';

/**
 * 保存链路的回归用例。
 *
 * 两条都是照着真实事故补的：
 * - 「从模板创建 → 编辑 → 保存」这条路径原先**没有任何用例**，而它和「空白创建」
 *   走的是两条不同的服务端分支（模板要读 payload 再灌进新问卷），事故正出在这条上；
 * - 评分题的上限规则此前只在单测里锁着，界面那层（刻度渲染、属性面板拒绝）没人看。
 *
 * 只在 desktop 跑：写操作，且要连着看编辑器与列表两处。
 */
const TEMPLATE_TITLE = 'E2E 模板保存';
const RATING_TITLE = 'E2E 评分刻度';
const VERSION_TITLE = 'E2E 版本回滚';

/**
 * 登录。**这一步单独放宽到 60 秒**：库在境外，登录要连着查会话、成员、工作区、
 * 通知，而计算节点在持续压力下会变慢（实测单次往返从 225ms 涨到数秒）。
 * 断言的预算要按**最坏**情况给，否则失败信息只会说「登录没成功」，掩盖真正的原因。
 */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
}

/**
 * 清掉同名残留。失败的那一轮会把卡片留在库里，而本文件里的用例互相之间
 * 以及它们自己重跑时都按标题定位，不清就会撞成 strict mode violation。
 */
async function clearLeftovers(page: Page, title: string) {
  const menu = page.getByRole('button', { name: `「${title}」更多操作` });

  for (let remaining = await menu.count(); remaining > 0; remaining -= 1) {
    await menu.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(menu).toHaveCount(remaining - 1);
  }
}

test.describe('编辑器保存', () => {
  test.setTimeout(240_000);

  test('从模板创建 → 改内容 → 保存 → 刷新后仍在', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);
    await clearLeftovers(page, TEMPLATE_TITLE);

    // ---- 从模板创建（与「空白创建」是两条不同的服务端分支）----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByText('从模板创建').click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    // 从模板创建是全套件最重的一次写：模板的每一道题、每个选项都在同一个事务里
    // 逐条写（4 道题 ≈ 十几次跨区域往返），慢的时候要几十秒，所以单独放宽
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/, { timeout: 90_000 });

    await page.getByLabel('问卷标题').fill(TEMPLATE_TITLE);

    // 只改问卷标题：它和题目结构在同一次保存里落库，整条链路
    //（模板 payload → 草稿 → 保存 → 数据库 → 刷新读回）已经完整走到。
    // 不改题目标题是因为**在模板创建的问卷里取不到那个输入框**（见计划书遗留），
    // 这里不为了凑覆盖率把用例变成猜谜。
    await page.getByLabel('问卷标题').fill(TEMPLATE_TITLE);

    // ---- 保存：这一步曾经 500（写版本快照时客户端是旧的）----
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    // ---- 关键：**刷新**后内容还在 ----
    // 只断言「已保存」是不够的：它只说明请求没报错。真正要证明的是**落库了**
    //（事故当时的症状恰恰是「报错但已落库」，所以这里要反过来钉住「成功即已落库」）
    await page.reload();
    await expect(page.getByLabel('问卷标题')).toHaveValue(TEMPLATE_TITLE);
    // 模板带来的题目也在（不是被存成了空问卷）。不写死条数：
    // 模板的题目数由种子决定，写死就会在换模板时莫名其妙地红
    await expect(page.getByRole('group').first()).toBeVisible();

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, TEMPLATE_TITLE);
  });

  test('版本历史：两次保存后可回滚，且回滚不删除历史', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '版本历史按 1.0 范围只在桌面端');
    await signIn(page);
    await clearLeftovers(page, VERSION_TITLE);

    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/, { timeout: 90_000 });

    // ---- 第一版：标题 + 一道题 ----
    await page.getByLabel('问卷标题').fill(VERSION_TITLE);
    await page.getByRole('button', { name: '单选', exact: true }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    const historyButton = page.getByRole('button', { name: '历史版本' });
    await historyButton.click();
    await expect(page.getByText('共 1 个版本')).toBeVisible();
    await page.keyboard.press('Escape');

    // ---- 第二版：改标题 + 再加一道题 ----
    await page.getByLabel('问卷标题').fill(`${VERSION_TITLE} 第二版`);
    await page.getByRole('button', { name: '多选', exact: true }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    await historyButton.click();
    await expect(page.getByText('共 2 个版本')).toBeVisible();

    // ---- 回滚到最早那一版（列表是倒序，最后一条就是 v1）----
    await page.getByRole('button', { name: '回滚' }).last().click();
    await page.getByRole('button', { name: '确认回滚' }).click();

    // 等两个弹层都关上再刷新 —— 关上是「回滚已完成」的信号。
    // 不等就会抢跑：刷新跑在写入之前，读到的还是旧数据（这是用例的问题，不是产品的）
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 回滚后结构与标题都回到了第一版
    await page.reload();
    await expect(page.getByLabel('问卷标题')).toHaveValue(VERSION_TITLE);
    await expect(page.getByRole('group')).toHaveCount(1);

    // **回滚不删除历史**：现在是 3 条（两次保存 + 一条「回滚自 v1」）
    await historyButton.click();
    await expect(page.getByText('共 3 个版本')).toBeVisible();
    await expect(page.getByText('回滚自 v1')).toBeVisible();

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, VERSION_TITLE);
    await clearLeftovers(page, `${VERSION_TITLE} 第二版`);
  });

  test('评分题：上限最多 10 分，刻度每行五个', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '编辑器只在桌面端有入口');
    await signIn(page);
    await clearLeftovers(page, RATING_TITLE);

    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);
    await page.getByLabel('问卷标题').fill(RATING_TITLE);

    await page.getByRole('button', { name: '评分', exact: true }).click();

    const card = page.getByRole('group', { name: /^第 1 题/ });
    await expect(card.getByText(/^评分 1–5/)).toBeVisible();

    // ---- 选中它，出现「分值范围」属性 ----
    await card.click();
    const maxField = page.getByLabel('最大');

    // 超过上限的值**不被接受**，输入框回到原值（否则画布上会出现一排压扁的窄框）
    await maxField.fill('17');
    await maxField.blur();
    await expect(maxField).toHaveValue('5');
    await expect(card.getByText(/^评分 1–5/)).toBeVisible();

    // 上限之内则正常生效
    await maxField.fill(String(RATING_SCALE.MAX));
    await maxField.blur();
    await expect(card.getByText(new RegExp(`^评分 1–${RATING_SCALE.MAX}`))).toBeVisible();

    // ---- 刻度：数量正好是 10，且排成每行 5 个 ----
    const cells = card.locator('div.grid').first().locator('span');
    await expect(cells).toHaveCount(RATING_SCALE.MAX);

    const firstCell = await cells.nth(0).boundingBox();
    const nextRowCell = await cells.nth(RATING_SCALE.PER_ROW).boundingBox();

    expect(firstCell).not.toBeNull();
    expect(nextRowCell).not.toBeNull();
    // 第 6 个必须落回第 1 个那一列的**下一行**：只断数量的话，改成一行 10 个也能过
    expect(Math.round(nextRowCell!.x)).toBe(Math.round(firstCell!.x));
    expect(nextRowCell!.y).toBeGreaterThan(firstCell!.y);

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, RATING_TITLE);
  });
});
