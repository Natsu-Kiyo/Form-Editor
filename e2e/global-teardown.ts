import { request, type FullConfig } from '@playwright/test';

/**
 * 收尾复测：**这一轮跑完时环境还好吗**。
 *
 * 存在的理由是本会话反复出现的那个模式：全量开跑时数据库是好的（setup 里报「已就绪」），
 * 跑到中途链路退化，于是**最靠后的某一条用例**被超时打掉 —— 单跑必过。
 * 没有这一步时，判断「是不是环境」只能翻 stdout 找 `[db] 连接类错误`；
 * 有了它，收尾那一行直接说明「结束时的往返是多少」，与开头那行基线一比就知道。
 *
 * 它**不判失败**：环境退化不改变用例本身的对错，硬失败只会制造新的噪音。
 */
const SLOW_BASELINE_MS = 1_500;

export default async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3100';
  const context = await request.newContext({ baseURL });

  try {
    const response = await context.get('/api/health');
    const body = (await response.json()) as { ok?: boolean; elapsedMs?: number };

    if (!response.ok() || !body.ok) {
      console.log(`[e2e] ⚠️ 收尾复测：数据库没有响应（HTTP ${response.status()}）`);
      return;
    }

    const elapsed = body.elapsedMs ?? -1;
    if (elapsed > SLOW_BASELINE_MS) {
      console.log(
        `[e2e] ⚠️ 收尾复测：数据库已退化（SELECT 1 耗时 ${elapsed}ms，基线阈值 ${SLOW_BASELINE_MS}ms）。` +
          '若本轮有失败，先按环境问题处理：单跑那一条确认。',
      );
    } else {
      console.log(`[e2e] 收尾复测：数据库正常（SELECT 1 耗时 ${elapsed}ms）`);
    }
  } catch (error) {
    // 服务已被 webServer 收走时这里会抛，不是问题
    console.log(
      `[e2e] 收尾复测：跳过（${error instanceof Error ? error.message : String(error)}）`,
    );
  } finally {
    await context.dispose();
  }
}
