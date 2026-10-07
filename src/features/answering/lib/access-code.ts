import { timingSafeEqual } from 'node:crypto';

/**
 * 访问口令的比对。
 *
 * **和账号密码不是一回事**，所以这里不复用 `lib/auth/password.ts` 的 argon2：
 *
 * - 账号密码是**用户自己的机密**，只该被验证、永远不该被读出来 → 单向哈希。
 * - 访问口令是**发起人要发出去的访问码**，他必须能再看到它（忘掉就只能重设，
 *   而重设会让已发出去的码当场失效）→ 库里存原文（见 `schema.prisma` 那一列）。
 *
 * 存了原文，比对就用等时比较：普通的 `===` 会在第一个不同的字符处提前返回，
 * 理论上能按耗时逐位试出口令。等时比较把这个信息抹掉。
 */
export function verifyAccessCode(stored: string, input: string): boolean {
  const expected = Buffer.from(stored, 'utf8');
  const actual = Buffer.from(input, 'utf8');

  /*
   * `timingSafeEqual` 遇到长度不同会**抛异常**，所以先自己挡一道。
   * 这确实泄露了「长度对不对」，但口令长度不是秘密（它就 4~64 位，
   * 这条路要防的是「猜出值」，而猜长度帮不上忙）。
   */
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
