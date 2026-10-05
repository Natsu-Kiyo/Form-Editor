import { expect, test } from '@playwright/test';

import { DEMO_ACCOUNTS } from '@/config/constants';

/**
 * M1 验收：认证链路。
 *
 * 两个 project（desktop 1440 / mobile 375）都会跑 —— 认证页在窄屏下收起品牌面板，
 * 所以这同时是「双端复用同一套版式」的回归测试。
 *
 * 其中两条「失败时保留已填内容」的用例是回归测试：React 19 在
 * `<form action={fn}>` 的 action 结束后会重置非受控表单，
 * 若不把提交值回传给 `defaultValue`，用户会丢掉整张表单。
 */

test('未登录访问管理台会被拦到登录页', async ({ page }) => {
  await page.goto('/app');

  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
});

test('演示账号可以登录并进入管理台', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  // exact 是必须的：密码框右侧那个「显示密码」按钮的 aria-label 也含「密码」
  await page.getByLabel('密码', { exact: true }).fill(DEMO_ACCOUNTS.owner.password);
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: '问卷列表' })).toBeVisible();
});

test('注册时两次密码不一致会给出字段级提示，且不清空表单', async ({ page }) => {
  await page.goto('/register');

  await page.getByLabel('姓名', { exact: true }).fill('测试用户');
  await page.getByLabel('邮箱', { exact: true }).fill('mismatch@example.com');
  await page.getByLabel('设置密码', { exact: true }).fill('demo1234');
  await page.getByLabel('确认密码', { exact: true }).fill('demo5678');
  await page.getByRole('button', { name: '创建账号' }).click();

  // 校验在校验层就拦住了，不会写库 —— 所以这条用例不会污染演示数据
  await expect(page.getByText('两次输入的密码不一致')).toBeVisible();
  await expect(page).toHaveURL(/\/register/);

  // 四个字段都要原样保留，用户只需改错的那一处
  await expect(page.getByLabel('姓名', { exact: true })).toHaveValue('测试用户');
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('mismatch@example.com');
  await expect(page.getByLabel('设置密码', { exact: true })).toHaveValue('demo1234');
  await expect(page.getByLabel('确认密码', { exact: true })).toHaveValue('demo5678');
});

test('登录失败时只提示错误，不动已填内容', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('邮箱', { exact: true }).fill(DEMO_ACCOUNTS.owner.email);
  await page.getByLabel('密码', { exact: true }).fill('wrong-password-123');
  await page.getByRole('button', { name: '登录' }).click();

  // 用 filter 而不是直接 getByRole('alert')：开发模式下 Next 的调试浮层也带 role=alert
  await expect(page.getByRole('alert').filter({ hasText: '邮箱或密码不正确' })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue(DEMO_ACCOUNTS.owner.email);
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('wrong-password-123');
});
