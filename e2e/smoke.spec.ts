import { expect, test } from '@playwright/test';

/**
 * M0 冒烟：两个 project（desktop / mobile）都要能拿到首页骨架。
 * 主链路用例（注册 → 建问卷 → 编辑 → 发布 → 作答 → 统计）随里程碑逐步补齐。
 */
test('产品首页可访问并展示品牌名', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '轻问卷' })).toBeVisible();
  await expect(page.getByText('创建、发放、回收、分析，一条线走完。')).toBeVisible();
});
