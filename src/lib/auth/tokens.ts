import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

/**
 * 会话令牌与找回密码令牌的生成。
 *
 * 约定：**库里只存 sha256，原始令牌只存在于 Cookie 或邮件链接里**。
 * 这样即使数据库泄露，也无法直接拿去冒用登录态或重置密码。
 *
 * **已知例外：邀请链接**（`Invitation.token` 存的是**原文**，见 schema.prisma 那一列）。
 * 那是有意的、不是漏改：邀请由管理员手动转发（本项目没有邮件通道），而接受页**必须**
 * 把「链接」与「登录账号的邮箱」对在一起才放行（不一致直接 404）—— 所以拿到库里的 token
 * 也还不能加入任何工作区，除非同时控制了那个受邀邮箱的账号。
 *
 * 要把它收紧成同一个口径，照 `Session` 的办法存 `hashToken(token)` 即可（`createToken`
 * 已经同时给出两者），代价是**已发出的待接受邀请会全部失效**（查询从 token 改成 hash，
 * 老行对不上），需要配一条数据迁移。取舍记录见 REVIEW-SECURITY-ERRORS-2026-10-10.md §7。
 *
 * 用 sha256 而不是 argon2：令牌本身是 32 字节的高熵随机值，
 * 不存在可被暴力破解的「弱口令」问题，不需要慢哈希（而慢哈希会让每次请求都变慢）。
 */
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createToken(bytes = 32) {
  const token = randomBytes(bytes).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}
