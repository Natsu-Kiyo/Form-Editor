import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

/**
 * 指向**已部署的站点**时设这个（生产冒烟用）。
 *
 * 设了它就当 baseURL，并且**不再自己起服务**（见下面的 `webServer`）。
 * 用途只有一个：在部署后的域名上跑**只读**用例（登录 / 列表 / 模板 / 公开作答），
 * 而不是整套 —— 整套会写库，生产库不该被测试数据污染（何况 `pnpm e2e` 开头还会清残留）。
 *
 * ```bash
 * $env:E2E_BASE_URL='https://<你的域名>'
 * pnpm exec playwright test e2e/auth.spec.ts e2e/smoke.spec.ts --project=desktop
 * ```
 */
const remoteBaseURL = process.env.E2E_BASE_URL?.trim() || null;
const baseURL = remoteBaseURL ?? `http://localhost:${e2ePort}`;

/**
 * **默认跑构建产物**（`next start`）；要 dev 的「改代码即生效」就显式设 `E2E_USE_DEV=1`。
 *
 * 为什么默认反过来（R86）：在 dev 上跑会得到**假失败**，而且假得很像用例写错了 ——
 * - 热更新留下的双 React 树会让同一个输入框在 DOM 里出现 2 个（`_r_` 与 `_R_` 两族 id），
 *   `getByLabel(...)` 当场 strict mode violation；
 * - Next 的开发浮层（`<nextjs-portal>`）会盖住按钮，把一次点击吃到 240 秒超时。
 * 两者都**只在 dev 里存在**，production 产物里没有这些代码（详见 PLAN.md R85 与复核 B.4）。
 * 代价是跑之前得先 `pnpm build` —— 下面那道检查负责把「忘了构建」说清楚。
 *
 * `E2E_USE_BUILD=1` 仍然认（它现在等价于默认值），旧命令与文档不改也能跑。
 */
const useBuildOutput = process.env.E2E_USE_DEV !== '1';

/**
 * 忘了 `pnpm build` 就直接跑：在**这里**报一句能看懂的话，而不是让 `next start`
 * 抛一句 `Could not find a production build`（那时人已经在等测试结果了）。
 * 只判本地自起服务的情况；指向远端时（`E2E_BASE_URL`）本来就没有本地产物什么事。
 */
if (useBuildOutput && !remoteBaseURL && !existsSync(join(process.cwd(), '.next', 'BUILD_ID'))) {
  throw new Error(
    '[e2e] 找不到构建产物（.next/BUILD_ID）：先跑 `pnpm build`，' +
      '或者设 `E2E_USE_DEV=1` 用 dev server 跑（那条路会接受 dev 带来的假失败）。',
  );
}

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
   * 断言超时放到 30s（默认 5s 太紧）：数据库在 Neon 的新加坡区，
   * 一次登录会连带查出工作区、会话数、通知等好几次往返，
   * 默认 5s 会把「只是慢」误判成「坏了」——这正是我们踩过的坑。
   *
   * 30 秒这个数的来历（不是随手调的）：`lib/db.ts` 里对连接类故障的处理是
   * **有界的** —— 建连（取连接）15 秒超时、查询 12 秒超时，各自失败后最多重试两次
   * （间隔 300ms / 900ms）。于是「一次断言里撞上一次故障」的最坏路径约 20 秒
   * （15 秒超时 + 重试 + 重新渲染），留出余量取 30 秒。
   * 超过这个数就说明不是环境抖动，值得当真去看。
   */
  expect: { timeout: 30_000 },

  /**
   * 单条用例的总超时。默认 30 秒对这套环境太紧：数据在境外，一次往返 225ms，
   * 而一条用例要走完「登录 → 建问卷 → 编辑 → 保存 → 回列表」十几步，
   * 每步都是好几次往返 —— 慢是真的慢，但每一步都是对的。
   * 需要更长的用例（例如连跑多个 draft 场景）仍可用 `test.setTimeout` 单独放宽。
   */
  timeout: 120_000,

  // 跑用例前先把数据库叫醒（Neon 冷启动是环境的固有开销，见该文件顶部说明），
  // 跑完再复测一次 —— 这一头一尾两行日志是判断「这轮失败是不是环境」的依据
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
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
  /*
   * 指向远端时**不自起服务**：远端站点已经在了，再起一个本地服务只会让人以为在测生产、
   * 其实测的是本地（这正是这套配置最怕的「静默测错对象」）。这是 `E2E_BASE_URL`
   * 唯一需要在这里配合的地方。
   */
  webServer: remoteBaseURL
    ? undefined
    : {
        command: useBuildOutput
          ? `pnpm exec next start --port ${e2ePort}`
          : `pnpm exec next dev --port ${e2ePort}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
