import { createHash } from 'node:crypto';

/**
 * 匿名作答的「同一份答卷只收一次」判定依据。
 *
 * 只认 **proxy 下发的 `qw_client_id`**（一个随机 UUID，一年有效）。
 *
 * 以前拿不到 Cookie 时会退回「UA 哈希」，那是错的（审查 #10）：
 * 同一个浏览器类型的所有人共用一个 UA，于是**第一个人交完，同 UA 的其他人全被当成
 * 「已提交过」**；攻击者也可以故意不带 Cookie、拿一个常见 UA 交一次，把那一整批人挡在门外。
 * UA 描述的是浏览器，不是人 —— 这里不该出现它。
 *
 * 现在拿不到 id 时返回 `null`：**宁可放弃这一份的去重，也不误伤别人**
 *（`Response.fingerprint` 可空，唯一索引对多条 NULL 不生效）。
 * 拿不到的原因只剩「proxy 没覆盖到」这种异常路径，正常链路一定有值。
 */
export function buildFingerprint(clientId: string | null) {
  const source = clientId?.trim();
  if (!source) return null;

  return createHash('sha256').update(source).digest('hex');
}
