import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '../src/config/constants';

/**
 * 口令访问的**完整闭环**：设置页设口令 → 公开页用它解锁 → 改口令 → 清空被拦。
 *
 * 为什么单独写一条：发布设置此前没有任何端到端用例，于是口令这一路的规则
 * （存什么、空值算什么、界面与服务端口径是否一致）只能靠手点发现 ——
 * 它确实被点出来过三次：R38 掩码被当成真口令存进去；R39「留空=沿用」与
 * 「第一次设口令」互相矛盾；R40 口令不能回显、且「保存设置」在口令为空时仍可点。
 *
 * 全程用一份**临时问卷**，跑完自己删掉，不动演示数据。
 */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test('口令访问：原文可见、空口令拦住、公开页能解锁', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '会写数据库，只在一个 project 跑');
  test.setTimeout(180_000);

  await signIn(page);

  // ---- 先清掉上一次可能留下的残留（空白创建的标题一律是「未命名问卷」）----
  const leftovers = page.getByRole('button', { name: /^「未命名问卷/ });
  for (let remaining = await leftovers.count(); remaining > 0; remaining -= 1) {
    await leftovers.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(leftovers).toHaveCount(remaining - 1);
  }

  // ---- 临时问卷：空白创建 → 加一道题 → 保存（有题目才能在发布前检查里过）----
  await page.getByRole('button', { name: '新建问卷' }).first().click();
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/);
  const editUrl = page.url();

  // 第一道题从左栏「题型」面板加（空白问卷的画布上没有「添加题目」虚线按钮 ——
  // 那个按钮在 R33 起只对**已有题目**的画布渲染）
  await page.getByRole('complementary').getByRole('button', { name: '单选' }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();

  // ---- 进发布设置：选「口令访问」，**先不填口令** ----
  const publishUrl = editUrl.replace(/\/edit$/, '/publish');
  await page.goto(publishUrl);
  await page.getByRole('radio', { name: /口令访问/ }).click();

  const password = page.getByLabel('访问口令');
  await expect(password).toHaveValue('');
  // 空口令不能让按钮亮起来：R39 起「空」表示**没有口令**，不是「沿用旧口令」
  await expect(page.getByRole('button', { name: '保存并发布' })).toBeDisabled();
  await expect(page.getByText('口令访问需要设置一个口令')).toBeVisible();

  // ---- 填一个口令 → 可以发布 ----
  await password.fill('e2epass1234');
  const publishButton = page.getByRole('button', { name: '保存并发布' });
  await expect(publishButton).toBeEnabled();
  await publishButton.click();
  await expect(page.getByRole('button', { name: '保存设置' })).toBeEnabled();

  // ---- 重新进来：字段里是**口令原文**（R40：发起人要能再看到它）----
  await page.reload();
  await expect(password).toHaveValue('e2epass1234');

  // ---- 公开页：先被拦住 → 输错有提示 → 输对能进 ----
  /*
   * 公开链接从分享页上取，不自己拼 host：`NEXT_PUBLIC_APP_URL` 与 E2E 起的端口
   * 不一定一致，取页面上的那份才与实际打开的一致。
   */
  await page.goto(publishUrl.replace(/\/publish$/, '/share'));
  const shareLabel = await page.getByText(/\/s\//).first().innerText();
  const slug = shareLabel
    .split('/s/')[1]
    .trim()
    .split(/[\s?#]/)[0];

  await page.goto(`/s/${slug}`);
  const unlockField = page.getByLabel('访问口令');
  await expect(unlockField).toBeVisible();

  await unlockField.fill('wrong-code');
  await page
    .getByRole('button', { name: /进入|解锁|提交/ })
    .first()
    .click();
  await expect(page.getByText(/口令不正确/)).toBeVisible();

  await unlockField.fill('e2epass1234');
  await page
    .getByRole('button', { name: /进入|解锁|提交/ })
    .first()
    .click();
  // 解锁成功后口令框消失，看到的是问卷本身
  await expect(page.getByLabel('访问口令')).toHaveCount(0);

  // ---- 清空口令：按钮必须**点不动**，且检查清单说清原因（不是保存后才报错）----
  await page.goto(publishUrl);
  await expect(password).toHaveValue('e2epass1234');
  await password.fill('');
  await expect(page.getByRole('button', { name: '保存设置' })).toBeDisabled();
  await expect(page.getByText('口令访问需要设置一个口令')).toBeVisible();

  // 刷新确认库里的口令**没被清掉**（R39 那条安全洞：null 的含义是「不需要解锁」）
  await page.reload();
  await expect(password).toHaveValue('e2epass1234');

  // ---- 收尾：切回匿名作答并保存（口令会被清掉），然后删掉这份临时问卷 ----
  // 用 role=radio 定位而不是 getByText：口令字段下面那行提示里也写着「匿名作答」，
  // 按文本找会命中两个元素
  await page.getByRole('radio', { name: /匿名作答/ }).click();
  await page.getByRole('button', { name: '保存设置' }).click();
  await expect(page.getByRole('button', { name: '保存设置' })).toBeEnabled();

  await page.goto('/app');
  await page.getByRole('button', { name: '「未命名问卷」' }).first().click();
  await page.getByRole('menuitem', { name: '删除问卷' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.getByRole('button', { name: /^「未命名问卷/ })).toHaveCount(0);
});
