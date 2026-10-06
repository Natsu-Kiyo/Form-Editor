import { expect, test, type Page } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M4-b 验收：分享页可用（链接 / 二维码 / 回收开关三态 / 渠道），
 * 且**截止后不能重开**。
 *
 * 只在 desktop 跑：桌面这一套与窄屏是两套排布（窄屏是 P06 的入口+弹层），
 * 而状态机是同一份，桌面已经覆盖。窄屏排布另有 `app-shell` 那样的可见性断言可扩。
 */
const TITLE = 'E2E 分享用例';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 60_000 });
}

async function clearLeftovers(page: Page, title: string) {
  const menu = page.getByRole('button', { name: `「${title}」更多操作` });

  for (let remaining = await menu.count(); remaining > 0; remaining -= 1) {
    await menu.first().click();
    await page.getByRole('menuitem', { name: '删除问卷' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(menu).toHaveCount(remaining - 1);
  }
}

test.describe('分享与分发', () => {
  test.setTimeout(300_000);

  test('发布后：链接可复制、二维码是真的图、回收开关三态且截止不可重开', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '分享写操作只在桌面端跑');
    await signIn(page);
    await clearLeftovers(page, TITLE);

    // ---- 造一份已发布的问卷（从草图到发布走一遍）----
    await page.getByRole('button', { name: '新建问卷' }).first().click();
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/q\/[^/]+\/edit$/, { timeout: 90_000 });

    await page.getByLabel('问卷标题').fill(TITLE);
    await page.getByRole('button', { name: '单选', exact: true }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('banner').getByText('已保存')).toBeVisible();

    const tabs = page.getByRole('navigation', { name: '问卷内页面' });
    await tabs.getByRole('link', { name: '发布设置' }).click();
    await page.getByRole('button', { name: '保存并发布' }).click();
    await expect(page.getByRole('status')).toContainText('已发布');

    // ---- 分享页 ----
    await tabs.getByRole('link', { name: '分享' }).click();
    await expect(page).toHaveURL(/\/share$/);

    // 链接文案是去协议头的短链（设计稿 W05）
    await expect(page.getByText(/\/s\//).first()).toBeVisible();

    // 复制链接：按钮要给出反馈（剪贴板被拒时会显示「复制失败」，那同样是明确反馈）
    await page.getByRole('button', { name: '复制链接' }).click();
    await expect(page.getByRole('button', { name: '已复制' })).toBeVisible();

    // 二维码：页面上的 <img> 与下载用的是同一个地址，所以直接验那个地址
    const qrSrc = await page.getByAltText(/的作答二维码/).getAttribute('src');
    expect(qrSrc).toBeTruthy();
    const qrResponse = await page.request.get(qrSrc!);
    expect(qrResponse.status()).toBe(200);
    // **PNG 而不是 SVG**：二维码要被转发、贴进聊天窗口、印在纸上，
    // 而这些场景经常打不开 SVG（拿到一个「下载了却看不了」的文件比糊一点糟得多）
    expect(qrResponse.headers()['content-type']).toContain('image/png');
    const qrBytes = await qrResponse.body();
    expect(qrBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

    // 下载地址要带 Content-Disposition，否则点了会变成在浏览器里预览
    const downloadResponse = await page.request.get(`${qrSrc!}?download=1`);
    expect(downloadResponse.headers()['content-disposition']).toContain('attachment');
    expect(downloadResponse.headers()['content-disposition']).toContain('.png');

    // ---- 分享出去的链接必须真的能打开 ----
    // 回归：曾经复制的短链是一个 404（作答端还没做），看起来像整站坏了。
    // 必须在「截止」之前验 —— 截止之后公开页显示的是已截止状态，不是作答表单
    const shareLabel = await page.getByText(/\/s\//).first().textContent();
    await page.goto(`/s/${shareLabel!.split('/s/')[1]}`);
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
    // 是**能填的表单**而不只是题目预览：M5 交付作答端之前这里只显示预览
    await expect(page.getByRole('button', { name: /提交答卷/ })).toBeVisible();
    await page.goBack();

    // ---- 回收开关三态 ----
    const topbar = page.getByRole('banner');

    await page.getByRole('button', { name: '暂停回收' }).click();
    await expect(topbar.getByText('已暂停')).toBeVisible();

    await page.getByRole('button', { name: '恢复回收' }).click();
    await expect(topbar.getByText('回收中')).toBeVisible();

    // 截止要二次确认（不可逆）
    await page.getByRole('button', { name: '截止回收' }).click();
    await page.getByRole('button', { name: '确认截止' }).click();
    await expect(topbar.getByText('已截止')).toBeVisible();

    // **不可重开**：恢复回收的按钮必须消失（而不是点了被拒），且给出下一步
    await expect(page.getByRole('button', { name: '恢复回收' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '暂停回收' })).toHaveCount(0);
    await expect(page.getByText('要再来一轮请把它复制为新问卷')).toBeVisible();

    // ---- 新建渠道 ----
    await page.getByRole('button', { name: '新建渠道' }).click();
    // 刻意用纯中文名：走「按名字推不出拉丁串 → 落成 ch-xxxxxx」那条分支
    await page.getByLabel('渠道名称').fill('公众号');
    await page.getByRole('button', { name: '创建', exact: true }).click();

    await expect(page.getByRole('cell', { name: '公众号' })).toBeVisible();
    await expect(page.getByText(/\?src=ch-/)).toBeVisible();

    // ---- 收尾 ----
    await page.goto('/app');
    await clearLeftovers(page, TITLE);
  });
});
