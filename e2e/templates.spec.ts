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

  test('官方模板：8 张、分类与搜索、预览以作答页呈现', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '写操作只在桌面端跑');

    await signIn(page);
    await openTemplates(page);

    // ---- 8 张，覆盖五个分类 ----
    await expect(page.getByRole('button', { name: /^使用此模板「/ })).toHaveCount(OFFICIAL_COUNT);
    await expect(page.getByText('用户满意度调研')).toBeVisible();

    // ---- 分类胶囊 ----
    await page.getByRole('button', { name: '考试测验' }).click();
    await expect(page).toHaveURL(/category=/);
    await expect(page.getByRole('button', { name: /^使用此模板「/ })).toHaveCount(1);

    await page.getByRole('button', { name: '全部' }).click();
    await expect(page.getByRole('button', { name: /^使用此模板「/ })).toHaveCount(OFFICIAL_COUNT);

    // ---- 搜索（输入后 300ms 防抖才改 URL）----
    await page.getByLabel('搜索模板').fill('NPS');
    await expect(page.getByRole('button', { name: /^使用此模板「/ })).toHaveCount(1);

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
});
