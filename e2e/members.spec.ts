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

  test('邀请链接只对受邀邮箱有效（转发给别人打不开）', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');

    const invitedEmail = `e2e.not.mine.${Date.now()}@example.com`;

    await signIn(page, DEMO_ACCOUNTS.owner);
    await openMembers(page);

    await page.getByRole('button', { name: '邀请成员' }).click();
    await page.getByLabel('邮箱').fill(invitedEmail);
    await page.getByRole('button', { name: '生成邀请链接' }).click();
    const link = page.getByText(/\/invite\/[\w-]+/);
    await expect(link).toBeVisible();
    // 只取路径：链接域名来自 NEXT_PUBLIC_APP_URL，而 E2E 跑在 3100（见另一条用例的说明）
    const invitePath = new URL((await link.textContent()) ?? '').pathname;
    await page.getByRole('button', { name: '完成' }).click();

    // ---- 换成另一个账号（陈默）去开这个链接 ----
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await signIn(page, DEMO_ACCOUNTS.viewer);

    await page.goto(invitePath);

    // 邮箱不符 → **一视同仁地 404**：不透露这份邀请存在，也不透露它发给了谁
    await expect(page.getByText('这个地址打不开')).toBeVisible();
    await expect(page.getByRole('button', { name: /接受邀请/ })).toHaveCount(0);
    // 那条受邀邮箱**一个字都不该出现在页面上**（这正是以前泄露出去的东西）
    await expect(page.getByText(invitedEmail)).toHaveCount(0);
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

  test('复制链接：复制到剪贴板的就是那条邀请的链接', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');
    test.setTimeout(120_000);

    // 读回剪贴板要显式授权（Playwright 默认不给）
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const invitedEmail = `e2e.copy.${Date.now()}@example.com`;

    await signIn(page, DEMO_ACCOUNTS.owner);
    await openMembers(page);

    await page.getByRole('button', { name: '邀请成员' }).click();
    await page.getByLabel('邮箱').fill(invitedEmail);
    await page.getByRole('button', { name: '生成邀请链接' }).click();

    // 弹层里展示的那条链接是「标准答案」
    const dialogLink = (await page.getByText(/\/invite\/[\w-]+/).textContent()) ?? '';
    expect(dialogLink).toContain('/invite/');
    await page.getByRole('button', { name: '完成' }).click();

    const row = page.getByRole('listitem').filter({ hasText: invitedEmail });

    // ---- 行内「复制链接」----
    await row.getByRole('button', { name: '复制链接' }).click();
    // `.first()`：Radix 的 toast 会把标题同时渲染进 aria-live 区（读屏用），DOM 里有两份
    await expect(page.getByText('邀请链接已复制').first()).toBeVisible();

    const copied = await page.evaluate(() => navigator.clipboard.readText());

    // 域名可能不同：弹层那条由服务端的 `NEXT_PUBLIC_APP_URL` 拼（演示环境是 :3000），
    // 而行内复制用的是**管理员此刻打开的地址**（E2E 跑在 :3100）。所以要验的是
    // 「同一条邀请的路径」+「用的是当前站点」这两件事
    expect(new URL(copied).pathname).toBe(new URL(dialogLink).pathname);
    expect(new URL(copied).origin).toBe(new URL(page.url()).origin);

    // ---- 收尾：撤回这一条（顺便不让「待接受」里残留）----
    await row.getByRole('button', { name: '撤回' }).click();
    await page.getByRole('button', { name: '确认撤回' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: invitedEmail })).toHaveCount(0);
  });

  test('撤回邀请：要二次确认，确认后那条链接立刻打不开', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');
    test.setTimeout(180_000);

    const invitedEmail = `e2e.revoke.${Date.now()}@example.com`;

    /*
     * 先给这个邮箱注册好账号。
     *
     * 撤回本身在界面上「看起来」已经是成功的（那一行消失），但**链接是否真的失效**只有
     * 用受邀人本人去开一次才验得出来 —— 拿别人的账号去开，都会因为「邮箱不符」404，
     * 那样测不出撤回有没生效。
     */
    await page.goto('/register');
    await page.getByLabel('姓名', { exact: true }).fill('E2E 待撤回');
    await page.getByLabel('邮箱', { exact: true }).fill(invitedEmail);
    await page.getByLabel('设置密码', { exact: true }).fill('demo1234');
    await page.getByLabel('确认密码', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: '创建账号' }).click();
    await expect(page).not.toHaveURL(/\/register$/);

    // ---- 所有者生成那条邀请 ----
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await signIn(page, DEMO_ACCOUNTS.owner);
    await openMembers(page);

    await page.getByRole('button', { name: '邀请成员' }).click();
    await page.getByLabel('邮箱').fill(invitedEmail);
    await page.getByRole('button', { name: '生成邀请链接' }).click();

    const link = page.getByText(/\/invite\/[\w-]+/);
    await expect(link).toBeVisible();
    const invitePath = new URL((await link.textContent()) ?? '').pathname;
    await page.getByRole('button', { name: '完成' }).click();

    // 列表里那一条（`<li>` —— 按邮箱定位，避免命中别的邀请）
    const invitation = page.getByRole('listitem').filter({ hasText: invitedEmail });
    const revokeButton = invitation.getByRole('button', { name: '撤回' });

    // ---- 点「撤回」：先出确认层 ----
    await revokeButton.click();
    await expect(page.getByRole('heading', { level: 3, name: '确定撤回这个邀请？' })).toBeVisible();

    /*
     * ---- 取消 → 一切照旧 ----
     *
     * 断言放在**关闭之后**：弹层开着时 Radix 会把背景整块设为 `aria-hidden`，
     * 按角色（`listitem`）是找不到背景元素的 —— 那是它的正确行为，不是缺陷。
     */
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('heading', { level: 3, name: '确定撤回这个邀请？' })).toHaveCount(
      0,
    );
    await expect(invitation).toBeVisible();

    // ---- 再来一次，这回确认 ----
    await revokeButton.click();
    await page.getByRole('button', { name: '确认撤回' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: invitedEmail })).toHaveCount(0);

    // ---- 换回那位受邀人：他手里那条链接现在应当打不开 ----
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();

    // 不用 `signIn` helper：这位用户还没有工作区，登录后不一定落在 /app
    await page.getByLabel('邮箱', { exact: true }).fill(invitedEmail);
    await page.getByLabel('密码', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).not.toHaveURL(/\/login$/);

    await page.goto(invitePath);
    /*
     * 这里说的是「已撤回、不能接受」，**不是**「这个地址打不开」——
     * 后者是「邮箱不符」那条 404 的文案（G6）。拿它来断言，会验不出撤回有没有生效：
     * 换成任何一个不是受邀邮箱的账号来开，都会看到那句话。
     */
    await expect(page.getByText(/这份邀请的状态是「已撤回」/)).toBeVisible();
    await expect(page.getByRole('button', { name: /接受邀请/ })).toHaveCount(0);
  });
});
