import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { request, type APIRequestContext, type FullConfig } from '@playwright/test';

/**
 * 跑用例前先把数据库叫醒。
 *
 * 为什么需要它：数据库在 Neon 的新加坡区，计算节点空闲一段时间会挂起，
 * 恢复要十几秒。这段时间里**连接是通的、查询只是在等** ——
 * 于是它既不会报错，也不受建连超时管辖，只是让「某次请求」慢到超出断言预算，
 * 表现为「每次跑第一条用例都红」（我们为此白查了两轮）。
 *
 * 这是**环境的固有开销**，不是产品行为，所以在这里一次性付掉，
 * 而不是把断言超时一路放大到掩盖真实问题。
 *
 * 另外报一行**延迟基线**（`/api/health` 里那次 `SELECT 1` 的服务端耗时）。
 * 理由：本会话已经四次出现「全量跑得越久、越有一条用例被数据库超时打掉」，
 * 而事后判断「这轮是不是环境退化」只能翻 stdout 找 `[db] 连接类错误`。
 * 基线放在第一行，退化与否一眼可见 —— 配合 `global-teardown.ts` 的收尾复测。
 *
 * 除此之外还有两道与「跑什么、跑在哪」有关的闸（R86，见下面各自的注释）：
 * **目标是 `next dev` 就直接拦下**（dev 的假失败与真 bug 长得一样）、
 * **构建产物比源码旧就提示一声**（默认跑构建产物之后新增的误判路径）。
 */
const WARMUP_BUDGET_MS = 120_000;
const RETRY_INTERVAL_MS = 2_000;

/**
 * 基线阈值。实测稳态往返是 223ms（R14 记录的基准），这里放宽到 1.5s：
 * 超过它不是「坏了」，而是「这轮不适合跑全量」——值得先说一声，
 * 否则等一下的失败又会被当成用例问题。
 */
const SLOW_BASELINE_MS = 1_500;

/**
 * dev 专属的产物标记。**只在 `next dev` 的首屏 HTML 里**，production 产物里没有 ——
 * 所以「HTML 里有它」等价于「目标跑的是 next dev」。两个都留着，任命中一个即可：
 * - `next-devtools`：DevTools / 开发浮层的代码（只有 dev 才会打进来）
 * - `hmr-client`：热更新客户端那个 chunk
 *
 * 注意别拿 `data-nextjs-dev-overlay` 来探：那段脚本标签是**客户端**才插进 DOM 的
 * （Playwright 报错里能看到它，但 `curl /login` 的首屏 HTML 里没有）。
 */
const DEV_ONLY_MARKERS = ['next-devtools', 'hmr-client'];

/**
 * 拦在开跑之前：**目标服务是不是 `next dev`**。
 *
 * 为什么要有这道闸（R86）：在 dev 上跑 e2e 会得到**假失败**，而且假得很像用例写错了 ——
 * 热更新留下的双 React 树让同一个输入框在 DOM 里出现 2 个（`_r_` / `_R_` 两族 id）、
 * 开发浮层（`<nextjs-portal>`）盖住按钮把一次点击拖到 240 秒超时（复核 B.4 与本机都踩过）。
 * 与其 4 分钟后收到一句「超时」，不如在这里一次说清；**跑之前**失败还能让人立刻换跑法。
 *
 * 显式设了 `E2E_USE_DEV=1` 就只提示不拦 —— 那是「我知道，我就要在 dev 上跑」。
 */
async function guardAgainstDevTarget(context: APIRequestContext) {
  let html: string;
  try {
    const response = await context.get('/login');
    // 探测失败不制造第二种失败原因：这里只负责「发现了就喊」，不负责判定目标好坏
    if (!response.ok()) return;
    html = await response.text();
  } catch {
    return;
  }

  const marker = DEV_ONLY_MARKERS.find((candidate) => html.includes(candidate));

  if (!marker) {
    console.log('[e2e] 目标服务是生产构建（HTML 里没有 dev 专属注入）');
    return;
  }

  const message =
    `[e2e] 目标服务是 \`next dev\`（HTML 里发现 dev 专属标记 \`${marker}\`）。` +
    '在 dev 上跑会得到假失败：热更新留下的双 React 树会让同一个输入框命中 2 个元素，' +
    '开发浮层还会盖住按钮、把点击拖到 240 秒超时 —— 两者都只在 dev 里存在。\n' +
    '[e2e] 改法：先 `pnpm build` 再跑（`pnpm e2e` 默认就用构建产物）；' +
    '执意要在 dev 上跑就设 `E2E_USE_DEV=1`，那时这条只提示不拦截。';

  if (process.env.E2E_USE_DEV === '1') {
    console.log(`[e2e] ⚠️ ${message}`);
    return;
  }

  throw new Error(message);
}

