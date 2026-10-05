import { defineConfig, devices } from '@playwright/test';

/**
 * 端到端测试配置。
 *
 * 两个 project 对应设计稿的双端形态：
 * - desktop：1440×900，完整管理台（侧栏 + 三栏编辑器）
 * - mobile：iPhone 13，底部导航外壳 + 弹层化编辑
 *
 * ⚠️ 端口刻意**不用 3000**：本机常有别的项目（同族的 FormCraft 等）的 dev server 占着 3000，
 * 而 `reuseExistingServer` 只要发现 baseURL 有响应就当「服务已就绪」—— 结果会静默地
 * 测到别人的应用上，而且看起来像是断言写错了。这里改用独立的 E2E_PORT 并显式 `--port` 固定：
 * 端口被占时 Next.js 会直接报错，而不是自动跳到 3001 骗过就绪检查。
 *
 * 首次使用需下载浏览器。国内网络建议走镜像：
 *   $env:PLAYWRIGHT_DOWNLOAD_HOST='https://cdn.npmmirror.com/binaries/playwright'
 *   pnpm exec playwright install chromium
 */
const e2ePort = Number(process.env.E2E_PORT || 3100);
const baseURL = `http://localhost:${e2ePort}`;

/**
 * 默认跑 `next dev`（改代码即生效，日常用）。
 * 设 `E2E_USE_BUILD=1` 则跑构建产物（`next start`）—— 它**不受项目级锁影响**，
 * 也不会因为 dev server 的模块图过期而出现假失败，适合在「本机已开着别的 dev server」
 * 或需要在干净产物上验证时使用。前提是先 `pnpm build`。
 */
const useBuildOutput = process.env.E2E_USE_BUILD === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  /**
   * 并发刻意压到 2。
   *
   * webServer 跑的是 `next dev`（按需编译）：默认的「一个测试文件一个 worker」
   * 会让多个 worker 同时触发首屏编译，互相排队，实测出现过 30s 超时的假失败。
   * 用例量很小，压到 2 反而更稳。
   */
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'github' : 'html',
  /**
   * 断言超时放到 15s（默认 5s 太紧）：数据库在 Neon 的新加坡区，
   * 一次登录会连带查出工作区、会话数、通知等好几次往返，
   * 默认 5s 会把「只是慢」误判成「坏了」——这正是我们踩过的坑。
   */
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // 移动端刻意固定为 375px 宽（设计稿的窄屏基准），并强制用 chromium：
      // devices['iPhone 13'] 默认是 WebKit，而本项目只装 chromium ——
      // 我们验证的是版式与交互（形态转换是否成立），不是 Safari 引擎差异。
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: {
    command: useBuildOutput
      ? `pnpm exec next start --port ${e2ePort}`
      : `pnpm exec next dev --port ${e2ePort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
