import { createHash } from 'node:crypto';

/**
 * 匿名作答的「同一份答卷只收一次」判定依据。
 *
 * 客户端会带上一个存在 localStorage 里的随机 id；拿不到时（无 JS、清过缓存）
 * 退回「UA + 语言」的哈希。**刻意不把 IP 算进来**：
 * 一个社团、一间自习室、一个公司出口常常共用一个公网 IP，
 * 用它去重会把「同一个网里的第二个人」直接挡在门外 —— 那比漏收几份更糟。
 *
 * 这当然不是防刷的强手段（换浏览器、清缓存就绕过了）。它解决的是**无意重复**：
 * 手滑点两次提交、回到上一页再填一遍。真正的强约束是登录作答时
 * `@@unique([questionnaireId, respondentId])`。
 */
export function buildFingerprint(clientId: string | null, userAgent: string | null) {
  const source = clientId?.trim() || `ua:${userAgent ?? 'unknown'}`;

  return createHash('sha256').update(source).digest('hex');
}
