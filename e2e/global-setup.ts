import { request, type FullConfig } from '@playwright/test';

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
 */
const WARMUP_BUDGET_MS = 120_000;
const RETRY_INTERVAL_MS = 2_000;

/**
 * 基线阈值。实测稳态往返是 223ms（R14 记录的基准），这里放宽到 1.5s：
 * 超过它不是「坏了」，而是「这轮不适合跑全量」——值得先说一声，
 * 否则等一下的失败又会被当成用例问题。
 */
const SLOW_BASELINE_MS = 1_500;

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3100';
  const context = await request.newContext({ baseURL });
  const deadline = Date.now() + WARMUP_BUDGET_MS;

  let attempt = 0;
  let lastDetail = '还没有成功发出请求';

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

        await context.dispose();
        return;
      }

      lastDetail = `HTTP ${response.status()}`;
    } catch (error) {
      // 服务还没起来时这里会抛（globalSetup 与 webServer 的启动顺序不保证），继续等
      lastDetail = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
  }

  await context.dispose();

  // 明确报错而不是让几十条用例各自超时：此时的问题是「数据库连不上」，
  // 用例里的任何断言都只是它的症状
  throw new Error(
    `[e2e] 数据库在 ${WARMUP_BUDGET_MS / 1000} 秒内没有就绪（最后一条：${lastDetail}）。` +
      '请确认 DATABASE_URL 是否可用、Neon 项目是否还在。',
  );
}