/**
 * 构建产物是不是**比源码旧**。
 *
 * 默认改成构建产物之后多出一条新的误判路径：改了代码、忘了重新 `build`，
 * 于是跑的是上一次的产物 —— 通过也证明不了现在的代码是对的。
 * 只提示、不拦：刻意在某个固定产物上复跑是合理需求。
 */
const SOURCE_ROOTS = ['src', 'prisma', 'next.config.ts', 'package.json'];

function newestMtimeMs(target: string): number {
  const stats = statSync(target, { throwIfNoEntry: false });
  if (!stats) return 0;
  if (!stats.isDirectory()) return stats.mtimeMs;

  return readdirSync(target, { withFileTypes: true }).reduce(
    (newest, entry) => Math.max(newest, newestMtimeMs(join(target, entry.name))),
    0,
  );
}

function warnIfBuildIsStale() {
  if (process.env.E2E_BASE_URL?.trim() || process.env.E2E_USE_DEV === '1') return;

  const root = process.cwd();
  const builtAt = statSync(join(root, '.next', 'BUILD_ID'), { throwIfNoEntry: false })?.mtimeMs;
  if (!builtAt) return;

  const newestSource = SOURCE_ROOTS.reduce(
    (newest, source) => Math.max(newest, newestMtimeMs(join(root, source))),
    0,
  );

  if (newestSource > builtAt) {
    console.log(
      '[e2e] ⚠️ 构建产物比源码旧（源码在那之后又被改过）：这轮测的不是你现在的代码，' +
        '先 `pnpm build` 再跑。',
    );
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3100';
  const context = await request.newContext({ baseURL });
  const deadline = Date.now() + WARMUP_BUDGET_MS;

  let attempt = 0;
  let lastDetail = '还没有成功发出请求';
  let databaseReady = false;

  while (Date.now() < deadline) {
    attempt += 1;

    try {
      const response = await context.get('/api/health');
      const body = (await response.json()) as { ok?: boolean; elapsedMs?: number };

      if (response.ok() && body.ok) {
        const elapsed = body.elapsedMs ?? -1;
        console.log(
          `[e2e] 数据库已就绪（第 ${attempt} 次尝试，服务端 SELECT 1 耗时 ${elapsed}ms）`,
        );

        if (elapsed > SLOW_BASELINE_MS) {
          console.log(
            `[e2e] ⚠️ 环境偏慢（>${SLOW_BASELINE_MS}ms）：这一轮全量里有较大概率出现` +
              '「某条用例被数据库超时打掉」。若真出现，先单跑那一条确认，别当成用例的问题。',
          );
        }

        databaseReady = true;
        break;
      }

      lastDetail = `HTTP ${response.status()}`;
    } catch (error) {
      // 服务还没起来时这里会抛（globalSetup 与 webServer 的启动顺序不保证），继续等
      lastDetail = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
  }

  if (!databaseReady) {
    await context.dispose();

    // 明确报错而不是让几十条用例各自超时：此时的问题是「数据库连不上」，
    // 用例里的任何断言都只是它的症状
    throw new Error(
      `[e2e] 数据库在 ${WARMUP_BUDGET_MS / 1000} 秒内没有就绪（最后一条：${lastDetail}）。` +
        '请确认 DATABASE_URL 是否可用、Neon 项目是否还在。',
    );
  }

  /*
   * 两道闸**必须放在上面那个 try 之外**：它们是「发现了就该拦下」的判定，
   * 而那个 catch 的语义是「服务还没起来，继续等」—— 放进去会被它当成一次失败的探测，
   * 把「目标是 dev」这句精确的报错冲成一个 120 秒后到来的「数据库没就绪」（实测踩过）。
   */
  await guardAgainstDevTarget(context);
  warnIfBuildIsStale();

  await context.dispose();
}
