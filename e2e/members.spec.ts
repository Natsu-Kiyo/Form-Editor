import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M8-a 验收：成员与权限（W09）。
 *
 * 用例分别验这几件事：
 * 1. 成员页本身能读能改（角色切换**要改回**，否则第二次跑就红了）；
 * 2. **邀请链接真的能加入** —— 这是本里程碑最容易做成假入口的地方
 *    （能复制、点开却 404，项目里已经踩过一次）；
 * 3. 查看者进这个页面时**写入口完全不出现**（服务端拦截由单测与 action 自身保证）；
 * 4. **解散工作区**（R75）：要手写确认文字，完成后落到一个新补的工作区；
 * 5. **退出工作区**（R75）：自己那一行是「退出」而不是「移除」，确认后离开。
 *
 * 后两条**全部自建账号**（注册会自动带一个默认工作区）—— 绝不拿演示工作区
 * 做实删实验：一次跑红就可能把其它用例依赖的 seed 数据拆掉。
 */
async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(account.email);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** 注册一个新账号（自动登录，并带一个「XX 的工作区」）。解散 / 退出用例的数据都从这来 */
async function register(page: Page, input: { name: string; email: string }) {
  await page.goto('/register');
  await page.getByLabel('姓名', { exact: true }).fill(input.name);
  await page.getByLabel('邮箱', { exact: true }).fill(input.email);
  await page.getByLabel('设置密码', { exact: true }).fill('demo1234');
  await page.getByLabel('确认密码', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: '创建账号' }).click();
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

    // 自己那一行有「你」标记；**所有者的角色下拉现在是"转让"的入口**（R76）
    await expect(page.getByText('你', { exact: true })).toBeVisible();
    await expect(page.getByLabel('林予的角色')).toHaveValue('OWNER');

    // 所有者自己那一行的操作是「解散」（R75）：转让在角色列那个下拉里，不在操作列
    await expect(
      page.getByRole('row', { name: /lin\.yu@example\.com/ }).getByRole('button', { name: '解散' }),
    ).toBeVisible();

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

  test('查看者进这个页面：看得到，写入口只剩自己那一行的「退出」', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '窄屏侧栏里没有这个入口（移动端隐藏）');

    await signIn(page, DEMO_ACCOUNTS.viewer);
    await openMembers(page);

    await expect(page.getByRole('heading', { name: '权限说明' })).toBeVisible();
    // 管理动作一个都不出现
    await expect(page.getByRole('button', { name: '邀请成员' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '移除' })).toHaveCount(0);
    await expect(page.getByLabel('王嘉禾的角色')).toHaveCount(0);
    // 但**自己那一行的「退出」人人都有**（R75）：它是"离开"，不是管理动作
    await expect(
      page
        .getByRole('row', { name: /chen\.mo@example\.com/ })
        .getByRole('button', { name: '退出' }),
    ).toBeVisible();
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

  test('解散工作区：要手写确认文字，完成后落到新补的工作区', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');
    test.setTimeout(240_000);

    const email = `e2e.dissolve.${Date.now()}@example.com`;

    // ---- 注册：自动带一个默认工作区，就是要解散的那个 ----
    await register(page, { name: 'E2E 解散者', email });
    await openMembers(page);

    // ---- 自己那一行（所有者）：「解散」 ----
    const myRow = page.getByRole('row', { name: new RegExp(email.replace('.', '\\.')) });
    await myRow.getByRole('button', { name: '解散' }).click();

    const dialog = page.getByRole('dialog');
    // `heading level 3`：弹窗标题在 DOM 里有两份（读屏用的 h2 + 正文里的视觉 h3），
    // 按文本找会撞 strict mode（撤回邀请那条用例踩过同一个坑）
    await expect(
      dialog.getByRole('heading', { level: 3, name: '确定解散这个工作区？' }),
    ).toBeVisible();

    // 没输入 / 输入不对 → 「确认解散」都不可点（它比其它危险弹窗多一道手写确认）
    const confirm = dialog.getByRole('button', { name: '确认解散' });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/输入「解散此工作区」以确认/).fill('解散');
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/输入「解散此工作区」以确认/).fill('解散此工作区');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // ---- 完成：回到列表，落在一个**新补的**工作区（原来那个已经没了）----
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText('E2E 解散者 的工作区').first()).toBeVisible();

    // 新工作区能正常用（没落到 NO_WORKSPACE 的异常页），且自己仍是所有者
    await openMembers(page);
    await expect(page.getByRole('cell', { name: /e2e\.dissolve/ })).toBeVisible();
    await expect(page.getByText('可编辑问卷')).toBeVisible();
  });

  test('退出工作区：自己那行是「退出」，确认后离开并落到自己的工作区', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');
    test.setTimeout(300_000);

    const stamp = Date.now();
    const ownerEmail = `e2e.leave.owner.${stamp}@example.com`;
    const memberEmail = `e2e.leave.member.${stamp}@example.com`;
    const memberWorkspace = `E2E 退出者${stamp} 的工作区`;

    // ---- A：注册（拿到一个工作区）并生成一条邀请 ----
    await register(page, { name: `E2E 房主${stamp}`, email: ownerEmail });
    await openMembers(page);
    await page.getByRole('button', { name: '邀请成员' }).click();
    await page.getByLabel('邮箱').fill(memberEmail);
    await page.getByRole('button', { name: '生成邀请链接' }).click();
    const invitePath = new URL((await page.getByText(/\/invite\/[\w-]+/).textContent()) ?? '')
      .pathname;
    await page.getByRole('button', { name: '完成' }).click();

    // ---- B：注册（自动建自己的工作区）+ 接受邀请加入 A 的 ----
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    /*
     * 必须等登出真的落地（到 /login）再走下一步：不等的话 `goto('/register')` 会与
     * 登出的客户端导航抢跑，页面上会**同时挂出两套表单**（全量里抓到的
     * strict violation 现场：两个 `input[name=password]`，id 一套来自 SSR、
     * 一套来自客户端重挂）。单跑快、不撞车，全量里必撞 —— 这类竞态只在慢下来时现形。
     */
    await expect(page).toHaveURL(/\/login$/);
    await register(page, { name: `E2E 退出者${stamp}`, email: memberEmail });

    await page.goto(invitePath);
    await page.getByRole('button', { name: /接受邀请/ }).click();
    await expect(page.getByText(/已加入/)).toBeVisible();

    // ---- B 在自己那一行看到「退出」（不是「移除」——那是管理动作）----
    await page.goto('/app/members');
    const myRow = page.getByRole('row', { name: new RegExp(memberEmail.replace('.', '\\.')) });
    await expect(myRow.getByRole('button', { name: '退出' })).toBeVisible();
    await expect(page.getByRole('button', { name: '移除' })).toHaveCount(0);

    await myRow.getByRole('button', { name: '退出' }).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { level: 3, name: '确定退出这个工作区？' }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: '确认退出' }).click();

    // ---- 离开 A 的工作区，落到自己注册时那个 ----
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(memberWorkspace).first()).toBeVisible();

    // 收尾：A 的工作区里只剩 A（B 已退出）；两个账号与工作区都会被 purge-e2e 清掉
  });

  test('转让所有权：所有者角色下拉选一档 → 指定继承人 → 两人角色互换', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '要写数据库，只在一个 project 跑');
    test.setTimeout(300_000);

    const stamp = Date.now();
    const ownerEmail = `e2e.transfer.owner.${stamp}@example.com`;
    const memberEmail = `e2e.transfer.member.${stamp}@example.com`;
    const ownerName = `E2E 转让人${stamp}`;
    const memberName = `E2E 继承人${stamp}`;

    // ---- A：注册（得到工作区）并邀请 B ----
    await register(page, { name: ownerName, email: ownerEmail });
    await openMembers(page);
    await page.getByRole('button', { name: '邀请成员' }).click();
    await page.getByLabel('邮箱').fill(memberEmail);
    await page.getByRole('button', { name: '生成邀请链接' }).click();
    const invitePath = new URL((await page.getByText(/\/invite\/[\w-]+/).textContent()) ?? '')
      .pathname;
    await page.getByRole('button', { name: '完成' }).click();

    // ---- B：注册 + 接受邀请（照 R75 退出用例的结构）----
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await register(page, { name: memberName, email: memberEmail });
    await page.goto(invitePath);
    await page.getByRole('button', { name: /接受邀请/ }).click();
    await expect(page.getByText(/已加入/)).toBeVisible();

    // ---- 换回 A（登出 B 后登录 A）----
    // 先离开邀请页：那一页是**公开页面**，没有侧栏与账号菜单
    //（踩过：直接在它上面等「账号菜单」会一直超时）
    await page.goto('/app/members');
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitem', { name: '退出登录' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page, { email: ownerEmail, password: 'demo1234' });
    await openMembers(page);

    // ---- A 在自己那一行的角色下拉里选「管理员」→ 弹出转让弹窗 ----
    await page.getByLabel(`${ownerName}的角色`).selectOption('ADMIN');

    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('heading', { level: 3, name: '转让工作区所有权？' }),
    ).toBeVisible();
    // 文案里点明"自己会变成什么"（= 下拉里选的那一档）
    await expect(dialog.getByText('自己转为「管理员」')).toBeVisible();

    // 没选继承人 → 「确认转让」不可点
    const confirm = dialog.getByRole('button', { name: '确认转让' });
    await expect(confirm).toBeDisabled();

    // 选继承人（Radix Select：点触发器 → 点选项）
    await dialog.getByLabel('继承所有者的成员').click();
    await page.getByRole('option', { name: new RegExp(memberName) }).click();
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // ---- 角色互换 ----
    // `.first()`：toast 标题在读屏用的 aria-live 区里还有一份
    await expect(page.getByText('所有权已转让').first()).toBeVisible();

    // A（自己）变成管理员：下拉值 = ADMIN，操作列从「解散」变成「退出」
    const myRow = page.getByRole('row', { name: new RegExp(ownerEmail.replace('.', '\\.')) });
    await expect(myRow.getByRole('combobox')).toHaveValue('ADMIN');
    await expect(myRow.getByRole('button', { name: '退出' })).toBeVisible();
    await expect(myRow.getByRole('button', { name: '解散' })).toHaveCount(0);

    // B 成为所有者：那一行是静态「所有者」胶囊（没有下拉），操作列也没有「移除」
    const memberRow = page.getByRole('row', { name: new RegExp(memberEmail.replace('.', '\\.')) });
    await expect(memberRow.getByText('所有者')).toBeVisible();
    await expect(memberRow.getByRole('combobox')).toHaveCount(0);
  });
});
