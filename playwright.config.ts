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
  /**
   * 串行跑：所有用例共用**同一个演示数据库**，而且多条用例都会「新建 → 改名 → 删除」问卷。
   * 并行时后建的那张卡会被另一条用例的 `.first()` 抢走（空白创建的标题都是「未命名问卷」），
   * 表现为「A 用例的问卷里凭空多出一道题」这类极难定位的偶发失败。
   * 代价是跑得慢一些 —— 这笔账划得来：E2E 是里程碑收尾才跑的东西，不是每次提交都跑。
   */
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  /**
   * 断言超时放到 20s（默认 5s 太紧）：数据库在 Neon 的新加坡区，
   * 一次登录会连带查出工作区、会话数、通知等好几次往返，
   * 默认 5s 会把「只是慢」误判成「坏了」——这正是我们踩过的坑。
   *
   * 30 秒这个数的来历（不是随手调的）：`lib/db.ts` 里对连接类故障的处理是
   * **有界的** —— 建连 5 秒超时、查询 12 秒超时，各自失败后立刻重试一次。
   * 于是「一次断言里撞上一次故障」的最坏路径约 16 秒（12 秒超时 + 重试 + 重新渲染），
   * 留出余量取 30 秒。超过这个数就说明不是环境抖动，值得当真去看。
   */
  expect: { timeout: 30_000 },

  /**
   * 单条用例的总超时。默认 30 秒对这套环境太紧：数据在境外，一次往返 225ms，
   * 而一条用例要走完「登录 → 建问卷 → 编辑 → 保存 → 回列表」十几步，
   * 每步都是好几次往返 —— 慢是真的慢，但每一步都是对的。
   * 需要更长的用例（例如连跑多个 draft 场景）仍可用 `test.setTimeout` 单独放宽。
   */
  timeout: 120_000,

  // 跑用例前先把数据库叫醒（Neon 冷启动是环境的固有开销，见该文件顶部说明）
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
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
