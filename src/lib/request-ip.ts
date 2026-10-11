import 'server-only';

import { headers } from 'next/headers';

/**
 * 请求来源标识 —— 限流用的 key 的一半。
 *
 * 四处限流都要它（登录 / 注册 / 口令解锁 / 公开提交）。此前是三份手抄：
 * 一处取 `x-forwarded-for` 的第一跳、一处忘了 `x-real-ip`、还有一处把顺序写反 ——
 * 这类不一致最难查（同一个人在两处算法里算成两个 key，限流就形同虚设）。
 *
 * **已知边界**（`docs/VERIFY.md` §四 也记着，别当成已防护）：
 * - 取的是 `x-forwarded-for` 的**第一跳**：前面若没有可信代理清洗这个头，它可以被伪造；
 * - 取不到时退化成 `'unknown'` —— 那时**按全站计数**，会更早拦住正常用户，而不是放行。
 */
export async function clientIp() {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for')?.split(',')[0]?.trim();

  return forwarded || store.get('x-real-ip') || 'unknown';
}
