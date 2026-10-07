import { expect, test } from '@playwright/test';

/**
 * M0 冒烟：两个 project（desktop / mobile）都要能拿到页面骨架。
 * 主链路用例（注册 → 建问卷 → 编辑 → 发布 → 作答 → 统计）随里程碑逐步补齐。
 *
 * 根路由 `/` **不再渲染页面**：R43 起它按登录态分流（已登录 → `/app`，未登录 → `/login`），
 * 原先那条「首页展示品牌名」的断言随那张占位页一起作废。这里改为断言**分流本身** ——
 * 顺带守住「落地页不是一个空壳」。
 */
test('根路由分流到登录页，且登录页能用', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  // 落到的是真登录页：表单齐全（不是白屏，也不是 404）
  await expect(page.getByLabel('邮箱', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
});
