import 'server-only';

import { hash, verify } from '@node-rs/argon2';

/**
 * 密码哈希：argon2id。
 *
 * 参数取 OWASP 推荐的最小配置（19 MiB 内存 / 2 次迭代 / 并行度 1）。
 * 参数只在**生成哈希**时写入，校验时由哈希串自带，所以这里不传参数 ——
 * 传了反而可能因为参数不匹配而失败。
 */
const HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string) {
  return hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, plain: string) {
  try {
    return await verify(passwordHash, plain);
  } catch {
    // 哈希串损坏或格式不对时按「校验失败」处理，不要把异常抛给调用方
    return false;
  }
}
