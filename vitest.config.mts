import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * 单元 / 集成测试配置。
 *
 * 测试预算的分配见 docs/PLAN.md §9.3：优先覆盖**业务规则纯函数**
 * （状态机、指标口径、渠道归属、防重复、分页排序），而不是组件细节。
 * 主链路交给 Playwright（见 e2e/）。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
