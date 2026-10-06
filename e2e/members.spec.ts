import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M8-a 验收：成员与权限（W09）。
 *
 * 三条用例分别验三件事：
 * 1. 成员页本身能读能改（角色切换**要改回**，否则第二次跑就红了）；
 * 2. **邀请链接真的能加入** —— 这是本里程碑最容易做成假入口的地方
 *    （能复制、点开却 404，项目里已经踩过一次）；
 * 3. 查看者进这个页面时**写入口完全不出现**（服务端拦截由单测与 action 自身保证）。
 */
async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(account.email);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function openMembers(page: Page) {
  await page.getByRole('link', { name: '成员与权限' }).click();
  await expect(page).toHaveURL(/\/app\/members$/);
}

test.describe('成员与权限', () => {
  test.setTimeout(240_000);

  test('成员列表、角色切换与权限矩阵', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '窄屏侧栏里没有这个入口（移动端隐藏）');

    await signIn(page, DEMO_ACCOUNTS.owner);
    await openMembers(page);

    // ---- seed 的四个人与三张卡 ----
    await expect(page.getByText('工作区成员')).toBeVisible();
    await expect(page.getByRole('cell', { name: /lin\.yu@example\.com/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: /chen\.sy@example\.com/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: /wang\.jh@example\.com/ })).toBeVisible();

    // 自己那一行有「你」标记，且**角色不可改**（所有者）
    await expect(page.getByText('你', { exact: true })).toBeVisible();
    await expect(page.getByLabel('林予的角色')).toHaveCount(0);

    // ---- 权限矩阵是按唯一来源渲染的（每行还标了来历）----
    await expect(page.getByRole('heading', { name: '权限说明' })).toBeVisible();
    await expect(page.getByText('导出答卷数据')).toBeVisible();

    // ---- 角色切换（**不假设初始值**：上一次失败可能把角色留在别处，`pnpm db:seed` 才是复位手段）----
    await page.getByLabel('王嘉禾的角色').selectOption('VIEWER');
    await expect(page.getByLabel('王嘉禾的角色')).toHaveValue('VIEWER');

    await page.getByLabel('王嘉禾的角色').selectOption('EDITOR');
    await expect(page.getByLabel('王嘉禾的角色')).toHaveValue('EDITOR');
  });

  test('邀请 → 链接能打开 → 新用户加入 → 所有者移除', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');

    // 每次跑用一个新邮箱：注册接口对已存在的邮箱会拒绝，固定邮箱会让第二次跑必红
    const invitedEmail = `e2e.member.${Date.now()}@example.com`;

    await signIn(page, DEMO_ACCOUNTS.owner);
    await openMembers(page);

    // ---- 生成邀请 ----
    await page.getByRole('button', { name: '邀请成员' }).click();
    await page.getByLabel('邮箱').fill(invitedEmail);
    await page.getByRole('button', { name: '编辑者' }).click();
    await page.getByRole('button', { name: '生成邀请链接' }).click();

    // 弹层**不关**，直接把链接摆出来 —— 这个功能的全部意义就是把它给到对方
    const link = page.getByText(/\/invite\/[\w-]+/);
    await expect(link).toBeVisible();
    const inviteUrl = (await link.textContent()) ?? '';
    expect(inviteUrl).toContain('/invite/');

    // 待接受区里出现这一条（弹层里那颗按钮叫「完成」，别和 × 的「关闭」撞名）
    await page.getByRole('button', { name: '完成' }).click();
    await expect(page.getByText(invitedEmail)).toBeVisible();

    // ---- 换一个**不在工作区**的账号：注册 + 打开链接 + 接受 ----
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/register');
    await page.getByLabel('姓名', { exact: true }).fill('E2E 受邀成员');
    await page.getByLabel('邮箱', { exact: true }).fill(invitedEmail);
    await page.getByLabel('设置密码', { exact: true }).fill('demo1234');
    await page.getByLabel('确认密码', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: '创建账号' }).click();
    await expect(page).not.toHaveURL(/\/register$/);

    /**
     * **只取路径，不跳到那个绝对地址**。
     *
     * 链接的域名来自 `NEXT_PUBLIC_APP_URL`（演示环境是 `http://localhost:3000`），
     * 而 E2E 跑在 3100 上 —— 照直跳过去会打到「另一个服务」（本机那个 dev server），
     * 报出来的却是一个和本用例毫无关系的错误页（这一条我查了一轮才看明白）。
     * 生产环境里两者是同一个站点，所以这里取路径是最贴近真实、也最稳的写法。
     */
    const invitePath = new URL(inviteUrl).pathname;
    await page.goto(invitePath);
    await expect(page.getByText('轻问卷演示团队')).toBeVisible();
    // 按**按钮文案**断言角色（按钮写的是「接受邀请，以「编辑者」身份加入」）：
    // 比 getByText('编辑者') 更明确 —— 那个词在页面别处也可能出现
    const accept = page.getByRole('button', { name: /接受邀请，以「编辑者」身份加入/ });
    await expect(accept).toBeVisible();
    await accept.click();
    await expect(page.getByText(/已加入「轻问卷演示团队」/)).toBeVisible();

    // 新成员看得到这份工作区的成员列表（说明活跃工作区也切过去了）
    await page.goto('/app/members');
    await expect(
      page.getByRole('cell', { name: new RegExp(invitedEmail.replace('.', '\\.')) }),
    ).toBeVisible();

    // ---- 收尾：所有者把这位临时成员移出去（账号会留着，但不再占工作区名额）----
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await signIn(page, DEMO_ACCOUNTS.owner);
    await openMembers(page);

    const row = page.getByRole('row', { name: new RegExp(invitedEmail.replace('.', '\\.')) });
    await row.getByRole('button', { name: '移除' }).click();
    await page.getByRole('button', { name: '确认移除' }).click();
    await expect(page.getByText(invitedEmail)).toHaveCount(0);
  });

  test('查看者进这个页面：看得到，但写入口完全不出现', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '窄屏侧栏里没有这个入口（移动端隐藏）');

    await signIn(page, DEMO_ACCOUNTS.viewer);
    await openMembers(page);

    await expect(page.getByRole('heading', { name: '权限说明' })).toBeVisible();
    await expect(page.getByRole('button', { name: '邀请成员' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '移除' })).toHaveCount(0);
    await expect(page.getByLabel('王嘉禾的角色')).toHaveCount(0);
    // 卡片标题也按角色换：查看者没有「可编辑问卷」这回事
    await expect(page.getByText('可查看问卷')).toBeVisible();
  });
});
