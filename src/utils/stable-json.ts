/**
 * 稳定序列化：对象键递归按字典序排序，其余语义与 `JSON.stringify` 一致。
 *
 * 为什么需要它（用户复测 #4）：版本快照存在 **JSONB** 列里，Postgres 会按自己的规则
 * 重排键（并去掉重复键），读回来的对象与刚构造的 payload **键序不同** ——
 * 直接用 `JSON.stringify` 比较「结构有没有变」永远不相等，于是每次保存都多写一条
 * 一模一样的版本，注释里承诺的「点十次保存不会得到十条噪音」从来没有生效过。
 *
 * 只做「键序无关」：数组顺序仍然有意义（选项、题目的顺序就是问卷结构的一部分）。
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  // Date 的 JSON 形态由 toJSON 决定；按普通对象遍历会得到 `{}`
  if (value instanceof Date) return value;

  if (Array.isArray(value)) return value.map(canonicalize);

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      // 与 JSON.stringify 一致：值为 undefined 的键整条丢掉
      if (item === undefined) continue;
      sorted[key] = canonicalize(item);
    }

    return sorted;
  }

  return value;
}
