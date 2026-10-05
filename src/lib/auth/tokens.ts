import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

/**
 * 会话令牌与找回密码令牌的生成。
 *
 * 约定：**库里只存 sha256，原始令牌只存在于 Cookie 或邮件链接里**。
 * 这样即使数据库泄露，也无法直接拿去冒用登录态或重置密码。
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
